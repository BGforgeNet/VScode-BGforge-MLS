/**
 * Generates LSP completion, hover, and signature JSON files from YAML data.
 * Replaces the former generate_data.py script.
 *
 * Usage:
 *   pnpm exec tsx scripts/utils/src/generate-data.ts \
 *     -i file1.yml file2.yml \
 *     --completion out/completion.json \
 *     --hover out/hover.json \
 *     --signature out/signature.json \
 *     --tooltip-lang fallout-ssl-tooltip
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import YAML from "yaml";

// -- Types --

interface DataArg {
    readonly name: string;
    readonly type: string;
    readonly doc: string;
}

interface DataItem {
    readonly name: string;
    readonly detail?: string;
    readonly doc?: string;
    readonly args?: readonly DataArg[];
    readonly type?: string;
    readonly deprecated?: boolean;
}

interface DataStanza {
    readonly type: number;
    readonly items: readonly DataItem[];
}

type DataFile = Record<string, DataStanza>;

interface MarkupContent {
    readonly kind: "markdown";
    readonly value: string;
}

interface CompletionResult {
    readonly label: string;
    readonly kind: number;
    readonly source: "builtin";
    readonly category: string;
    readonly documentation?: MarkupContent;
    readonly tags?: readonly number[];
}

interface HoverResult {
    readonly contents: MarkupContent;
}

interface SignatureParam {
    readonly label: string;
    readonly documentation: MarkupContent;
}

interface SignatureResult {
    readonly label: string;
    readonly documentation: MarkupContent;
    readonly parameters: readonly SignatureParam[];
}

// -- Core logic (exported for testing) --

const COMPLETION_TAG_DEPRECATED = 1;

/**
 * Validates that parsed YAML data conforms to the DataFile structure.
 * Checks that each stanza has a numeric type and an items array.
 */
function validateDataFile(data: unknown, source: string): DataFile {
    if (typeof data !== "object" || data === null) {
        throw new Error(`Expected object in ${source}, got ${data === null ? "null" : typeof data}`);
    }
    const record = data as Record<string, unknown>;
    const result: Record<string, DataStanza> = {};
    for (const [key, value] of Object.entries(record)) {
        if (typeof value !== "object" || value === null) {
            throw new Error(`Expected object for stanza '${key}' in ${source}`);
        }
        const stanza = value as Record<string, unknown>;
        if (typeof stanza["type"] !== "number") {
            throw new Error(`Expected numeric 'type' in stanza '${key}' of ${source}`);
        }
        if (!Array.isArray(stanza["items"])) {
            throw new Error(`Expected 'items' array in stanza '${key}' of ${source}`);
        }
        result[key] = stanza as unknown as DataStanza;
    }
    return result;
}

/**
 * Loads and merges multiple YAML data files.
 * Later files override earlier ones (last-writer-wins per stanza key).
 */
export function loadData(yamlPaths: readonly string[]): DataFile {
    let result: DataFile = {};
    for (const ypath of yamlPaths) {
        const content = fs.readFileSync(ypath, "utf8");
        const ydata = validateDataFile(YAML.parse(content) as unknown, ypath);
        result = { ...result, ...ydata };
    }
    return result;
}

/**
 * Returns full function invocation string, e.g. "int get_sfall_arg_at(int a, ObjectPtr b)".
 * When includeTypes is false, omits types (used for signature labels).
 */
export function getDetail(item: DataItem, includeTypes = true): string {
    if (item.args !== undefined) {
        if (includeTypes) {
            const argsStr = item.args.map((a) => `${a.type} ${a.name}`).join(", ");
            return `${item.type} ${item.name}(${argsStr})`;
        }
        const argsStr = item.args.map((a) => a.name).join(", ");
        return `${item.name}(${argsStr})`;
    }
    return item.detail ?? item.name;
}

/**
 * Generates markdown documentation from item args and doc field.
 */
export function getDoc(item: DataItem): string {
    let doc = "";
    if (item.args !== undefined) {
        for (const arg of item.args) {
            doc += `- \`${arg.name}\` ${arg.doc}\n`;
        }
    }
    if (item.args !== undefined && item.doc !== undefined) {
        doc += "\n";
    }
    if (item.doc !== undefined) {
        doc += item.doc;
    }
    return doc;
}

function markdown(value: string): MarkupContent {
    return { kind: "markdown", value };
}

