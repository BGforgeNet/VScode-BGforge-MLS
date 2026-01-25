/**
 * Parameter completion for WeiDU TP2 function calls.
 * Provides completions for function parameters based on function definitions.
 */

import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver/node";
import { buildParamInfoMap, type ParamDisplayInfo } from "../../shared/jsdoc";
import { lookupFunction } from "../header-parser";
import type { FuncParamsContext } from "./types";

/**
 * Generate parameter completions for a function call.
 * Looks up the function definition and returns completions for unused parameters.
 */
export function getParamCompletions(context: FuncParamsContext): CompletionItem[] {
    const { functionName, paramSection, usedParams } = context;

    // Look up function definition
    const funcInfo = lookupFunction(functionName);
    if (!funcInfo || !funcInfo.params) {
        // Function not found or has no params (it's a macro)
        return [];
    }

    const usedSet = new Set(usedParams);
    const completions: CompletionItem[] = [];
    const paramInfoMap = buildParamInfoMap(funcInfo.jsdoc);

    // Get the appropriate param list based on section
    switch (paramSection) {
        case "INT_VAR": {
            const params = funcInfo.params.intVar;
            for (const param of params) {
                if (!usedSet.has(param.name)) {
                    completions.push(createParamCompletion(param.name, "int", param.defaultValue, paramInfoMap.get(param.name)));
                }
            }
            break;
        }
        case "STR_VAR": {
            const params = funcInfo.params.strVar;
            for (const param of params) {
                if (!usedSet.has(param.name)) {
                    completions.push(createParamCompletion(param.name, "string", param.defaultValue, paramInfoMap.get(param.name)));
                }
            }
            break;
        }
        case "RET": {
            const params = funcInfo.params.ret;
            for (const param of params) {
                if (!usedSet.has(param)) {
                    completions.push(createParamCompletion(param, "any", undefined, paramInfoMap.get(param)));
                }
            }
            break;
        }
        case "RET_ARRAY": {
            const params = funcInfo.params.retArray;
            for (const param of params) {
                if (!usedSet.has(param)) {
                    completions.push(createParamCompletion(param, "array", undefined, paramInfoMap.get(param)));
                }
            }
            break;
        }
    }

    return completions;
}

/**
 * Create a parameter completion item with documentation.
 * Format: "type name = default" for optional params, "type name" for required.
 */
function createParamCompletion(name: string, type: string, defaultValue?: string, info?: ParamDisplayInfo): CompletionItem {
    // Build signature line - hide default value for required params
    const showDefault = defaultValue !== undefined && !info?.required;
    const signature = showDefault ? `${type} ${name} = ${defaultValue}` : `${type} ${name}`;

    // Build markdown documentation
    const langId = "weidu-tp2-tooltip";
    const docParts = [`\`\`\`${langId}`, signature, "```"];

    if (info?.description) {
        docParts.push("", info.description);
    }

    const item: CompletionItem = {
        label: name,
        kind: CompletionItemKind.Field,
        insertText: `${name} = `,
        insertTextFormat: InsertTextFormat.PlainText,
        documentation: {
            kind: MarkupKind.Markdown,
            value: docParts.join("\n"),
        },
    };

    return item;
}
