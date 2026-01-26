/**
 * Hover functionality for WeiDU TP2 language.
 * Provides hover builders for functions and variables (used during symbol conversion).
 * Also provides hover info for function parameters at call sites.
 */

import { Hover, MarkupKind, Position } from "vscode-languageserver/node";
import { isCallableSymbol, type CallableInfo } from "../core/symbol";
import { buildParamInfoMap } from "../shared/jsdoc";
import { parseWithCache, isInitialized } from "./parser";
import { parseHeader, FunctionInfo, VariableInfo } from "./header-parser";
import { getSymbols } from "./provider";
import { SyntaxType } from "./tree-sitter.d";
import { stripStringDelimiters } from "./tree-utils";

/** Known types that link to ielib documentation. */
const KNOWN_TYPES = new Set(["array", "bool", "ids", "int", "list", "map", "resref", "string", "filename"]);

/** Base URL for type documentation. */
const IELIB_TYPES_URL = "https://ielib.bgforge.net/types/#";

/** Maximum length for parameter descriptions in hover table. */
const DESC_MAX_LENGTH = 80;

/**
 * Get hover info for a function parameter in a function call.
 * Parses text to find function calls and checks if symbol is a parameter name.
 */
export function getFunctionParamHover(text: string, symbol: string, position: Position): Hover | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
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

                // Try unified symbol storage first (.tph headers)
                const symbols = getSymbols();
                const indexedSymbol = symbols?.lookup(funcName);
                if (indexedSymbol && isCallableSymbol(indexedSymbol) && indexedSymbol.callable.params) {
                    const result = findParamInCallableInfo(indexedSymbol.callable, symbol);
                    if (result) {
                        return result;
                    }
                }

                // Fall back to local definitions (same file)
                const localFunc = localFunctions.find(f => f.name === funcName);
                if (localFunc?.params) {
                    const result = findParamInFuncInfo(localFunc, symbol);
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
 * Find a parameter by name in CallableInfo (from Symbols).
 * CallableInfo.params already has JSDoc data merged (type, description, required).
 */
function findParamInCallableInfo(
    callable: CallableInfo,
    symbol: string
): { paramType: string; defaultValue?: string; description?: string; required?: boolean } | null {
    if (!callable.params) {
        return null;
    }

    // Check INT_VAR - CallableParam already has JSDoc merged
    for (const param of callable.params.intVar) {
        if (param.name === symbol) {
            return {
                paramType: param.type ?? "int",
                defaultValue: param.defaultValue,
                description: param.description,
                required: param.required,
            };
        }
    }

    // Check STR_VAR
    for (const param of callable.params.strVar) {
        if (param.name === symbol) {
            return {
                paramType: param.type ?? "string",
                defaultValue: param.defaultValue,
                description: param.description,
                required: param.required,
            };
        }
    }

    // Check RET - just names, no JSDoc metadata in params
    for (const name of callable.params.ret) {
        if (name === symbol) {
            return { paramType: "any" };
        }
    }

    // Check RET_ARRAY
    for (const name of callable.params.retArray) {
        if (name === symbol) {
            return { paramType: "array" };
        }
    }

    return null;
}

/**
 * Build hover content from FunctionInfo.
 * Exported for use in symbol conversion.
 *
 * Hover markdown structure:
 *   1. Signature line: action function my_func
 *   2. File path (workspace-relative via displayPath, skipped if null)
 *   3. JSDoc description
 *   4. Parameter table with @arg data (type links, descriptions, defaults)
 *   5. @return type display
 *   6. @deprecated notice
 *
 * @param funcInfo Function definition info
 * @param displayPath Path to show in hover:
 *   - `undefined` = extract filename from URI (default)
 *   - `string` = use provided path
 *   - `null` = skip path block entirely (for local symbols)
 */
export function buildFunctionHover(funcInfo: FunctionInfo, displayPath?: string | null): Hover {
    const langId = "weidu-tp2-tooltip";

    // Build JSDoc arg lookup map for type overrides
    const jsdocArgs = new Map<string, { type: string; description?: string; required?: boolean }>();
    if (funcInfo.jsdoc?.args) {
        for (const arg of funcInfo.jsdoc.args) {
            jsdocArgs.set(arg.name, { type: arg.type, description: arg.description, required: arg.required });
        }
    }

    // 1. Function signature
    const signatureLine = `${funcInfo.context} ${funcInfo.dtype} ${funcInfo.name}`;

    // 2. File path block (skip if displayPath === null)
    let markdownValue: string;
    if (displayPath === null) {
        // Local symbol - no path block
        markdownValue = [
            "```" + `${langId}`,
            signatureLine,
            "```",
        ].join("\n");
    } else {
        // Header/indexed symbol - include path
        const filePath = displayPath ?? extractFilename(funcInfo.location.uri);
        markdownValue = [
            "```" + `${langId}`,
            signatureLine,
            "```",
            "```bgforge-mls-comment",
            filePath,
            "```",
        ].join("\n");
    }

    // 3. JSDoc description
    if (funcInfo.jsdoc?.desc) {
        markdownValue += `\n\n${funcInfo.jsdoc.desc}`;
    }

    // 4. Parameter table (INT vars, STR vars, RET vars, RET arrays)
    const paramTable = buildParamTable(funcInfo, jsdocArgs);
    if (paramTable) {
        markdownValue += "\n\n" + paramTable;
    }

    // 5. Return type (@return)
    if (funcInfo.jsdoc?.ret) {
        markdownValue += `\n\nReturns \`${funcInfo.jsdoc.ret.type}\``;
    }

    // 6. Deprecation notice (@deprecated)
    if (funcInfo.jsdoc?.deprecated !== undefined) {
        if (funcInfo.jsdoc.deprecated === true) {
            markdownValue += "\n\n**Deprecated**";
        } else {
            markdownValue += `\n\n**Deprecated:** ${funcInfo.jsdoc.deprecated}`;
        }
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: markdownValue,
        },
    };
}

