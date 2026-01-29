/**
 * Common functions for dumping IElib/IESDP data to completion and highlight YAML files.
 * Handles YAML round-trip read/write (preserving comments), file discovery,
 * completion validation, and definition file generation.
 */

import fs from "node:fs";
import path from "node:path";
import YAML, { Document, Scalar, YAMLMap, YAMLSeq, isMap, isScalar } from "yaml";
import type { CompletionItem, IEData } from "./types.js";
import { COMPLETION_TYPE_CONSTANT } from "./types.js";

/**
 * Byte-level string comparison matching Python's default sort order.
 * Unlike localeCompare, this sorts by character code (e.g. '_' after 'Z').
 */
export function cmpStr(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/** YAML dump options matching the Python ruamel.yaml configuration */
const YAML_DUMP_OPTIONS = {
    lineWidth: 4096,
    indent: 2,
    indentSeq: true,
};

/**
 * Dedents text by removing common leading whitespace.
 * Equivalent to Python's textwrap.dedent(string).
 * In Python, the result is wrapped in LiteralScalarString for |- block style,
 * but that's handled by makeBlockScalar at the YAML serialization layer.
 */
export function litscal(text: string): string {
    const lines = text.split("\n");
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    if (nonEmptyLines.length === 0) {
        return text;
    }

    const minIndent = nonEmptyLines.reduce((min, line) => {
        const match = line.match(/^(\s*)/);
        const indent = match?.[1]?.length ?? 0;
        return Math.min(min, indent);
    }, Infinity);

    if (minIndent > 0 && minIndent < Infinity) {
        return lines.map((line) => line.slice(minIndent)).join("\n");
    }
    return text;
}

/**
 * Recursively walks a directory, returning files matching the given extension.
 * Optionally skips specified directories and file names.
 */
export function findFiles(
    dirPath: string,
    ext: string,
    skipDirs: readonly string[] = [],
    skipFiles: readonly string[] = ["iesdp.tph"]
): readonly string[] {
    const results: string[] = [];
    const extLower = `.${ext.toLowerCase()}`;

    function walk(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        // Sort entries alphabetically for deterministic cross-platform ordering.
        // Python's os.walk uses inode order which is filesystem-dependent;
        // alphabetical sort ensures consistent results.
        entries.sort((a, b) => cmpStr(a.name, b.name));
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!skipDirs.includes(entry.name)) {
                    walk(fullPath);
                }
            } else if (entry.isFile()) {
                const fileExt = path.extname(entry.name).toLowerCase();
                if (fileExt === extLower && !skipFiles.includes(entry.name)) {
                    results.push(fullPath);
                }
            }
        }
    }

    walk(dirPath);
    return results;
}

/**
 * Sorts strings alphabetically but with longer strings first when one is a
 * prefix of the other. Matches Python's sort_longer_first: compares char by
 * char, then uses length as tiebreaker for prefix matches.
 */
function sortLongerFirst(a: string, b: string): number {
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
        // Safe: i < minLen guarantees both a[i] and b[i] exist
        if (a[i]! < b[i]!) return -1;
        if (a[i]! > b[i]!) return 1;
    }
    // One is a prefix of the other — longer string first
    if (a.length > b.length) return -1;
    if (b.length > a.length) return 1;
    return 0;
}

/**
 * Creates a YAML Scalar node with literal block style (|-).
 * Matches Python ruamel.yaml's LiteralScalarString — always emits as a block scalar.
 */
function makeBlockScalar(doc: Document, value: string): Scalar {
    const node = doc.createNode(value);
    if (!isScalar(node)) {
        throw new Error(`Expected Scalar node for string value, got ${typeof node}`);
    }
    node.type = Scalar.BLOCK_LITERAL;
    return node;
}

/**
 * Creates a YAML sequence node for completion items.
 * When forceBlockDoc is true, all doc fields use |- block scalar style
 * (matching Python's LiteralScalarString for action/function docs).
 * When false, only multiline doc values get block style (for offset docs).
 */
export function createItemsSeq(
    doc: Document,
    items: readonly CompletionItem[],
    forceBlockDoc = false,
): YAMLSeq {
    const seq = new YAMLSeq();
    for (const item of items) {
        const map = new YAMLMap();
        map.add(doc.createPair("name", item.name));
        map.add(doc.createPair("detail", item.detail));
        // Strip trailing whitespace from each line of the doc
        const cleanDoc = item.doc.replace(/ +$/gm, "");
        const docValue = forceBlockDoc || cleanDoc.includes("\n")
            ? makeBlockScalar(doc, cleanDoc)
            : cleanDoc;
        map.add(doc.createPair("doc", docValue));
        if (item.type !== undefined) {
            map.add(doc.createPair("type", item.type));
        }
        seq.add(map);
    }
    return seq;
}

/**
 * Dumps IE data into a completion YAML file.
 * Clears all existing stanzas and writes fresh data to avoid leftover stanzas
 * from previous code versions with different naming conventions.
 */
