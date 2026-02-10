/**
 * Completion context detection for Fallout SSL.
 * Determines whether the cursor is inside a JSDoc comment, regular comment, or code.
 */

import type { Position } from "vscode-languageserver/node";
import { isInitialized, parseWithCache } from "./parser";

/** SSL completion context for filterCompletions. */
export enum SslCompletionContext {
    /** Inside a JSDoc block (starts with slash-star-star) */
    Jsdoc = "jsdoc",
    /** Inside a regular comment (block or line) */
    Comment = "comment",
    /** Regular code context */
    Code = "code",
}

/**
 * Detect whether the cursor is inside a JSDoc comment, regular comment, or code.
 * Uses tree-sitter to find the node at cursor position and check its type.
 *
 * @param text Document text
 * @param position Cursor position (0-based line and character)
 * @returns The completion context at the cursor position
 */
export function getSslCompletionContext(text: string, position: Position): SslCompletionContext {
    if (!isInitialized()) {
        return SslCompletionContext.Code;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return SslCompletionContext.Code;
    }

    const node = tree.rootNode.descendantForPosition({
        row: position.line,
        column: position.character,
    });
    if (!node) {
        return SslCompletionContext.Code;
    }

    // SSL grammar has no generated SyntaxType enum; node type strings used throughout fallout-ssl.
    if (node.type === "comment") {
        const commentText = node.text.trimStart();
        if (commentText.startsWith("/**")) {
            return SslCompletionContext.Jsdoc;
        }
        return SslCompletionContext.Comment;
    }

    if (node.type === "line_comment") {
        return SslCompletionContext.Comment;
    }

    return SslCompletionContext.Code;
}
