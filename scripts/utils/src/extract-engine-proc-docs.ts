/**
 * Extracts engine procedure documentation from the generated hover JSON.
 * Produces a small { name: docText } JSON for the TSSL TypeScript plugin.
 *
 * Usage:
 *   pnpm exec tsx scripts/utils/src/extract-engine-proc-docs.ts \
 *     --hover server/out/hover.fallout-ssl.json \
 *     --yaml server/data/fallout-ssl-base.yml \
 *     --out server/out/engine-proc-docs.json
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import YAML from "yaml";

/** Closing code fence that separates the signature from the doc text in hover markdown. */
const CODE_FENCE_END = "```\n";

interface HoverEntry {
    readonly contents: {
        readonly value: string;
    };
}

interface YamlItem {
    readonly name: string;
}

interface YamlStanza {
    readonly items: readonly YamlItem[];
}

function extractDocFromHover(entry: HoverEntry): string {
    const value = entry.contents?.value;
    if (!value) {
        return "";
    }
    const fenceEnd = value.indexOf(CODE_FENCE_END);
    if (fenceEnd === -1) {
        return "";
    }
    return value.slice(fenceEnd + CODE_FENCE_END.length).trim();
}

function main(): void {
    const { values } = parseArgs({
        options: {
            hover: { type: "string" },
            yaml: { type: "string" },
            out: { type: "string" },
        },
        strict: true,
    });

    if (!values.hover || !values.yaml || !values.out) {
        console.error("Usage: extract-engine-proc-docs --hover <path> --yaml <path> --out <path>");
        process.exit(1);
    }

    const hoverData = JSON.parse(fs.readFileSync(values.hover, "utf8")) as Record<string, HoverEntry>;
    const yamlData = YAML.parse(fs.readFileSync(values.yaml, "utf8")) as Record<string, YamlStanza>;

    const engineStanza = yamlData["engine-procedures"];
    if (!engineStanza) {
        console.error("No 'engine-procedures' stanza found in YAML");
        process.exit(1);
    }

    const engineNames = new Set(engineStanza.items.map((item) => item.name));
    const result: Record<string, string> = {};

    for (const name of engineNames) {
        const entry = hoverData[name];
        if (entry) {
            const doc = extractDocFromHover(entry);
            if (doc) {
                result[name] = doc;
            }
        }
    }

    fs.writeFileSync(values.out, JSON.stringify(result, null, 4), "utf8");
}

main();
