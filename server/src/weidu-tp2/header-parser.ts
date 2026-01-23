/**
 * Tree-sitter based header parser for WeiDU TP2 files.
 * Extracts function/macro definitions with JSDoc and parameter info.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { Location } from "vscode-languageserver/node";
import * as jsdoc from "../shared/jsdoc";
import { getParser, isInitialized } from "./parser";
import { SyntaxType } from "./tree-sitter.d";
import { stripStringDelimiters } from "./tree-utils";

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

/** Variable definition info from header files. */
export interface VariableInfo {
    name: string;
    location: Location;
    jsdoc?: jsdoc.JSdoc;
    value?: string; // Source text from AST, truncated if long
    declarationKind: "set" | "sprint" | "text_sprint";
    inferredType: "int" | "string"; // Derived: "set"/assignment → "int", "sprint"/"text_sprint" → "string"
}

/** Node types for function/macro definitions. */
const FUNCTION_DEF_TYPES = new Set([
    SyntaxType.ActionDefineFunction,
    SyntaxType.ActionDefinePatchFunction,
    SyntaxType.ActionDefineMacro,
    SyntaxType.ActionDefinePatchMacro,
]);

/** Node types for variable declarations (file-scope, outside function/macro bodies). */
const VARIABLE_TYPES = new Set([
    SyntaxType.ActionOuterSet,
    SyntaxType.ActionOuterSprint,
    SyntaxType.ActionOuterTextSprint,
    SyntaxType.PatchSet,
    SyntaxType.PatchSprint,
    SyntaxType.PatchTextSprint,
    SyntaxType.PatchAssignment,
    SyntaxType.TopLevelAssignment,
]);

/** Node types for parameter declarations (mapping from node type to parameter category). */
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
 * Parse a TP2 file and extract all top-level variable definitions with JSDoc.
 */
export function parseHeaderVariables(text: string, uri: string): VariableInfo[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return [];
    }

    return extractVariables(tree.rootNode, uri);
}

/**
 * Extract function/macro definitions from AST root.
 */
function extractFunctions(root: SyntaxNode, uri: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    for (let i = 0; i < root.childCount; i++) {
        const node = root.child(i);
        if (!node || !FUNCTION_DEF_TYPES.has(node.type as SyntaxType)) {
            continue;
        }

        const info = extractFunctionInfo(node, uri);
        if (info) {
            functions.push(info);
        }
    }

    return functions;
}

/**
 * Extract file-scope variable definitions from the AST.
 * Recurses into control flow but skips function/macro bodies (separate scope in WeiDU).
 */
