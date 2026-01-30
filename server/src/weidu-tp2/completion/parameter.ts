/**
 * Parameter completion for WeiDU TP2 function calls.
 * Provides completions for function parameters based on function definitions.
 */

import { CompletionItemKind, InsertTextFormat, MarkupKind } from "vscode-languageserver/node";
import { isCallableSymbol, type CallableParam } from "../../core/symbol";
import { getSymbols } from "../provider";
import { CompletionCategory, ParamSection, type FuncParamsContext, type Tp2CompletionItem } from "./types";

/**
 * Generate parameter completions for a function call.
 * Looks up the function definition and returns completions for unused parameters.
 */
export function getParamCompletions(context: FuncParamsContext): Tp2CompletionItem[] {
    const { functionName, paramSection, usedParams } = context;

    // Look up function definition from unified symbol storage
    const symbols = getSymbols();
    const symbol = symbols?.lookup(functionName);
    if (!symbol || !isCallableSymbol(symbol) || !symbol.callable.params) {
        // Function not found or has no params (it's a macro)
        return [];
    }

    const params = symbol.callable.params;
    const usedSet = new Set(usedParams);
    const completions: Tp2CompletionItem[] = [];

    // Get the appropriate param list based on section
    // CallableParam already has JSDoc data merged (type, description, required)
    switch (paramSection) {
        case ParamSection.IntVar: {
            for (const param of params.intVar) {
                if (!usedSet.has(param.name)) {
                    completions.push(createParamCompletion(param));
                }
            }
            break;
        }
        case ParamSection.StrVar: {
            for (const param of params.strVar) {
                if (!usedSet.has(param.name)) {
                    completions.push(createParamCompletion(param));
                }
            }
            break;
        }
        case ParamSection.Ret: {
            for (const name of params.ret) {
                if (!usedSet.has(name)) {
                    // RET params are just names - no type/default info available
                    completions.push(createParamCompletion({ name, type: "any" }));
                }
            }
            break;
        }
        case ParamSection.RetArray: {
            for (const name of params.retArray) {
                if (!usedSet.has(name)) {
                    completions.push(createParamCompletion({ name, type: "array" }));
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
 * Uses CallableParam which already has JSDoc data merged (type, description, required).
 */
function createParamCompletion(param: CallableParam): Tp2CompletionItem {
    const { name, type, defaultValue, description, required } = param;

    // Build signature line - hide default value for required params
    const showDefault = defaultValue !== undefined && !required;
    const signature = showDefault ? `${type ?? ""} ${name} = ${defaultValue}` : `${type ?? ""} ${name}`;

    // Build markdown documentation
    const langId = "weidu-tp2-tooltip";
    const docParts = [`\`\`\`${langId}`, signature, "```"];

    if (description) {
        docParts.push("", description);
    }

    const item: Tp2CompletionItem = {
        label: name,
        kind: CompletionItemKind.Field,
        insertText: `${name} = `,
        insertTextFormat: InsertTextFormat.PlainText,
        documentation: {
            kind: MarkupKind.Markdown,
            value: docParts.join("\n"),
        },
        category: CompletionCategory.FuncVarKeyword,
    };

    return item;
}