/**
 * Build parameter table markdown with @arg descriptions and type links.
 */
function buildParamTable(
    funcInfo: FunctionInfo,
    jsdocArgs: Map<string, { type: string; description?: string; required?: boolean }>
): string {
    if (!funcInfo.params) {
        return "";
    }

    const tableRows: string[] = [];
    let needsHeader = true;

    /** Format type as link if known, plain text otherwise. */
    const formatType = (type: string): string => {
        if (!type) return "";
        return KNOWN_TYPES.has(type) ? `[${type}](${IELIB_TYPES_URL}${type})` : type;
    };

    /**
     * Truncate description to max length with ellipsis.
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

    /** Add section header row. */
    const addSectionHeader = (sectionName: string) => {
        if (needsHeader) {
            tableRows.push(`| | ${sectionName} | Description | Default |`);
            tableRows.push("|:---|:---|:---|:---:|");
            needsHeader = false;
        } else {
            tableRows.push(`| | **${sectionName}** | | |`);
        }
    };

    /** Add parameter rows for INT_VAR/STR_VAR sections. */
    const addVarSection = (
        sectionName: string,
        params: { name: string; defaultValue?: string }[],
        defaultType: string
    ) => {
        if (params.length === 0) return;
        addSectionHeader(sectionName);

        for (const p of params) {
            const jsdoc = jsdocArgs.get(p.name);
            const type = formatType(jsdoc?.type ?? defaultType);
            // Hide default value for required params
            const def = jsdoc?.required ? "" : (p.defaultValue ?? "");
            const desc = truncateDesc(jsdoc?.description ?? "");
            tableRows.push(`| ${type} | ${p.name} | ${desc} | ${def} |`);
        }
    };

    /** Add parameter rows for RET/RET_ARRAY sections. */
    const addRetSection = (sectionName: string, params: string[]) => {
        if (params.length === 0) return;
        addSectionHeader(sectionName);

        for (const name of params) {
            const jsdoc = jsdocArgs.get(name);
            const type = formatType(jsdoc?.type ?? "");
            const desc = truncateDesc(jsdoc?.description ?? "");
            tableRows.push(`| ${type} | ${name} | ${desc} | |`);
        }
    };

    addVarSection("INT vars", funcInfo.params.intVar, "int");
    addVarSection("STR vars", funcInfo.params.strVar, "string");
    addRetSection("RET vars", funcInfo.params.ret);
    addRetSection("RET arrays", funcInfo.params.retArray);

    return tableRows.join("\n");
}

/**
 * Extract filename from a file URI.
 */
function extractFilename(uri: string): string {
    const path = uri.replace(/^file:\/\//, "");
    const lastSlash = path.lastIndexOf("/");
    return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

/**
 * Build hover content from VariableInfo.
 * Exported for use in symbol conversion.
 *
 * @param varInfo Variable definition info
 * @param displayPath Path to show in hover:
 *   - `undefined` = extract filename from URI (default)
 *   - `string` = use provided path
 *   - `null` = skip path block entirely (for local symbols)
 */
export function buildVariableHover(varInfo: VariableInfo, displayPath?: string | null): Hover {
    const langId = "weidu-tp2-tooltip";

    // Use JSDoc @type if available, otherwise inferred type
    const type = varInfo.jsdoc?.type ?? varInfo.inferredType;
    const signature = varInfo.value ? `${type} ${varInfo.name} = ${varInfo.value}` : `${type} ${varInfo.name}`;

    // File path block (skip if displayPath === null)
    let markdownValue: string;
    if (displayPath === null) {
        // Local symbol - no path block
        markdownValue = [
            "```" + `${langId}`,
            signature,
            "```",
        ].join("\n");
    } else {
        // Header/indexed symbol - include path
        const filePath = displayPath ?? extractFilename(varInfo.location.uri);
        markdownValue = [
            "```" + `${langId}`,
            signature,
            "```",
            "```bgforge-mls-comment",
            filePath,
            "```",
        ].join("\n");
    }

    // Add JSDoc description if available
    if (varInfo.jsdoc?.desc) {
        markdownValue += `\n\n${varInfo.jsdoc.desc}`;
    }

    // Add deprecation notice if present
    if (varInfo.jsdoc?.deprecated !== undefined) {
        if (varInfo.jsdoc.deprecated === true) {
            markdownValue += "\n\n**Deprecated**";
        } else {
            markdownValue += `\n\n**Deprecated:** ${varInfo.jsdoc.deprecated}`;
        }
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: markdownValue,
        },
    };
}
