/**
 * Shared tree-sitter utilities for WeiDU TP2 files.
 * Common functions used across rename, definition, and variable-symbols features.
 */

import { Position } from "vscode-languageserver/node";
import type { Node as SyntaxNode } from "web-tree-sitter";
import { SyntaxType } from "./tree-sitter.d";

// ============================================
// Tree traversal utilities
// ============================================

/**
 * Find the deepest node at the given position.
 */
export function findNodeAtPosition(root: SyntaxNode, position: Position): SyntaxNode | null {
    function visit(node: SyntaxNode): SyntaxNode | null {
        const startRow = node.startPosition.row;
        const endRow = node.endPosition.row;
        const startCol = node.startPosition.column;
        const endCol = node.endPosition.column;

        const inRange =
            (position.line > startRow || (position.line === startRow && position.character >= startCol)) &&
            (position.line < endRow || (position.line === endRow && position.character <= endCol));

        if (!inRange) {
            return null;
        }

        // Try to find a more specific child
        for (const child of node.children) {
            const result = visit(child);
            if (result) {
                return result;
            }
        }

        return node;
    }

    return visit(root);
}

/**
 * Find an ancestor node matching one of the given types.
 * Accepts ReadonlySet<SyntaxType> - SyntaxType enum values are strings, matching node.type.
 */
export function findAncestorOfType(node: SyntaxNode, types: ReadonlySet<SyntaxType | string>): SyntaxNode | null {
    let current: SyntaxNode | null = node;
    while (current) {
        if (types.has(current.type as SyntaxType)) {
            return current;
        }
        current = current.parent;
    }
    return null;
}

/**
 * Check if two nodes represent the same position in the source.
 * Tree-sitter may return different object references for the same node.
 */
export function isSameNode(node1: SyntaxNode, node2: SyntaxNode): boolean {
    return (
        node1.startPosition.row === node2.startPosition.row &&
        node1.startPosition.column === node2.startPosition.column &&
        node1.endPosition.row === node2.endPosition.row &&
        node1.endPosition.column === node2.endPosition.column &&
        node1.text === node2.text
    );
}

// ============================================
// String utilities
// ============================================

/**
 * Strip WeiDU string delimiters from a string.
 * WeiDU uses ~, ", %, and ~ ~...~ ~ for strings.
 * This is the most complete version, supporting all delimiter types.
 */
export function stripStringDelimiters(text: string): string {
    if (text.length < 2) {
        return text;
    }
    const first = text[0];
    const last = text[text.length - 1];
    if (
        (first === "~" && last === "~") ||
        (first === '"' && last === '"') ||
        (first === "%" && last === "%")
    ) {
        return text.slice(1, -1);
    }
    return text;
}
