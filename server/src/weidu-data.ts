/**
 * WeiDU TP2 data building: extract function/variable symbols from headers,
 * build completion/hover/definition items for testing/validation.
 *
 * Note: Production code uses Symbols (via parseHeaderToSymbols in header-parser.ts).
 * This module is kept for format.test.ts which validates hover formatting.
 */

import { CompletionItemKind, MarkupKind } from "vscode-languageserver/node";
import * as completion from "./shared/completion";
import * as definition from "./shared/definition";
import * as hover from "./shared/hover";
import { HeaderData as LanguageHeaderData } from "./data-loader";
import { LANG_WEIDU_TP2_TOOLTIP } from "./core/languages";
import { parseHeader, parseHeaderVariables, FunctionInfo, VariableInfo } from "./weidu-tp2/header-parser";
import { CallableContext } from "./core/symbol";
import { formatTypeLink } from "./shared/weidu-types";

/** Maximum length for parameter descriptions in hover table. */
const DESC_MAX_LENGTH = 80;

/** Header data extracted from a TP2 file. */
interface WeiduHeaderData {
    functions: FunctionInfo[];
    variables: VariableInfo[];
}

/**
 * Extract function/macro and variable definitions from TP2 text using tree-sitter.
 */
function findSymbols(text: string, uri: string): WeiduHeaderData {
    const functions = parseHeader(text, uri);
    const variables = parseHeaderVariables(text, uri);
    return { functions, variables };
}


/**
 * Load file data using tree-sitter parsing.
 * @param uri File URI
 * @param text File content
 * @param filePath Cosmetic only, relative path for display
 */
export function loadFileData(uri: string, text: string, filePath: string) {
    const symbols = findSymbols(text, uri);
    const { completions, hovers, definitions } = buildLanguageData(uri, symbols.functions, filePath);
    const variableData = buildVariableData(uri, symbols.variables, filePath);

    // Merge variable data into completions/hovers/definitions
    const allCompletions = [...completions, ...variableData.completions];
    const allHovers = new Map([...hovers, ...variableData.hovers]);
    const allDefinitions = new Map([...definitions, ...variableData.definitions]);

    // Return all data - routing is handled by data-loader.ts:
    // - .tph files → completion.headers (shared across workspace)
    // - .tpa/.tpp/.tp2 files → completion.self (file-local only)
    const result: LanguageHeaderData = {
        hover: allHovers,
        completion: allCompletions,
        definition: allDefinitions,
    };
    return result;
}

/**
 * Build completion, hover, and definition data from parsed functions.
 *
 * Hover markdown example:
 *
 *     ┌─────────────────────────────────────────────────────────────────┐
 *     │ action function my_func                           ← 1. signature│
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ lib/utils.tph                                     ← 2. file path│
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ Does something useful with the given parameters.  ← 3. jsdoc    │
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │        INT vars          Description        Default             │
 *     │ int    count             Number of items    0       ← 4. table  │
 *     │        STR vars                                                 │
 *     │ string name              The name to use                        │
 *     │        RET vars                                                 │
 *     │        result                                                   │
 *     │        RET arrays                                               │
 *     │        my_array                                                 │
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ Returns int                                       ← 5. @return  │
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ ⚠️ Deprecated: Use new_func instead              ← 6. @deprecated│
 *     └─────────────────────────────────────────────────────────────────┘
 *
 * Type column links to ielib.bgforge.net for known types.
 * Description column clipped to 80 chars.
 */
