/**
 * Go to Definition for WeiDU D files.
 * Handles jumping to state label definitions within the same file.
 */

import { Location, Position } from "vscode-languageserver/node";
import type { Node as SyntaxNode } from "web-tree-sitter";
import { parseWithCache, isInitialized } from "./parser";

interface StateDefinition {
    name: string;
    range: { start: Position; end: Position };
}

/**
 * Find all state label definitions in the document.
 */
function findStateDefinitions(root: SyntaxNode): StateDefinition[] {
    const definitions: StateDefinition[] = [];

    function visit(node: SyntaxNode) {
        if (node.type === "state") {
            const label = node.childForFieldName("label");
            if (label) {
                definitions.push({
                    name: label.text,
                    range: {
                        start: { line: label.startPosition.row, character: label.startPosition.column },
                        end: { line: label.endPosition.row, character: label.endPosition.column },
                    },
                });
            }
        }
        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
    return definitions;
}

/**
 * Find the symbol (state label reference) at the given position.
 */
function findSymbolAtPosition(root: SyntaxNode, position: Position): string | null {
    function visit(node: SyntaxNode): string | null {
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

        // Check if this is a state label reference (in transitions)
        if (node.type === "goto_next" || node.type === "short_goto" || node.type === "extern_next") {
            const label = node.childForFieldName("label");
            if (label) {
                const labelStart = label.startPosition;
                const labelEnd = label.endPosition;
                if (
                    (position.line > labelStart.row || (position.line === labelStart.row && position.character >= labelStart.column)) &&
                    (position.line < labelEnd.row || (position.line === labelEnd.row && position.character <= labelEnd.column))
                ) {
                    return label.text;
                }
            }
        }

        // Check children
        for (const child of node.children) {
            const result = visit(child);
            if (result) return result;
        }

        return null;
    }

    return visit(root);
}

/**
 * Get definition location for the symbol at the given position.
 */
export function getDefinition(text: string, uri: string, position: Position): Location | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const symbol = findSymbolAtPosition(tree.rootNode, position);
    if (!symbol) {
        return null;
    }

    const definitions = findStateDefinitions(tree.rootNode);
    const def = definitions.find(d => d.name === symbol);
    if (!def) {
        return null;
    }

    return {
        uri,
        range: def.range,
    };
}
