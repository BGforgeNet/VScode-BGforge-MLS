/**
 * Shared utilities for local symbol extraction.
 */

import type { Node } from "web-tree-sitter";
import { Position } from "vscode-languageserver/node";

/**
 * Create a Position from a tree-sitter point.
 */
function makePosition(row: number, col: number): Position {
    return { line: row, character: col };
}

/**
 * Create a range from a tree-sitter node.
 */
export function makeRange(node: Node) {
    return {
        start: makePosition(node.startPosition.row, node.startPosition.column),
        end: makePosition(node.endPosition.row, node.endPosition.column),
    };
}

/**
 * Find doc comment immediately preceding a node.
 * Comments are siblings in the tree.
 */
export function findPrecedingDocComment(root: Node, defNode: Node): string | null {
    const defLine = defNode.startPosition.row;

    for (const node of root.children) {
        if (node.type === "comment") {
            const text = node.text;
            if (!text.startsWith("/**")) {
                continue;
            }
            const commentEndLine = node.endPosition.row;
            if (commentEndLine === defLine - 1 || commentEndLine === defLine) {
                return text;
            }
        }
    }
    return null;
}

/**
 * Extract all procedures from root, deduplicating by name.
 * Definition takes precedence over forward declaration.
 * Returns Map<name, { node, isForward }>.
 */
export function extractProcedures(root: Node): Map<string, { node: Node; isForward: boolean }> {
    const procedures = new Map<string, { node: Node; isForward: boolean }>();

    for (const node of root.children) {
        if (node.type === "procedure") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                // Definition always wins
                procedures.set(nameNode.text, { node, isForward: false });
            }
        } else if (node.type === "procedure_forward") {
            const nameNode = node.childForFieldName("name");
            if (nameNode && !procedures.has(nameNode.text)) {
                // Only add forward if definition doesn't exist
                procedures.set(nameNode.text, { node, isForward: true });
            }
        }
    }

    return procedures;
}

/**
 * Find a procedure by name, preferring definition over forward.
 */
export function findProcedure(root: Node, symbol: string): Node | null {
    const procedures = extractProcedures(root);
    const proc = procedures.get(symbol);
    return proc?.node ?? null;
}
