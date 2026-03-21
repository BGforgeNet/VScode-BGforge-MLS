/**
 * Updates weidu-tp2.tmLanguage.yml highlight stanzas (actions, patches,
 * flags, options, etc.) from server/data/weidu-tp2-base.yml.
 *
 * Generates sorted \b(NAME)\b patterns from YAML data stanzas, replacing
 * the hand-maintained pattern lists. Non-match entries (include directives)
 * are preserved at the end of each stanza.
 *
 * Usage:
 *   pnpm exec tsx scripts/utils/src/update-tp2-highlight.ts \
 *     --yaml server/data/weidu-tp2-base.yml \
 *     --highlight syntaxes/weidu-tp2.tmLanguage.yml
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import YAML, { type Document, isMap, isScalar, isSeq } from "yaml";
import { type DataFile, loadData } from "./generate-data.ts";
import { cmpStr, YAML_DUMP_OPTIONS } from "./yaml-helpers.ts";

interface HighlightPattern {
    readonly match: string;
    readonly name?: string;
}

/**
 * Matches identifiers already caught by the upper-case-constants catch-all rule
 * in the TextMate grammar. Items matching this pattern can be skipped from
 * generated stanzas that share the same constant.language scope family.
 */
const UPPER_CASE_CATCHALL = /^[A-Z][A-Z0-9]+_\w+$/;

interface StanzaConfig {
    readonly repoKey: string;
    /** When true, skip items whose names match the upper-case-constants catch-all. */
    readonly skipCatchall?: boolean;
}

/** Stanza-to-TextMate mapping: YAML data stanza name -> TextMate config. */
const STANZA_MAP: ReadonlyMap<string, StanzaConfig> = new Map([
    ["action", { repoKey: "weidu-tp2-action" }],
    ["array_sort_type", { repoKey: "weidu-tp2-arrarindicessorttype" }],
    ["caching", { repoKey: "weidu-tp2-caching" }],
    ["component_flag", { repoKey: "weidu-tp2-component-flag" }],
    ["flag", { repoKey: "weidu-tp2-flag" }],
    ["language", { repoKey: "weidu-tp2-language" }],
    ["opt_case", { repoKey: "weidu-tp2-optcase" }],
    ["opt_exact", { repoKey: "weidu-tp2-optexact" }],
    ["opt_glob", { repoKey: "weidu-tp2-optglob" }],
    ["patch", { repoKey: "weidu-tp2-patch" }],
    ["patch_byte", { repoKey: "weidu-tp2-patch-byte" }],
    ["patch_long", { repoKey: "weidu-tp2-patch-long" }],
    ["patch_string", { repoKey: "weidu-tp2-patch-string" }],
    ["prologue", { repoKey: "weidu-tp2-file" }],
    ["value_constant", { repoKey: "infinity-constants", skipCatchall: true }],
    ["value_function", { repoKey: "weidu-tp2-values" }],
    // value_operator not generated — TextMate stanza has non-word-boundary operator regexes
    ["when", { repoKey: "weidu-tp2-when" }],
]);

export function buildTp2HighlightPatterns(
    data: DataFile,
    stanzaName: string,
    skipCatchall = false,
): readonly HighlightPattern[] {
    const stanza = data[stanzaName];
    if (stanza === undefined) {
        throw new Error(`Stanza '${stanzaName}' not found`);
    }

    return stanza.items
        .filter((item) => !skipCatchall || !UPPER_CASE_CATCHALL.test(item.name))
        .map((item): HighlightPattern => ({
            match: `\\b(${item.name})\\b`,
            ...(item.deprecated !== undefined ? { name: "invalid.deprecated.bgforge" } : {}),
        }))
        .sort((a, b) => cmpStr(a.match, b.match));
}

/**
 * Replaces match patterns in a TextMate repository stanza, preserving
 * non-match entries (include directives) at the end.
 */
function updateHighlightStanza(
    doc: Document,
    repositoryKey: string,
    patterns: readonly HighlightPattern[],
): void {
    const stanzaNode = doc.getIn(["repository", repositoryKey], true);
    if (!isMap(stanzaNode)) {
        throw new Error(`Expected 'repository.${repositoryKey}' map`);
    }

    const patternsNode = stanzaNode.get("patterns", true);
    if (!isSeq(patternsNode)) {
        throw new Error(`Expected 'patterns' seq in repository.${repositoryKey}`);
    }

    // Collect non-match items (e.g. include directives) to preserve at the end
    const preserved: unknown[] = [];
    for (const item of patternsNode.items) {
        if (!isMap(item)) continue;
        const hasMatch = item.items.some(
            (pair) => isScalar(pair.key) && pair.key.value === "match",
        );
        if (!hasMatch) {
            preserved.push(item.toJSON());
        }
    }

    const allItems = [...patterns, ...preserved];
    const newPatterns = doc.createNode(allItems);
    stanzaNode.set("patterns", newPatterns);
}

export function updateTp2Highlight(yamlPath: string, highlightPath: string): void {
    const data = loadData([yamlPath]);
    const content = fs.readFileSync(highlightPath, "utf8");
    // Cast to Document to avoid ParsedNode generic constraints on set()
    const doc = YAML.parseDocument(content) as Document;

    for (const [stanzaName, config] of STANZA_MAP) {
        const patterns = buildTp2HighlightPatterns(data, stanzaName, config.skipCatchall);
        updateHighlightStanza(doc, config.repoKey, patterns);
    }

    fs.writeFileSync(highlightPath, doc.toString(YAML_DUMP_OPTIONS), "utf8");
}

/* v8 ignore start -- CLI wrapper tested via integration tests */
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
        console.error("Usage: update-tp2-highlight --yaml <base.yml> --highlight <tmLanguage.yml>");
        process.exit(1);
    }

    updateTp2Highlight(yamlPath, highlightPath);
}

const isDirectRun = process.argv[1]?.endsWith("update-tp2-highlight.ts");
if (isDirectRun) {
    main();
}
/* v8 ignore stop */
