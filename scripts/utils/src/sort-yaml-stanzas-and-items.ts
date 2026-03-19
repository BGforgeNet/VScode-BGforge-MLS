/**
 * Sorts top-level YAML stanzas and stanza `items:` entries alphabetically
 * while preserving the original source text of each block.
 *
 * Usage:
 *   pnpm exec tsx scripts/utils/src/sort-yaml-stanzas-and-items.ts input.yml
 */

import fs from "node:fs";
import YAML, { isMap, isScalar, isSeq } from "yaml";
import { cmpStr } from "./yaml-helpers.js";

interface SourceTokenLike {
    readonly offset: number;
}

interface StanzaSlice {
    readonly key: string;
    readonly leading: string;
    readonly body: string;
}

interface TokenWithSource extends SourceTokenLike {
    readonly source: string;
    readonly type: string;
}

interface PairLike {
    readonly key: { readonly range?: readonly number[] } | null;
    readonly srcToken?: {
        readonly start?: readonly TokenWithSource[];
        readonly sep?: readonly TokenWithSource[];
    };
}

interface ItemSlice {
    readonly name: string;
    readonly text: string;
}

function getStanzaStart(pair: PairLike): number {
    const startTokens = pair.srcToken?.start;
    if (startTokens !== undefined && startTokens.length > 0) {
        return startTokens[0]!.offset;
    }

    const keyStart = pair.key?.range?.[0];
    if (keyStart === undefined) {
        throw new Error("Encountered a top-level YAML pair without a key range");
    }
    return keyStart;
}

function getTopLevelName(item: unknown): string | undefined {
    if (!isMap(item)) {
        return undefined;
    }
    for (const pair of item.items) {
        if (isScalar(pair.key) && pair.key.value === "name" && isScalar(pair.value) && typeof pair.value.value === "string") {
            return pair.value.value;
        }
    }
    return undefined;
}

function getItemsHeadEnd(pair: PairLike): number | undefined {
    const sepTokens = pair.srcToken?.sep;
    if (sepTokens === undefined) {
        return undefined;
    }
    for (const token of sepTokens) {
        if (token.type === "newline") {
            return token.offset + token.source.length;
        }
    }
    return undefined;
}

function getSequenceItemStart(item: {
    readonly start?: readonly TokenWithSource[];
    readonly value?: { readonly offset?: number };
}): number {
    const startTokens = item.start;
    if (startTokens !== undefined && startTokens.length > 0) {
        return startTokens[0]!.offset;
    }
    const start = item.value?.offset;
    if (start === undefined) {
        throw new Error("Encountered a YAML sequence item without a source range");
    }
    return start;
}

function sortItemsInStanzaBody(body: string): string {
    const doc = YAML.parseDocument(body, { keepSourceTokens: true });
    if (doc.errors.length > 0 || !isMap(doc.contents) || doc.contents.items.length !== 1) {
        return body;
    }

    const stanzaPair = doc.contents.items[0]!;
    if (!isMap(stanzaPair.value)) {
        return body;
    }

    let result = body;
    for (const pair of [...stanzaPair.value.items].reverse()) {
        if (!isScalar(pair.key) || pair.key.value !== "items" || !isSeq(pair.value) || pair.value.items.length <= 1) {
            continue;
        }

        const pairStart = getStanzaStart(pair);
        const headEnd = getItemsHeadEnd(pair);
        const seqEnd = pair.value.range[2];
        const seqTokens = pair.value.srcToken?.items;
        if (headEnd === undefined || seqEnd === undefined) {
            continue;
        }

        const slices: ItemSlice[] = pair.value.items.map((item: unknown, index: number, items: readonly unknown[]) => {
            const name = getTopLevelName(item);
            if (name === undefined) {
                throw new Error("Expected each YAML items entry to have a top-level string name");
            }
            const start = index === 0 ? headEnd : getSequenceItemStart(seqTokens?.[index] ?? {});
            const nextItem = items[index + 1];
            const end = nextItem !== undefined ? getSequenceItemStart(seqTokens?.[index + 1] ?? {}) : seqEnd;
            return {
                name,
                text: result.slice(start, end),
            };
        });

        const sortedItems = [...slices]
            .sort((a, b) => cmpStr(a.name, b.name))
            .reduce((text, item, index) => {
                const itemText = index === 0
                    ? item.text.replace(/^\n+/, "")
                    : (item.text.startsWith("\n") ? item.text : `\n${item.text}`);
                return `${text}${itemText}`;
            }, "");
        const head = result.slice(pairStart, headEnd);
        result = `${result.slice(0, pairStart)}${head}${sortedItems}${result.slice(seqEnd)}`;
    }

    return result;
}

export function sortYamlStanzasAndItems(source: string): string {
    const doc = YAML.parseDocument(source, { keepSourceTokens: true });
    if (doc.errors.length > 0) {
        throw new Error(doc.errors[0]!.message);
    }
    if (!isMap(doc.contents)) {
        throw new Error("Expected top-level YAML document to be a mapping");
    }

    const stanzas = doc.contents.items.map((pair, index, items): StanzaSlice => {
        if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
            throw new Error("Expected all top-level YAML keys to be scalar strings");
        }

        const start = getStanzaStart(pair);
        const keyStart = pair.key.range?.[0];
        if (keyStart === undefined) {
            throw new Error("Encountered a top-level YAML key without a source range");
        }
        const nextPair = items[index + 1];
        const end = nextPair !== undefined ? getStanzaStart(nextPair) : doc.range[2];
        return {
            key: pair.key.value,
            leading: source.slice(start, keyStart),
            body: sortItemsInStanzaBody(source.slice(keyStart, end)),
        };
    });

    const firstStart = getStanzaStart(doc.contents.items[0]!);
    const prefix = source.slice(0, firstStart);
    const sorted = [...stanzas].sort((a, b) => cmpStr(a.key, b.key));

    return sorted.reduce((result, stanza, index) => {
        const leading = index === 0 ? stanza.leading.replace(/^\n+/, "") : (stanza.leading.length > 0 ? stanza.leading : "\n");
        return `${result}${leading}${stanza.body}`;
    }, prefix);
}

/* v8 ignore start -- CLI wrapper tested via execSync integration tests */
function main(): void {
    const inputFile = process.argv[2];
    if (inputFile === undefined) {
        console.error("Usage: sort-yaml-stanzas-and-items <input.yml>");
        process.exit(1);
    }

    const source = fs.readFileSync(inputFile, "utf8");
    const sorted = sortYamlStanzasAndItems(source);
    fs.writeFileSync(inputFile, sorted, "utf8");
}

const isDirectRun = process.argv[1]?.endsWith("sort-yaml-stanzas-and-items.ts");
if (isDirectRun) {
    main();
}
/* v8 ignore stop */
