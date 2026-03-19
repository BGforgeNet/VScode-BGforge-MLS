/**
 * Updates syntaxes/fallout-ssl.tmLanguage.yml's fallout-base-functions stanza
 * from active function stanzas in server/data/fallout-ssl-base.yml.
 *
 * Usage:
 *   pnpm exec tsx scripts/utils/src/update-fallout-base-functions-highlight.ts \
 *     --yaml server/data/fallout-ssl-base.yml \
 *     --highlight syntaxes/fallout-ssl.tmLanguage.yml
 */

import { parseArgs } from "node:util";
import { dumpFalloutHighlight } from "../../fallout-update/src/fallout/dump.js";
import type { HighlightPattern } from "../../fallout-update/src/fallout/types.js";
import { loadData } from "./generate-data.ts";
import { cmpStr } from "./yaml-helpers.js";
import { FALLOUT_SSL_BUILTIN_FUNCTION_STANZAS } from "../../../shared/stanza-names.js";

export function buildFalloutBaseFunctionPatterns(yamlPath: string): readonly HighlightPattern[] {
    const data = loadData([yamlPath]);
    const seen = new Set<string>();
    const patternsByName = new Map<string, HighlightPattern>();

    for (const stanzaName of FALLOUT_SSL_BUILTIN_FUNCTION_STANZAS) {
        const stanza = data[stanzaName];
        if (stanza === undefined) continue;
        for (const item of stanza.items) {
            if (seen.has(item.name)) continue;
            seen.add(item.name);
            patternsByName.set(item.name, {
                match: `\\b(?i)(${item.name})\\b`,
                ...(item.deprecated !== undefined ? { name: "invalid.deprecated.bgforge" } : {}),
            });
        }
    }

    return [...patternsByName.entries()]
        .sort(([a], [b]) => cmpStr(a, b))
        .map(([, pattern]) => pattern);
}

function main(): void {
    const { values } = parseArgs({
        options: {
            yaml: { type: "string" },
            highlight: { type: "string" },
        },
        strict: true,
    });

    const yamlPath = values.yaml;
    const highlightPath = values.highlight;
    if (yamlPath === undefined || highlightPath === undefined) {
        console.error("Usage: update-fallout-base-functions-highlight --yaml <base.yml> --highlight <tmLanguage.yml>");
        process.exit(1);
    }

    const basePatterns = buildFalloutBaseFunctionPatterns(yamlPath);
    dumpFalloutHighlight(highlightPath, { baseFunctionPatterns: basePatterns });
}

const isDirectRun = process.argv[1]?.endsWith("update-fallout-base-functions-highlight.ts");
if (isDirectRun) {
    main();
}