/**
 * Generates completion items from data stanzas.
 */
export function generateCompletion(data: DataFile, tooltipLangId: string): readonly CompletionResult[] {
    const result: CompletionResult[] = [];
    for (const [stanzaName, stanza] of Object.entries(data)) {
        const kind = stanza.type;
        for (const item of stanza.items) {
            const label = item.name;

            const detail = getDetail(item);
            const doc = getDoc(item);

            let documentation: MarkupContent | undefined;
            if (detail !== label || doc !== "") {
                let mdValue = `\`\`\`${tooltipLangId}\n${detail}\n\`\`\``;
                if (doc !== "") {
                    mdValue = `${mdValue}\n${doc}`;
                }
                documentation = markdown(mdValue);
            }

            const deprecated = item.deprecated ?? false;
            const tags = deprecated ? [COMPLETION_TAG_DEPRECATED] as const : undefined;

            const completionItem: CompletionResult = {
                label,
                kind,
                source: "builtin",
                category: stanzaName,
                ...(documentation !== undefined ? { documentation } : {}),
                ...(tags !== undefined ? { tags } : {}),
            };

            result.push(completionItem);
        }
    }
    return result;
}

/**
 * Generates hover data keyed by symbol name.
 */
export function generateHover(data: DataFile, langId: string): Record<string, HoverResult> {
    const result: Record<string, HoverResult> = {};
    for (const [, stanza] of Object.entries(data)) {
        for (const item of stanza.items) {
            // Skip items with no data besides the name
            if (item.detail === undefined && item.doc === undefined && item.args === undefined) {
                continue;
            }

            const label = item.name;
            const detail = getDetail(item);
            let value = `\`\`\`${langId}\n${detail}\n\`\`\``;
            const doc = getDoc(item);
            if (doc !== "") {
                value = `${value}\n${doc}`;
            }

            result[label] = { contents: markdown(value) };
        }
    }
    return result;
}

/**
 * Generates signature help data for items with args.
 */
export function generateSignatures(data: DataFile, langId: string): Record<string, SignatureResult> {
    const result: Record<string, SignatureResult> = {};
    for (const [, stanza] of Object.entries(data)) {
        for (const item of stanza.items) {
            if (item.args === undefined) {
                continue;
            }

            const name = item.name;
            const label = getDetail(item, false);
            const parameters: SignatureParam[] = item.args.map((arg) => ({
                label: arg.name,
                documentation: markdown(`\`\`\`${langId}\n${arg.type} ${arg.name}\n\`\`\`\n${arg.doc}`),
            }));

            const functionDoc = markdown(`---\n${item.doc}`);
            result[name] = { label, documentation: functionDoc, parameters };
        }
    }
    return result;
}

// -- CLI entry point (tested via subprocess in generate-data-cli.test.ts) --

/* v8 ignore start -- CLI wrapper tested via execSync integration tests */
function main(): void {
    const { values } = parseArgs({
        options: {
            i: { type: "string", multiple: true, short: "i" },
            hover: { type: "string" },
            completion: { type: "string" },
            signature: { type: "string" },
            "tooltip-lang": { type: "string" },
        },
        strict: true,
    });

    const inputYaml = values.i;
    const hoverFile = values.hover;
    const completionFile = values.completion;
    const signatureFile = values.signature;
    const tooltipLangId = values["tooltip-lang"];

    if (inputYaml === undefined || hoverFile === undefined || completionFile === undefined || tooltipLangId === undefined) {
        console.error("Usage: generate-data -i <yaml...> --completion <path> --hover <path> --tooltip-lang <id> [--signature <path>]");
        process.exit(1);
    }

    const inputData = loadData(inputYaml);
    const completionData = generateCompletion(inputData, tooltipLangId);
    const hoverData = generateHover(inputData, tooltipLangId);

    fs.writeFileSync(hoverFile, JSON.stringify(hoverData, null, 4), "utf8");
    fs.writeFileSync(completionFile, JSON.stringify(completionData, null, 4), "utf8");

    if (signatureFile !== undefined) {
        const signatureData = generateSignatures(inputData, tooltipLangId);
        fs.writeFileSync(signatureFile, JSON.stringify(signatureData, null, 4), "utf8");
    }
}

const isDirectRun = process.argv[1]?.endsWith("generate-data.ts");
if (isDirectRun) {
    main();
}
/* v8 ignore stop */