function extractVariables(root: SyntaxNode, uri: string): VariableInfo[] {
    const variables: VariableInfo[] = [];

    function visit(node: SyntaxNode): void {
        if (VARIABLE_TYPES.has(node.type as SyntaxType)) {
            const info = extractVariableInfo(node, uri);
            if (info) {
                variables.push(info);
            }
        }

        // Don't recurse into function/macro bodies - they are separate scopes
        if (FUNCTION_DEF_TYPES.has(node.type as SyntaxType)) {
            return;
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
    return variables;
}

/**
 * Extract info from a single function/macro definition node.
 */
function extractFunctionInfo(node: SyntaxNode, uri: string): FunctionInfo | null {
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
    const docComment = findPrecedingDocComment(node);
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
 * Extract info from a single variable definition node.
 * Includes all variables; JSDoc is optional.
 */
function extractVariableInfo(node: SyntaxNode, uri: string): VariableInfo | null {
    const varNode = node.childForFieldName("var");
    if (!varNode) {
        return null;
    }

    const name = varNode.text;

    const location: Location = {
        uri,
        range: {
            start: { line: varNode.startPosition.row, character: varNode.startPosition.column },
            end: { line: varNode.endPosition.row, character: varNode.endPosition.column },
        },
    };

    // Determine declaration kind and inferred type from node type
    let declarationKind: VariableInfo["declarationKind"];
    let inferredType: VariableInfo["inferredType"];

    switch (node.type as SyntaxType) {
        case SyntaxType.ActionOuterSet:
        case SyntaxType.PatchSet:
        case SyntaxType.PatchAssignment:
        case SyntaxType.TopLevelAssignment:
            declarationKind = "set";
            inferredType = "int";
            break;
        case SyntaxType.ActionOuterSprint:
        case SyntaxType.PatchSprint:
            declarationKind = "sprint";
            inferredType = "string";
            break;
        case SyntaxType.ActionOuterTextSprint:
        case SyntaxType.PatchTextSprint:
            declarationKind = "text_sprint";
            inferredType = "string";
            break;
        default:
            declarationKind = "set";
            inferredType = "int";
    }

    const info: VariableInfo = { name, location, declarationKind, inferredType };

    // Extract value from AST
    const valueNode = node.childForFieldName("value");
    if (valueNode) {
        let valueText = valueNode.text;
        // Truncate to 50 chars + "..." if longer
        const MAX_VALUE_LENGTH = 50;
        if (valueText.length > MAX_VALUE_LENGTH) {
            valueText = valueText.slice(0, MAX_VALUE_LENGTH) + "...";
        }
        info.value = valueText;
    }

    // Extract JSDoc from preceding comment (optional)
    const docComment = findPrecedingDocComment(node);
    if (docComment) {
        info.jsdoc = jsdoc.parse(docComment);
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
 * Find preceding JSDoc comment (block comment starting with /**) for a node.
 * Looks at previous siblings within the same parent.
 */
function findPrecedingDocComment(node: SyntaxNode): string | null {
    const parent = node.parent;
    if (!parent) {
        return null;
    }

    // Find this node's index in parent by position (web-tree-sitter creates new objects per .child() call)
    let nodeIndex = -1;
    for (let i = 0; i < parent.childCount; i++) {
        const sibling = parent.child(i);
        if (sibling && sibling.startIndex === node.startIndex && sibling.endIndex === node.endIndex) {
            nodeIndex = i;
            break;
        }
    }
    if (nodeIndex < 0) {
        return null;
    }

    // Look backwards for a JSDoc comment
    for (let i = nodeIndex - 1; i >= 0; i--) {
        const prev = parent.child(i);
        if (!prev) continue;

        if (prev.type === SyntaxType.Comment) {
            const text = prev.text.trim();
            // Only return if it's a JSDoc comment (starts with /**)
            if (text.startsWith("/**")) {
                return text;
            }
            // If we hit a non-JSDoc comment, stop looking
            return null;
        }

        // If we hit a non-comment node, stop looking
        if (prev.type !== SyntaxType.LineComment) {
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
                if (paramChild.type === SyntaxType.Identifier) {
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
        const isValue = ["identifier", "string", "number", "variable_ref", "binary_expr", "value"].includes(child.type);

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
    variableIndex.clear();
}

// ============================================
// Variable index
// ============================================

/** Workspace-wide variable index (only variables with JSDoc). */
const variableIndex = new Map<string, VariableInfo>();

/**
 * Update the variable index for a single file.
 */
export function updateVariableIndex(uri: string, text: string): void {
    // Remove old entries from this file
    clearVariableFromIndex(uri);

    // Parse and add new entries (first occurrence wins for duplicate names)
    const variables = parseHeaderVariables(text, uri);
    for (const varInfo of variables) {
        if (!variableIndex.has(varInfo.name)) {
            variableIndex.set(varInfo.name, varInfo);
        }
    }
}

/**
 * Clear all variable entries from a specific file from the index.
 */
export function clearVariableFromIndex(uri: string): void {
    for (const [name, info] of variableIndex) {
        if (info.location.uri === uri) {
            variableIndex.delete(name);
        }
    }
}

/**
 * Look up a variable by name in the workspace index.
 */
export function lookupVariable(name: string): VariableInfo | undefined {
    return variableIndex.get(name);
}
