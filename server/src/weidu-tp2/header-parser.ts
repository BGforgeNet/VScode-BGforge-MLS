/**
 * Tree-sitter based header parser for WeiDU TP2 files.
 * Extracts function/macro definitions with JSDoc and parameter info.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { Location } from "vscode-languageserver/node";
import * as jsdoc from "../shared/jsdoc";
import { getParser, isInitialized } from "./parser";

// ============================================
// Types
// ============================================

/** Parameter info extracted from function definitions. */
export interface FunctionParams {
    intVar: ParamInfo[];
    strVar: ParamInfo[];
    ret: string[];
    retArray: string[];
}

/** Single parameter with optional default value. */
export interface ParamInfo {
    name: string;
    defaultValue?: string;
}

/** Complete function/macro definition info. */
export interface FunctionInfo {
    name: string;
    context: "action" | "patch";
    dtype: "function" | "macro";
    location: Location;
    jsdoc?: jsdoc.JSdoc;
    params?: FunctionParams;
}

/** Node types for function/macro definitions. */
const FUNCTION_DEF_TYPES = new Set([
    "action_define_function",
    "action_define_patch_function",
    "action_define_macro",
    "action_define_patch_macro",
]);

/** Node types for parameter declarations. */
const PARAM_DECL_TYPES = {
    int_var_decl: "intVar",
    str_var_decl: "strVar",
    ret_decl: "ret",
    ret_array_decl: "retArray",
} as const;

// ============================================
// Parsing functions
// ============================================

/**
 * Strip WeiDU string delimiters from a string.
 * WeiDU uses ~, ", %, and ~ ~...~ ~ for strings.
 */
function stripStringDelimiters(text: string): string {
    // Handle ~text~, "text", %text%
    if ((text.startsWith("~") && text.endsWith("~")) ||
        (text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("%") && text.endsWith("%"))) {
        return text.slice(1, -1);
    }
    return text;
}

/**
 * Parse a TP2 file and extract all function/macro definitions.
 */
export function parseHeader(text: string, uri: string): FunctionInfo[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return [];
    }

    return extractFunctions(tree.rootNode, uri);
}

/**
 * Extract function/macro definitions from AST root.
 */
function extractFunctions(root: SyntaxNode, uri: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    for (let i = 0; i < root.childCount; i++) {
        const node = root.child(i);
        if (!node || !FUNCTION_DEF_TYPES.has(node.type)) {
            continue;
        }

        const info = extractFunctionInfo(node, uri, root, i);
        if (info) {
            functions.push(info);
        }
    }

    return functions;
}

/**
 * Extract info from a single function/macro definition node.
 */
function extractFunctionInfo(
    node: SyntaxNode,
    uri: string,
    root: SyntaxNode,
    nodeIndex: number
): FunctionInfo | null {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) {
        return null;
    }

    // Strip WeiDU string delimiters (tildes, quotes, percent signs) from function name
    const name = stripStringDelimiters(nameNode.text);
    const { context, dtype } = parseDefType(node.type);

    const location: Location = {
        uri,
        range: {
            start: { line: nameNode.startPosition.row, character: nameNode.startPosition.column },
            end: { line: nameNode.endPosition.row, character: nameNode.endPosition.column },
        },
    };

    const info: FunctionInfo = { name, context, dtype, location };

    // Extract JSDoc from preceding comment
    const docComment = findPrecedingDocComment(root, nodeIndex);
    if (docComment) {
        info.jsdoc = jsdoc.parse(docComment);
    }

    // Extract parameters (only for functions, macros don't have params)
    if (dtype === "function") {
        info.params = extractParams(node);
    }

    return info;
}

/**
 * Parse definition type string to context and dtype.
 */
function parseDefType(type: string): { context: "action" | "patch"; dtype: "function" | "macro" } {
    const context = type.includes("patch") ? "patch" : "action";
    const dtype = type.includes("macro") ? "macro" : "function";
    return { context, dtype };
}

