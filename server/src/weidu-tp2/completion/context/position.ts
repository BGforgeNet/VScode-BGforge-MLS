/**
 * Position and value detection utilities for TP2 completion context.
 * Determines whether the cursor is at a command position (keyword) or value position (argument),
 * and provides helpers for navigating BEGIN...END block boundaries.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { SyntaxType } from "../../tree-sitter.d";
import { isPatch } from "../../format/utils";
import { CompletionContext } from "../types";
import { PATCH_CONTROL_FLOW_CONSTRUCTS, ACTION_CONTROL_FLOW_CONSTRUCTS } from "./constants";

/**
 * Get default context based on file extension.
 */
export function getDefaultContext(ext: string): CompletionContext {
    switch (ext) {
        case ".tpp":
            return CompletionContext.Patch;
        case ".tpa":
        case ".tph":
            return CompletionContext.Action;
        case ".tp2":
            return CompletionContext.Prologue;
        default:
            return CompletionContext.Unknown;
    }
}

/**
 * Get the 0-based line number for a given byte offset in text.
 * @param text Full document text
 * @param offset Byte offset
 * @returns 0-based line number
 */
export function getLineForOffset(text: string, offset: number): number {
    const lines = text.substring(0, offset).split('\n');
    return lines.length - 1;
}

/**
 * Check if cursor is inside the BEGIN...END body of a control flow construct.
 * Control flow constructs have their own BEGIN...END blocks, and statements inside
 * should be treated as command position (not value position).
 *
 * @param node Starting node (cursor position)
 * @param cursorOffset Byte offset of cursor
 * @param constructs Set of control flow construct types to check
 * @returns true if cursor is inside a control flow body
 */
export function isInsideControlFlowBody(
    node: SyntaxNode,
    cursorOffset: number,
    constructs: Set<string>
): boolean {
    let current: SyntaxNode | null = node;

    // Walk up the tree to find a control flow construct
    while (current) {
        if (constructs.has(current.type)) {
            // Found a control flow construct - check if cursor is inside its BEGIN...END body
            let beginEnd = -1;
            let endStart = -1;

            for (const child of current.children) {
                if (child.type === "BEGIN") {
                    beginEnd = child.endIndex;
                } else if (child.type === "END") {
                    endStart = child.startIndex;
                }
            }

            // If cursor is between BEGIN and END, we're inside the body
            if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
                return true;
            }
        }
        current = current.parent;
    }

    return false;
}

/**
 * BEGIN/END block boundary positions.
 * Used by function definitions and control flow constructs.
 */
export interface BlockBoundaries {
    /** Byte offset where BEGIN keyword ends (after the BEGIN keyword) */
    beginEnd: number;
    /** Byte offset where END keyword starts (before the END keyword) */
    endStart: number;
    /** Optional: byte offset where function name ends (used for detecting funcParams context) */
    functionNameEnd?: number;
}

/**
 * Find BEGIN and END keyword positions in a node.
 * Returns -1 for missing keywords.
 *
 * @param node Node to search (typically a function definition or control flow construct)
 * @param trackFunctionName If true, also track the first identifier (function name)
 * @returns Boundary positions
 */
export function findBeginEndBoundaries(node: SyntaxNode, trackFunctionName = false): BlockBoundaries {
    let beginEnd = -1;
    let endStart = -1;
    let functionNameEnd = -1;

    for (const child of node.children) {
        if (child.type === "BEGIN") {
            beginEnd = child.endIndex;
        } else if (child.type === "END") {
            endStart = child.startIndex;
        } else if (trackFunctionName && child.type === SyntaxType.Identifier && functionNameEnd < 0) {
            // First identifier is the function name
            functionNameEnd = child.endIndex;
        }
    }

    return { beginEnd, endStart, functionNameEnd };
}

/**
 * Check if cursor is in a command position (start of a new statement).
 * Returns true if cursor is inside a control flow body OR if incomplete code
 * at the end of a statement looks like a new statement on a new line.
 *
 * @param cursorOffset Byte offset of cursor
 * @param node Statement node to check
 * @returns true if at command position (keyword position)
 */
