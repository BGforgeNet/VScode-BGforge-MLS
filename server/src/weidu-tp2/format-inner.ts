/**
 * INNER_ACTION and INNER_PATCH formatting.
 * These allow running actions from patch context or patches on string buffers.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { type FormatContext, KW_BEGIN, KW_END } from "./format-types";
import {
    isComment,
    isKeyword,
    isAction,
    isPatch,
    isControlFlow,
    isFunctionCall,
    isCopyAction,
    normalizeWhitespace,
    handleComment,
} from "./format-utils";

// ============================================
// INNER_ACTION formatting
// ============================================

/**
 * Format INNER_ACTION blocks.
 * INNER_ACTION allows running top-level actions from within a patch context.
 * Structure: INNER_ACTION BEGIN <actions> END
 */
export function formatInnerAction(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    lines.push(indent + "INNER_ACTION BEGIN");

    let lastEndRow = -1;
    for (const child of node.children) {
        // Skip structural keywords and INNER_ACTION identifier
        if (isKeyword(child, KW_BEGIN) || isKeyword(child, KW_END)) {
            continue;
        }
        if (child.type === "identifier" && child.text.toUpperCase() === "INNER_ACTION") {
            continue;
        }

        if (isComment(child)) {
            handleComment(lines, child, bodyIndent, lastEndRow);
        } else if (
            isAction(child.type) ||
            isCopyAction(child.type) ||
            isControlFlow(child.type) ||
            isFunctionCall(child.type) ||
            child.type === "inlined_file"
        ) {
            lines.push(formatNode(child, ctx, depth + 1));
            lastEndRow = child.endPosition.row;
        }
    }

    lines.push(indent + KW_END);
    return lines.join("\n");
}

// ============================================
// INNER_PATCH formatting
// ============================================

/** Check if a node is valid INNER_PATCH header content. */
function isInnerPatchHeaderType(type: string): boolean {
    return type === "identifier" || type === "string" || type === "variable_ref" || type === "array_access";
}

/** Check if a node is valid INNER_PATCH body content. */
function isInnerPatchBodyContent(type: string): boolean {
    return isPatch(type) || isControlFlow(type) || isFunctionCall(type);
}

/**
 * Format INNER_PATCH / INNER_PATCH_SAVE blocks.
 * These execute patches on a string buffer.
 * Structure: INNER_PATCH[_SAVE var] buffer BEGIN <patches> END
 */
export function formatInnerPatch(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    // Build header: INNER_PATCH[_SAVE var] buffer
    const headerParts: string[] = [];
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            inBody = true;
            continue;
        }
        if (isKeyword(child, KW_END)) {
            continue;
        }

        if (!inBody) {
            // Collect header parts (keyword, var, buffer)
            if (isInnerPatchHeaderType(child.type)) {
                headerParts.push(normalizeWhitespace(child.text));
            } else if (child.text === "INNER_PATCH" || child.text === "INNER_PATCH_SAVE" || child.text === "INNER_PATCH_FILE") {
                headerParts.unshift(child.text);
            }
        } else {
            // Body content (patches)
            if (isComment(child)) {
                handleComment(lines, child, bodyIndent, lastEndRow);
            } else if (isInnerPatchBodyContent(child.type)) {
                lines.push(formatNode(child, ctx, depth + 1));
                lastEndRow = child.endPosition.row;
            }
        }
    }

    // Output header + BEGIN
    const header = headerParts.join(" ") + " " + KW_BEGIN;
    lines.unshift(indent + header);

    lines.push(indent + KW_END);
    return lines.join("\n");
}
