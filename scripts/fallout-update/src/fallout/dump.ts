/**
 * Dumps completion and highlight YAML files for Fallout SSL.
 * Both operations are round-trip: they read the existing file, update specific
 * stanzas, and write back — preserving all other content and comments.
 *
 * Shared helpers (makeBlockScalar, YAML_DUMP_OPTIONS) are in utils/yaml-helpers.
 */

import fs from "node:fs";
import YAML, { Document, YAMLMap, YAMLSeq, isMap } from "yaml";
import { makeBlockScalar, YAML_DUMP_OPTIONS } from "../../../utils/src/yaml-helpers.js";
import type { FalloutCompletionItem, FalloutHighlightDumpInput, HighlightPattern } from "./types.js";
import {
    COMPLETION_TYPE_CONSTANT,
    COMPLETION_TYPE_FUNCTION,
    GENERATED_FALLOUT_BASE_FUNCTIONS_COMMENT,
    HIGHLIGHT_STANZAS,
    SFALL_FUNCTIONS_STANZA,
    SFALL_HOOKS_STANZA,
} from "./types.js";

/**
 * Creates a YAML sequence of completion items for the sfall_functions stanza.
 * Doc fields use block scalar style (|-) for multiline content.
 */
function createCompletionSeq(
    doc: Document,
    items: readonly FalloutCompletionItem[],
): YAMLSeq {
    const seq = new YAMLSeq();
    for (const item of items) {
        const map = new YAMLMap();
        map.add(doc.createPair("name", item.name));

        if (item.detail !== undefined) {
            map.add(doc.createPair("detail", item.detail));
        }

        if (item.doc !== undefined) {
            const cleanDoc = item.doc.replace(/ +$/gm, "");
            const docValue = makeBlockScalar(doc, cleanDoc);
            map.add(doc.createPair("doc", docValue));
        }

        if (item.args !== undefined) {
            map.add(doc.createPair("args", doc.createNode(item.args)));
            map.add(doc.createPair("type", item.type));
        }

        seq.add(map);
    }
    return seq;
}

/**
 * Dumps sfall completion data into the completion YAML file (round-trip).
 * Updates the sfall_functions and hooks stanzas, preserving all other content.
 */
export function dumpFalloutCompletion(
    fpath: string,
    sfallFunctions: readonly FalloutCompletionItem[],
    sfallHooks: readonly FalloutCompletionItem[],
): void {
    const content = fs.readFileSync(fpath, "utf8");
    // Cast to Document to avoid ParsedNode generic constraints on set()
    const doc = YAML.parseDocument(content) as Document;

    const contents = doc.contents;
    if (!isMap(contents)) {
        throw new Error(`Expected map contents in ${fpath}`);
    }

    // Update sfall_functions stanza
    const functionsMap = new YAMLMap();
    functionsMap.add(doc.createPair("type", COMPLETION_TYPE_FUNCTION));
    functionsMap.add(doc.createPair("items", createCompletionSeq(doc, sfallFunctions)));
    contents.set(SFALL_FUNCTIONS_STANZA, functionsMap);

    // Update hooks stanza
    const hooksMap = new YAMLMap();
    hooksMap.add(doc.createPair("type", COMPLETION_TYPE_CONSTANT));
    hooksMap.add(doc.createPair("items", createCompletionSeq(doc, sfallHooks)));
    contents.set(SFALL_HOOKS_STANZA, hooksMap);

    const output = doc.toString(YAML_DUMP_OPTIONS);
    fs.writeFileSync(fpath, output, "utf8");
}

/**
 * Dumps highlight patterns into the syntax highlight YAML file (round-trip).
 * Updates repository stanzas for sfall functions, hooks, and header defines,
 * preserving all other repository content.
 */
export function dumpFalloutHighlight(
    fpath: string,
    {
        baseFunctionPatterns,
        sfallFunctionPatterns,
        hookPatterns,
        headerDefines,
    }: FalloutHighlightDumpInput,
): void {
    const content = fs.readFileSync(fpath, "utf8");
    // Cast to Document to avoid ParsedNode generic constraints on set()
    const doc = YAML.parseDocument(content) as Document;

    const repository = doc.getIn(["repository"], true);
    if (!isMap(repository)) {
        throw new Error(`Expected 'repository' map in ${fpath}`);
    }

    // Partition header defines by kind
    const headerConstants: HighlightPattern[] = [];
    const headerVariables: HighlightPattern[] = [];
    const headerProcedures: HighlightPattern[] = [];
    const headerDefinesWithVars: HighlightPattern[] = [];
    const headerAliases: HighlightPattern[] = [];

    if (headerDefines !== undefined) {
        for (const [name, kind] of headerDefines) {
            const pattern = { match: `\\b(${name})\\b` };
            switch (kind) {
                case "variable":
                    headerVariables.push(pattern);
                    break;
                case "constant":
                    headerConstants.push(pattern);
                    break;
                case "define_with_vars":
                    headerDefinesWithVars.push(pattern);
                    break;
                case "alias":
                    headerAliases.push(pattern);
                    break;
                case "procedure":
                    headerProcedures.push(pattern);
                    break;
            }
        }
    }

    // Update each stanza's patterns
    const stanzaData: Array<readonly [string, readonly HighlightPattern[]]> = [];
    if (baseFunctionPatterns !== undefined) stanzaData.push([HIGHLIGHT_STANZAS.falloutBaseFunctions, baseFunctionPatterns]);
    if (sfallFunctionPatterns !== undefined) stanzaData.push([HIGHLIGHT_STANZAS.sfallFunctions, sfallFunctionPatterns]);
    if (hookPatterns !== undefined) stanzaData.push([HIGHLIGHT_STANZAS.hooks, hookPatterns]);
    if (headerDefines !== undefined) {
        stanzaData.push([HIGHLIGHT_STANZAS.headerConstants, headerConstants]);
        stanzaData.push([HIGHLIGHT_STANZAS.headerVariables, headerVariables]);
        stanzaData.push([HIGHLIGHT_STANZAS.headerProcedures, headerProcedures]);
        stanzaData.push([HIGHLIGHT_STANZAS.headerDefinesWithVars, headerDefinesWithVars]);
        stanzaData.push([HIGHLIGHT_STANZAS.headerAliases, headerAliases]);
    }

    for (const [stanza, patterns] of stanzaData) {
        const stanzaNode = repository.get(stanza, true);
        if (isMap(stanzaNode)) {
            const patternsSeq = doc.createNode(patterns);
            stanzaNode.set("patterns", patternsSeq);
            if (stanza === HIGHLIGHT_STANZAS.falloutBaseFunctions) {
                stanzaNode.commentBefore = GENERATED_FALLOUT_BASE_FUNCTIONS_COMMENT;
            }
        }
    }

    const output = doc.toString(YAML_DUMP_OPTIONS);
    fs.writeFileSync(fpath, output, "utf8");
}