function isInCommandPosition(cursorOffset: number, node: SyntaxNode): boolean {
    // Check if we're inside a control flow construct's BEGIN...END body
    // Statements inside control flow bodies are command position, not value position
    if (isInsideControlFlowBody(node, cursorOffset, PATCH_CONTROL_FLOW_CONSTRUCTS)) {
        return true; // Command position (patchKeyword)
    }
    if (isInsideControlFlowBody(node, cursorOffset, ACTION_CONTROL_FLOW_CONSTRUCTS)) {
        return true; // Command position (actionKeyword)
    }

    const children = node.children;
    if (children.length < 2) {
        return false; // Continue to other checks
    }

    const lastChild = children[children.length - 1];
    if (!lastChild) {
        return false;
    }

    // Heuristic: cursor WITHIN last child that looks like incomplete new statement
    // (Incomplete code may be parsed as trailing argument to previous statement)
    if (cursorOffset >= lastChild.startIndex && cursorOffset <= lastChild.endIndex) {
        // Check if last child looks like it might be a new statement (not a continuation)
        // Heuristic: if it's an identifier/variable_ref/value that starts on a new line
        // relative to the previous child, treat as command position for new statement
        if (lastChild.type === SyntaxType.Identifier || lastChild.type === SyntaxType.VariableRef || lastChild.type === SyntaxType.Value) {
            // Check if there's a previous child
            if (children.length >= 2) {
                const prevChild = children[children.length - 2];
                // If last child is on a different line than previous, likely a new statement
                if (prevChild && lastChild.startPosition.row > prevChild.endPosition.row) {
                    return true; // Command position
                }
            }
        }
    }

    return false;
}

/**
 * Check if cursor is between keyword and last argument (value position).
 * Returns true if cursor is past the first child (keyword) and before/at the
 * last meaningful child, excluding trailing whitespace.
 *
 * @param cursorOffset Byte offset of cursor
 * @param node Statement node to check
 * @returns true if in value position (after keyword)
 */
function isBetweenKeywordAndLastArg(cursorOffset: number, node: SyntaxNode): boolean {
    const children = node.children;
    if (children.length < 2) {
        return false; // No arguments, can't be in value position
    }

    const firstChild = children[0];
    const lastChild = children[children.length - 1];
    if (!firstChild || !lastChild) {
        return false;
    }

    // Cursor must be past the keyword AND before the end of the last meaningful child
    // This excludes trailing whitespace/newlines that might be included in the node
    return cursorOffset > firstChild.endIndex && cursorOffset <= lastChild.endIndex;
}

/**
 * Check if cursor is in a value/expression position (not at keyword position).
 * Returns true if cursor is between the first child (keyword) and a meaningful
 * subsequent child (argument/value), not just on trailing whitespace.
 *
 * Special case: If cursor is within the last child that looks like an incomplete
 * new statement (identifier/variable_ref on new line), treat as command position.
 * This handles cases where incomplete code gets attached to the previous statement
 * by the parser.
 */
export function isInValuePosition(cursorOffset: number, node: SyntaxNode): boolean {
    // Check for command position indicators first
    if (isInCommandPosition(cursorOffset, node)) {
        return false;
    }

    // Check basic position between keyword and last arg
    return isBetweenKeywordAndLastArg(cursorOffset, node);
}

// ============================================
// Tree Content Helpers
// ============================================

/**
 * Check if a node or its children recursively contain a patch node.
 * Used to detect patches in ERROR nodes or nested structures.
 */
export function containsPatch(node: SyntaxNode): boolean {
    if (isPatch(node.type)) return true;
    for (const child of node.children) {
        if (containsPatch(child)) return true;
    }
    return false;
}

/**
 * Check if a node or its children recursively contain a when node.
 * Used to detect when in ERROR nodes or nested structures.
 */
export function containsWhen(node: SyntaxNode): boolean {
    if (node.type === SyntaxType.When) return true;
    for (const child of node.children) {
        if (containsWhen(child)) return true;
    }
    return false;
}
