/**
 * Hover functionality for WeiDU TP2 language.
 * Provides hover info for function parameters and variables.
 */

import { Hover, MarkupKind, Position } from "vscode-languageserver/node";
import { buildParamInfoMap } from "../shared/jsdoc";
import { getParser, isInitialized } from "./parser";
import { lookupFunction, lookupVariable, parseHeader, FunctionInfo } from "./header-parser";
import { SyntaxType } from "./tree-sitter.d";
import { stripStringDelimiters } from "./tree-utils";

/**
 * Get hover info for a function parameter in a function call.
 * Parses text to find function calls and checks if symbol is a parameter name.
 */
export function getFunctionParamHover(text: string, symbol: string, position: Position): Hover | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return null;
    }

    // Parse local function definitions as fallback for functions not in the global index
    const localFunctions = parseHeader(text, "");

    // Find function calls and check if symbol is a parameter name
    const result = findParamInFunctionCalls(tree.rootNode, symbol, position, localFunctions);
    if (!result) {
        return null;
    }

    const { paramType, defaultValue, description, required } = result;

    // Build hover content - hide default value for required params
    const showDefault = defaultValue !== undefined && !required;
    const signature = showDefault ? `${paramType} ${symbol} = ${defaultValue}` : `${paramType} ${symbol}`;

    // Build markdown documentation
    const langId = "weidu-tp2-tooltip";
    const docParts = [`\`\`\`${langId}`, signature, "```"];

    if (description) {
        docParts.push("", description);
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: docParts.join("\n"),
        },
    };
}

/**
 * Find a parameter in function calls within the AST.
 * Returns param info if found, null otherwise.
 * Only returns a match if the position is within the function call node's range.
 */
function findParamInFunctionCalls(
    node: import("web-tree-sitter").Node,
    symbol: string,
    position: Position,
    localFunctions: FunctionInfo[]
): { paramType: string; defaultValue?: string; description?: string; required?: boolean } | null {
    const type = node.type;

    // Check if this is a function call (LAF or LPF)
    if (type === SyntaxType.ActionLaunchFunction || type === SyntaxType.PatchLaunchFunction) {
        // Check if the cursor position is within this function call node's range
        const startPos = node.startPosition;
        const endPos = node.endPosition;

        const isWithinRange =
            position.line >= startPos.row &&
            position.line <= endPos.row &&
            (position.line > startPos.row || position.character >= startPos.column) &&
            (position.line < endPos.row || position.character <= endPos.column);

        if (isWithinRange) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const funcName = stripStringDelimiters(nameNode.text);
                // Try global index first (.tph headers), then local definitions (same file)
                const funcInfo = lookupFunction(funcName) ??
                    localFunctions.find(f => f.name === funcName) ?? null;

                if (funcInfo?.params) {
                    // Check each parameter section for the symbol
                    const result = findParamInFuncInfo(funcInfo, symbol);
                    if (result) {
                        return result;
                    }
                }
            }
        }
    }

    // Recurse to children
    for (const child of node.children) {
        const result = findParamInFunctionCalls(child, symbol, position, localFunctions);
        if (result) {
            return result;
        }
    }

    return null;
}

/**
 * Find a parameter by name in function info.
 * Returns type and default value if found.
 */
function findParamInFuncInfo(
    funcInfo: FunctionInfo,
    symbol: string
): { paramType: string; defaultValue?: string; description?: string; required?: boolean } | null {
    if (!funcInfo.params) {
        return null;
    }

    const paramInfoMap = buildParamInfoMap(funcInfo.jsdoc);
    const info = paramInfoMap.get(symbol);

    // Check INT_VAR
    for (const param of funcInfo.params.intVar) {
        if (param.name === symbol) {
            return { paramType: "int", defaultValue: param.defaultValue, description: info?.description, required: info?.required };
        }
    }

    // Check STR_VAR
    for (const param of funcInfo.params.strVar) {
        if (param.name === symbol) {
            return { paramType: "string", defaultValue: param.defaultValue, description: info?.description, required: info?.required };
        }
    }

    // Check RET
    for (const param of funcInfo.params.ret) {
        if (param === symbol) {
            return { paramType: "any", description: info?.description, required: info?.required };
        }
    }

    // Check RET_ARRAY
    for (const param of funcInfo.params.retArray) {
        if (param === symbol) {
            return { paramType: "array", description: info?.description, required: info?.required };
        }
    }

    return null;
}

/**
 * Get hover info for a variable from the variable index.
 * Shows type, value, and JSDoc description if available.
 */
export function getVariableHover(symbol: string): Hover | null {
    const varInfo = lookupVariable(symbol);
    if (!varInfo) {
        return null;
    }

    // Use JSDoc @type if available, otherwise inferred type
    const type = varInfo.jsdoc?.type ?? varInfo.inferredType;
    const signature = varInfo.value ? `${type} ${symbol} = ${varInfo.value}` : `${type} ${symbol}`;

    const langId = "weidu-tp2-tooltip";
    const docParts = [`\`\`\`${langId}`, signature, "```"];

    if (varInfo.jsdoc?.desc) {
        docParts.push("", varInfo.jsdoc.desc);
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: docParts.join("\n"),
        },
    };
}
