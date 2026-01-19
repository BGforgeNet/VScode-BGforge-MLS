/**
 * Go to Definition for WeiDU TP2 files.
 * Handles:
 * - Function/macro call to definition (LAF, LAM, LPF, LPM)
 * - INCLUDE directive to file
 */

import { Location, Position } from "vscode-languageserver/node";
import type { Node as SyntaxNode } from "web-tree-sitter";
import * as path from "path";
import * as fs from "fs";
import { getParser, isInitialized } from "./parser";
import { parseHeader, lookupFunction, FunctionInfo } from "./header-parser";
import { pathToUri, uriToPath } from "../common";
import { SyntaxType } from "./tree-sitter.d";

/** Node types for function/macro calls. */
const FUNCTION_CALL_TYPES = new Set([
    "action_launch_function",
    "action_launch_macro",
    "patch_launch_function",
    "patch_launch_macro",
]);

/** Node types for INCLUDE directives. */
const INCLUDE_TYPES = new Set([
    "action_include",
]);

// ============================================
// Main entry point
// ============================================

/**
 * Get definition location for the symbol at the given position.
 */
export function getDefinition(text: string, uri: string, position: Position): Location | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return null;
    }

    // Find the node at cursor position
    const targetNode = findNodeAtPosition(tree.rootNode, position);
    if (!targetNode) {
        return null;
    }

    // Check if cursor is on a function/macro call
    const callResult = tryFunctionCallDefinition(targetNode, text, uri);
    if (callResult) {
        return callResult;
    }

    // Check if cursor is on an INCLUDE path
    const includeResult = tryIncludeDefinition(targetNode, uri);
    if (includeResult) {
        return includeResult;
    }

    return null;
}

// ============================================
// Node finding
// ============================================

/**
 * Find the deepest node containing the given position.
 */
function findNodeAtPosition(root: SyntaxNode, position: Position): SyntaxNode | null {
    function visit(node: SyntaxNode): SyntaxNode | null {
        const startRow = node.startPosition.row;
        const endRow = node.endPosition.row;
        const startCol = node.startPosition.column;
        const endCol = node.endPosition.column;

        // Check if position is within this node
        const inRange =
            (position.line > startRow || (position.line === startRow && position.character >= startCol)) &&
            (position.line < endRow || (position.line === endRow && position.character <= endCol));

        if (!inRange) {
            return null;
        }

        // Try to find a more specific child node
        for (const child of node.children) {
            const result = visit(child);
            if (result) {
                return result;
            }
        }

        // No more specific child found, return this node
        return node;
    }

    return visit(root);
}

/**
 * Walk up the tree to find an ancestor of the given type.
 */
function findAncestorOfType(node: SyntaxNode, types: Set<string>): SyntaxNode | null {
    let current: SyntaxNode | null = node;
    while (current) {
        if (types.has(current.type)) {
            return current;
        }
        current = current.parent;
    }
    return null;
}

// ============================================
// Function/macro call handling
// ============================================

/**
 * Try to find definition for a function/macro call.
 */
function tryFunctionCallDefinition(node: SyntaxNode, text: string, uri: string): Location | null {
    // Check if we're in a function call context
    const callNode = findAncestorOfType(node, FUNCTION_CALL_TYPES);
    if (!callNode) {
        return null;
    }

    // Get the function name
    const nameNode = callNode.childForFieldName("name");
    if (!nameNode) {
        return null;
    }

    const funcName = nameNode.text;

    // First, look in the current file
    const localDef = findLocalDefinition(text, uri, funcName);
    if (localDef) {
        return localDef.location;
    }

    // Then, look in the workspace index
    const indexedDef = lookupFunction(funcName);
    if (indexedDef) {
        return indexedDef.location;
    }

    return null;
}

/**
 * Find a function/macro definition in the current file.
 */
function findLocalDefinition(text: string, uri: string, name: string): FunctionInfo | null {
    const functions = parseHeader(text, uri);
    return functions.find(f => f.name === name) ?? null;
}

// ============================================
// INCLUDE handling
// ============================================

/**
 * Try to find definition for an INCLUDE directive.
 */
function tryIncludeDefinition(node: SyntaxNode, uri: string): Location | null {
    // Check if we're in an INCLUDE context
    const includeNode = findAncestorOfType(node, INCLUDE_TYPES);
    if (!includeNode) {
        return null;
    }

    // Find the path string node
    const pathNode = findPathInInclude(includeNode);
    if (!pathNode) {
        return null;
    }

    // Get the include path (strip quotes/tildes)
    const includePath = stripQuotes(pathNode.text);
    if (!includePath) {
        return null;
    }

    // Resolve the path relative to the current file
    const currentFilePath = uriToPath(uri);
    const currentDir = path.dirname(currentFilePath);
    const resolvedPath = path.resolve(currentDir, includePath);

    // Check if the file exists
    if (!fs.existsSync(resolvedPath)) {
        return null;
    }

    // Return location pointing to the start of the file
    return {
        uri: pathToUri(resolvedPath),
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        },
    };
}

/**
 * Find the path node in an INCLUDE directive.
 */
function findPathInInclude(node: SyntaxNode): SyntaxNode | null {
    // Use the "file" field if available
    const fileNode = node.childForFieldName("file");
    if (fileNode) {
        return fileNode;
    }
    // Fallback to finding any string child
    for (const child of node.children) {
        if (child.type === SyntaxType.String) {
            return child;
        }
    }
    return null;
}

/**
 * Strip surrounding quotes or tildes from a string.
 */
function stripQuotes(text: string): string {
    if (text.length < 2) {
        return text;
    }
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' && last === '"') ||
        (first === "'" && last === "'") ||
        (first === "~" && last === "~") ||
        (first === "%" && last === "%")) {
        return text.slice(1, -1);
    }
    return text;
}