/**
 * Find preceding JSDoc comment (block comment starting with /**).
 */
function findPrecedingDocComment(root: SyntaxNode, nodeIndex: number): string | null {
    // Look backwards for a comment node
    for (let i = nodeIndex - 1; i >= 0; i--) {
        const prev = root.child(i);
        if (!prev) continue;

        if (prev.type === "comment") {
            const text = prev.text.trim();
            // Only return if it's a JSDoc comment (starts with /**)
            if (text.startsWith("/**")) {
                return text;
            }
            // If we hit a non-JSDoc comment, stop looking
            return null;
        }

        // If we hit a non-comment node, stop looking
        if (prev.type !== "line_comment") {
            return null;
        }
    }

    return null;
}

/**
 * Extract parameter declarations from a function node.
 */
function extractParams(node: SyntaxNode): FunctionParams {
    const params: FunctionParams = {
        intVar: [],
        strVar: [],
        ret: [],
        retArray: [],
    };

    for (const child of node.children) {
        const paramType = PARAM_DECL_TYPES[child.type as keyof typeof PARAM_DECL_TYPES];
        if (!paramType) continue;

        if (paramType === "ret" || paramType === "retArray") {
            // RET and RET_ARRAY just have identifiers
            for (const paramChild of child.children) {
                if (paramChild.type === "identifier") {
                    params[paramType].push(paramChild.text);
                }
            }
        } else {
            // INT_VAR and STR_VAR have name = default pairs
            extractVarParams(child, params[paramType]);
        }
    }

    return params;
}

/**
 * Extract INT_VAR/STR_VAR parameters with optional default values.
 * Grammar structure: INT_VAR name1 = value1 name2 = value2 ...
 */
function extractVarParams(node: SyntaxNode, target: ParamInfo[]): void {
    let currentName: string | null = null;
    let expectingDefault = false;

    for (const child of node.children) {
        // Skip the keyword itself (INT_VAR, STR_VAR)
        if (child.type === node.type || child.text === "INT_VAR" || child.text === "STR_VAR") {
            continue;
        }

        if (child.text === "=") {
            // Next value will be the default
            expectingDefault = true;
            continue;
        }

        // Value types that can be parameter names or default values
        const isValue = ["identifier", "string", "number", "variable_ref", "binary_expr"].includes(child.type);

        if (!isValue) {
            continue;
        }

        if (expectingDefault && currentName !== null) {
            // This is a default value for currentName
            target.push({ name: currentName, defaultValue: child.text });
            currentName = null;
            expectingDefault = false;
        } else if (currentName !== null) {
            // Previous param had no default, save it and start new one
            target.push({ name: currentName });
            currentName = child.text;
        } else {
            // This is a new parameter name
            currentName = child.text;
        }
    }

    // Don't forget the last parameter if no default value
    if (currentName !== null) {
        target.push({ name: currentName });
    }
}

// ============================================
// Workspace symbol index
// ============================================

/** Workspace-wide function index. */
const functionIndex = new Map<string, FunctionInfo>();

/**
 * Update the function index for a single file.
 */
export function updateFileIndex(uri: string, text: string): void {
    // Remove old entries from this file
    clearFileFromIndex(uri);

    // Parse and add new entries
    const functions = parseHeader(text, uri);
    for (const func of functions) {
        functionIndex.set(func.name, func);
    }
}

/**
 * Clear all entries from a specific file from the index.
 * Called when a watched file is deleted.
 */
export function clearFileFromIndex(uri: string): void {
    for (const [name, info] of functionIndex) {
        if (info.location.uri === uri) {
            functionIndex.delete(name);
        }
    }
}

/**
 * Look up a function by name in the workspace index.
 */
export function lookupFunction(name: string): FunctionInfo | undefined {
    return functionIndex.get(name);
}

/**
 * Clear the entire function index.
 */
export function clearIndex(): void {
    functionIndex.clear();
}