export function dumpCompletion(fpath: string, iedata: IEData): void {
    const doc = new Document();

    for (const [, ied] of Object.entries(iedata)) {
        const stanza = ied.stanza;
        const ctype = ied.completion_type ?? COMPLETION_TYPE_CONSTANT;

        const stanzaMap = new YAMLMap();
        stanzaMap.add(doc.createPair("type", ctype));

        const sortedItems = [...ied.items].sort((a, b) => cmpStr(a.name, b.name));
        const itemsSeq = createItemsSeq(doc, sortedItems, ied.blockDoc === true);
        stanzaMap.add(doc.createPair("items", itemsSeq));

        if (!isMap(doc.contents)) {
            doc.contents = new YAMLMap();
        }
        if (!isMap(doc.contents)) {
            throw new Error("Failed to initialize document contents as YAMLMap");
        }
        doc.contents.add(doc.createPair(stanza, stanzaMap));
    }

    checkCompletion(doc);

    const output = doc.toString(YAML_DUMP_OPTIONS);
    fs.writeFileSync(fpath, output, "utf8");
}

/**
 * Validates that no completion item names are duplicated across stanzas.
 * Allows specific known duplicates (e.g. EVALUATE_BUFFER).
 */
export function checkCompletion(doc: Document): void {
    const items: string[] = [];
    const allowDupes = ["EVALUATE_BUFFER"];

    if (isMap(doc.contents)) {
        for (const pair of doc.contents.items) {
            const stanzaNode = pair.value;
            if (!isMap(stanzaNode)) {
                continue;
            }
            const itemsNode = stanzaNode.get("items", true);
            if (itemsNode instanceof YAMLSeq) {
                for (const item of itemsNode.items) {
                    if (isMap(item)) {
                        const nameNode = item.get("name", true);
                        if (isScalar(nameNode) && typeof nameNode.value === "string") {
                            items.push(nameNode.value);
                        }
                    }
                }
            }
        }
    }

    const counts = new Map<string, number>();
    for (const name of items) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const uniqueDupes = [...counts.entries()]
        .filter(([name, count]) => count > 1 && !allowDupes.includes(name))
        .map(([name]) => name);

    if (uniqueDupes.length > 0) {
        throw new Error(`Duplicated completion items found: ${JSON.stringify(uniqueDupes)}`);
    }
}

/**
 * Dumps IE data into a syntax highlight YAML file (round-trip preserving structure).
 * Updates repository stanzas with match patterns for each item.
 */
export function dumpHighlight(fpath: string, iedata: IEData): void {
    const content = fs.readFileSync(fpath, "utf8");
    const doc = YAML.parseDocument(content);

    const repository = doc.getIn(["repository"], true);
    if (!isMap(repository)) {
        throw new Error(`Expected 'repository' map in ${fpath}`);
    }

    for (const [, ied] of Object.entries(iedata)) {
        const stanza = ied.highlightStanza ?? ied.stanza;

        if (!repository.has(stanza)) {
            const stanzaMap = new YAMLMap();
            stanzaMap.add(doc.createPair("name", ied.scope));
            repository.add(doc.createPair(stanza, stanzaMap));
        }

        const stanzaNode = repository.get(stanza, true);
        if (isMap(stanzaNode)) {
            stanzaNode.set("name", ied.scope);
        }

        const isStringCategory = ied.string === true;

        const itemNames = ied.items.map((x) => x.name);
        const sortedNames = [...itemNames].sort(sortLongerFirst);

        const wordPatterns = sortedNames.map((name) => ({ match: `\\b(${name})\\b` }));
        const patternsSeq = doc.createNode(isStringCategory
            ? [...sortedNames.map((n) => ({ match: `(%${n}%)` })), ...wordPatterns]
            : wordPatterns);

        if (isMap(stanzaNode)) {
            stanzaNode.set("patterns", patternsSeq);
        }
    }

    const output = doc.toString(YAML_DUMP_OPTIONS);
    fs.writeFileSync(fpath, output, "utf8");
}

/**
 * Writes definition constants to a TPP file in the IElib structures directory.
 * Creates the output directory if it doesn't exist.
 *
 * @param prefix - File format prefix (e.g. "EFF_V2_"), used to derive directory name
 * @param items - Map of constant name to hex value
 * @param structuresDir - Path to ielib/structures
 */
export function dumpDefinition(
    prefix: string,
    items: Map<string, string>,
    structuresDir: string
): void {
    const outputDir = path.join(structuresDir, prefix.toLowerCase().replaceAll("_", ""));
    const outputFile = path.join(outputDir, "iesdp.tpp");
    fs.mkdirSync(outputDir, { recursive: true });

    const sortedEntries = [...items.entries()].sort(([a], [b]) => cmpStr(a, b));
    const text = sortedEntries.map(([name, value]) => `${name} = ${value}`).join("\n") + "\n";
    fs.writeFileSync(outputFile, text + "\n", "utf8");
}

/**
 * Removes Jekyll/Liquid template tags from text.
 */
export function stripLiquid(text: string): string {
    return text
        .replace(/{% capture note %}/g, "")
        .replace(/{% endcapture %} {% include note\.html %}/g, "")
        .replace(/{% endcapture %} {% include info\.html %}/g, "");
}
