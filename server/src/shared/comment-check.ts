/**
 * Shared comment detection factory for tree-sitter-based providers.
 * Creates an isInsideComment function bound to a specific parser and comment types.
 */

import type { Position } from "vscode-languageserver/node";

/**
 * Create a comment check function for a specific language.
 * The returned function checks if a position falls inside a comment node.
 *
 * @param isInitialized - Check if the language parser is ready
 * @param parseWithCache - Parse text using the language's cached parser
 * @param commentTypes - Set of tree-sitter node type strings considered comments
 */
export function createIsInsideComment(
    isInitialized: () => boolean,
    parseWithCache: (text: string) => { rootNode: import("web-tree-sitter").Node } | null,
    commentTypes: ReadonlySet<string>,
): (text: string, position: Position) => boolean {
    return (text, position) => {
        if (!isInitialized()) {
            return false;
        }
        const tree = parseWithCache(text);
        if (!tree) {
            return false;
        }
        const node = tree.rootNode.descendantForPosition({ row: position.line, column: position.character });
        return node !== null && commentTypes.has(node.type);
    };
}
