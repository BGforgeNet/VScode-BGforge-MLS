/**
 * Main entry point for the Fallout SSL data update script.
 * Loads sfall functions/hooks YAML and dumps completion + highlight YAML.
 *
 * Usage:
 *   pnpm exec tsx scripts/fallout-update/src/fallout-update.ts \
 *     -s <src_dir> --sfall-file <path> --highlight-file <path>
 */

import { parseArgs } from "node:util";
import {
    dumpFalloutCompletion,
    dumpFalloutHighlight,
    loadSfallFunctions,
    loadSfallHooks,
} from "./fallout/index.ts";

const { values } = parseArgs({
    options: {
        s: { type: "string", short: "s" },
        "sfall-file": { type: "string" },
        "highlight-file": { type: "string" },
    },
    strict: true,
});

const srcDir = values.s;
const sfallFile = values["sfall-file"];
const highlightFile = values["highlight-file"];

if (srcDir === undefined || sfallFile === undefined || highlightFile === undefined) {
    console.error("Usage: fallout-update -s <src_dir> --sfall-file <path> --highlight-file <path>");
    process.exit(1);
}

// Load sfall functions and hooks
const sfallFunctions = loadSfallFunctions(srcDir);
const sfallHooks = loadSfallHooks(srcDir);

// Dump completion YAML
dumpFalloutCompletion(sfallFile, sfallFunctions.completionItems, sfallHooks.completionItems);

// Dump highlight YAML
dumpFalloutHighlight(highlightFile, {
    sfallFunctionPatterns: sfallFunctions.highlightPatterns,
    hookPatterns: sfallHooks.highlightPatterns,
});
