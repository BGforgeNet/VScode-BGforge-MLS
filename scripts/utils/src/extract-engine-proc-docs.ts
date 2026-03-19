/**
 * Extracts engine procedure data from the generated hover JSON and YAML source.
 * Produces two outputs:
 *   --out:   { name: docText } JSON for the TSSL TypeScript plugin (hover docs)
 *   --names: sorted string array of procedure names (used by server for tree-shaking
 *            and by the plugin for TS6133 diagnostic suppression)
 *
 * Single source of truth: server/data/fallout-ssl-base.yml (engine_procedures stanza).
 *
 * Usage:
 *   pnpm exec tsx scripts/utils/src/extract-engine-proc-docs.ts \
 *     --hover server/out/hover.fallout-ssl.json \
 *     --yaml server/data/fallout-ssl-base.yml \
 *     --out server/out/engine-proc-docs.json \
 *     --names server/out/engine-procedures.json
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
            names: { type: "string" },
        },
        strict: true,
    });

    if (!values.hover || !values.yaml || !values.out || !values.names) {
        console.error("Usage: extract-engine-proc-docs --hover <path> --yaml <path> --out <path> --names <path>");
        process.exit(1);
    }

    for (const [flag, filePath] of [["--hover", values.hover], ["--yaml", values.yaml]] as const) {
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath} (${flag}). Run the data generation step first.`);
            process.exit(1);
        }
    }

    const hoverData = JSON.parse(fs.readFileSync(values.hover, "utf8")) as Record<string, HoverEntry>;
    const yamlData = YAML.parse(fs.readFileSync(values.yaml, "utf8")) as Record<string, YamlStanza>;

    const engineStanza = yamlData["engine_procedures"];
    if (!engineStanza) {
        console.error("No 'engine_procedures' stanza found in YAML");
        process.exit(1);
    }

    const engineNames = engineStanza.items.map((item) => item.name).sort();

    // Build docs as immutable object from entries
    const docs: Readonly<Record<string, string>> = Object.fromEntries(
        engineNames
            .map((name) => {
                const entry = hoverData[name];
                return entry ? [name, extractDocFromHover(entry)] as const : undefined;
            })
            .filter((pair): pair is readonly [string, string] => pair !== undefined && pair[1] !== "")
    );

    fs.writeFileSync(values.out, JSON.stringify(docs, null, 4), "utf8");
    fs.writeFileSync(values.names, JSON.stringify(engineNames, null, 4), "utf8");
}

main();