function buildLanguageData(uri: string, functions: FunctionInfo[], filePath: string) {
    const langId = LANG_WEIDU_TP2_TOOLTIP;
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();

    for (const func of functions) {
        // Build JSDoc arg lookup map for type overrides
        const jsdocArgs = new Map<string, { type: string; description?: string; required?: boolean }>();
        if (func.jsdoc?.args) {
            for (const arg of func.jsdoc.args) {
                jsdocArgs.set(arg.name, { type: arg.type, description: arg.description, required: arg.required });
            }
        }

        // 4. Parameter table (INT vars, STR vars, RET vars, RET arrays)
        // TODO: Replace markdown table with a DocumentSemanticTokensProvider
        // to get syntax coloring while keeping clickable type links.
        let paramTable = "";
        if (func.params) {
            const rows: string[] = [];

            /** Truncate description to max length with ellipsis.
             * Preserves markdown links by not cutting through them.
             */
            const truncateDesc = (desc: string): string => {
                if (desc.length <= DESC_MAX_LENGTH) return desc;

                // Find all markdown links and their positions
                const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
                let match;
                const links: { start: number; end: number }[] = [];
                while ((match = linkRegex.exec(desc)) !== null) {
                    links.push({ start: match.index, end: match.index + match[0].length });
                }

                // Find a safe truncation point that doesn't cut through a link
                let cutPoint = DESC_MAX_LENGTH - 3;
                for (const link of links) {
                    // If cut point is inside a link, move it before the link
                    if (cutPoint > link.start && cutPoint < link.end) {
                        cutPoint = link.start;
                        break;
                    }
                }

                if (cutPoint <= 0) {
                    // Edge case: first link is too long, just show it without truncation
                    return desc;
                }

                return desc.slice(0, cutPoint).trimEnd() + "...";
            };

            /** Add section label and parameter rows for INT_VAR/STR_VAR. */
            const addVarSection = (
                sectionName: string,
                params: { name: string; defaultValue?: string }[],
                defaultType: string
            ) => {
                if (params.length === 0) return;

                const [word1, word2] = sectionName.split(" ");
                rows.push(`|**${word1}**|**${word2}**|||`);

                for (const p of params) {
                    const jsdoc = jsdocArgs.get(p.name);
                    const type = formatTypeLink(jsdoc?.type ?? defaultType);
                    // Hide default value for required params
                    const def = jsdoc?.required ? "" : (p.defaultValue ?? "");
                    const defCell = def ? `= ${def}` : "";
                    const desc = truncateDesc(jsdoc?.description ?? "");
                    const descCell = desc ? `&nbsp;&nbsp;${desc}` : "";
                    rows.push(`|${type}|${p.name}|${defCell}|${descCell}|`);
                }
            };

            /** Add section label and parameter rows for RET/RET_ARRAY. */
            const addRetSection = (sectionName: string, params: string[]) => {
                if (params.length === 0) return;

                const [word1, word2] = sectionName.split(" ");
                rows.push(`|**${word1}**|**${word2}**|||`);

                for (const name of params) {
                    const jsdoc = jsdocArgs.get(name);
                    const type = formatTypeLink(jsdoc?.type ?? "");
                    const desc = truncateDesc(jsdoc?.description ?? "");
                    const descCell = desc ? `&nbsp;&nbsp;${desc}` : "";
                    rows.push(`|${type}|${name}||${descCell}|`);
                }
            };

            // Single table: hidden header + separator, then sections with label rows
            rows.push("| | | | |");
            rows.push("|-:|:-|:-:|:-|");

            addVarSection("INT vars", func.params.intVar, "int");
            addVarSection("STR vars", func.params.strVar, "string");
            addRetSection("RET vars", func.params.ret);
            addRetSection("RET arrays", func.params.retArray);

            if (rows.length > 2) {
                paramTable = "\n\n" + rows.join("\n");
            }
        }

        // 1. Function signature
        const signatureLine = `${func.context} ${func.dtype} ${func.name}`;

        // 2. File path
        let markdownValue = [
            "```" + `${langId}`,
            signatureLine,
            "```",
            "```bgforge-mls-comment",
            filePath,
            "```",
        ].join("\n");

        // 3. JSDoc description
        if (func.jsdoc?.desc) {
            markdownValue += `\n\n${func.jsdoc.desc}`;
        }

        // 4. Parameter table
        markdownValue += paramTable;

        // 5. Return description (@return) - hidden if no description
        if (func.jsdoc?.ret?.description) {
            markdownValue += `\n\n**Returns** ${func.jsdoc.ret.description}`;
        }

        // 6. Deprecation notice (@deprecated)
        if (func.jsdoc?.deprecated !== undefined) {
            if (func.jsdoc.deprecated === true) {
                markdownValue += "\n\n⚠️ **Deprecated**";
            } else {
                markdownValue += `\n\n⚠️ **Deprecated:** ${func.jsdoc.deprecated}`;
            }
        }

        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };

        // Build completion item
        // Category maps to filtering: action functions only in action context, patch in patch
        const category = func.context === CallableContext.Action ? "actionFunctions" : "patchFunctions";
        const completionItem: completion.CompletionItemEx & { category: string } = {
            label: func.name,
            documentation: markdownContents,
            source: filePath,
            kind: CompletionItemKind.Function,
            labelDetails: { description: filePath },
            uri: uri,
            category,
        };
        if (func.jsdoc?.deprecated !== undefined) {
            const COMPLETION_TAG_deprecated = 1;
            completionItem.tags = [COMPLETION_TAG_deprecated];
        }
        completions.push(completionItem);

        // Build hover item
        const hoverItem = { contents: markdownContents, source: filePath, uri: uri };
        hovers.set(func.name, hoverItem);

        // Build definition location
        definitions.set(func.name, func.location);
    }

    return { completions, hovers, definitions };
}

/**
 * Build completion, hover, and definition data from parsed variables.
 * All top-level variables are included; JSDoc is optional.
 */
function buildVariableData(uri: string, variables: VariableInfo[], filePath: string) {
    const langId = LANG_WEIDU_TP2_TOOLTIP;
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();

    for (const varInfo of variables) {
        // Determine display type: JSDoc @type overrides inferred type
        const displayType = varInfo.jsdoc?.type ?? varInfo.inferredType;

        // Build signature line
        const signature = varInfo.value
            ? `${displayType} ${varInfo.name} = ${varInfo.value}`
            : `${displayType} ${varInfo.name}`;

        // Build markdown hover content
        let markdownValue = [
            "```" + `${langId}`,
            signature,
            "```",
            "```bgforge-mls-comment",
            filePath,
            "```",
        ].join("\n");

        // Add JSDoc description if available
        if (varInfo.jsdoc?.desc) {
            markdownValue += `\n\n${varInfo.jsdoc.desc}`;
        }

        // Add deprecation notice if present
        if (varInfo.jsdoc?.deprecated !== undefined) {
            if (varInfo.jsdoc.deprecated === true) {
                markdownValue += "\n\n⚠️ **Deprecated**";
            } else {
                markdownValue += `\n\n⚠️ **Deprecated:** ${varInfo.jsdoc.deprecated}`;
            }
        }

        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };

        // Build completion item
        const completionItem: completion.CompletionItemEx = {
            label: varInfo.name,
            documentation: markdownContents,
            source: filePath,
            kind: CompletionItemKind.Variable,
            labelDetails: { description: filePath },
            uri: uri,
        };
        if (varInfo.jsdoc?.deprecated !== undefined) {
            const COMPLETION_TAG_deprecated = 1;
            completionItem.tags = [COMPLETION_TAG_deprecated];
        }
        completions.push(completionItem);

        // Build hover item
        const hoverItem = { contents: markdownContents, source: filePath, uri: uri };
        hovers.set(varInfo.name, hoverItem);

        // Build definition location
        definitions.set(varInfo.name, varInfo.location);
    }

    return { completions, hovers, definitions };
}
