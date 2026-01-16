/**
 * COPY action formatting: COPY, COPY_EXISTING, COPY_LARGE, etc.
 * Handles file pairs, patches, and suffix keywords (BUT_ONLY, IF_EXISTS).
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import {
    type FormatContext,
    KW_BEGIN,
    KW_END,
    KW_BUT_ONLY,
    KW_BUT_ONLY_IF_IT_CHANGES,
    KW_IF_EXISTS,
    KW_UNLESS,
    KW_IF,
    addFormatError,
} from "./format-types";
import {
    isComment,
    isKeyword,
    isPatch,
    isControlFlow,
    isFunctionCall,
    normalizeComment,
    normalizeWhitespace,
    handleComment,
} from "./format-utils";

// ============================================
// Types
// ============================================

/** Collected parts of a COPY action for formatting. */
interface CopyActionParts {
    keyword: string;
    filePairs: string[];
    patches: SyntaxNode[];
    suffix: string[];
}

// ============================================
// COPY action parsing
// ============================================

/** Check if a node is a file pair type. */
function isFilePairType(type: string): boolean {
    return (
        type === "file_pair" ||
        type === "copy_random_item" ||
        type === "copy_large_item" ||
        type === "copy_2da_item"
    );
}

/** Check if a node is a patch or patch-related content. */
function isPatchContent(type: string): boolean {
    return (
        isPatch(type) ||
        isControlFlow(type) ||
        isFunctionCall(type) ||
        type === "patch_block" ||
        type === "if_filter" ||
        type === "inner_action"
    );
}

/** Check if a node is a suffix keyword. */
function isSuffixKeyword(child: SyntaxNode): boolean {
    return (
        isKeyword(child, KW_BUT_ONLY) ||
        isKeyword(child, KW_BUT_ONLY_IF_IT_CHANGES) ||
        isKeyword(child, KW_IF_EXISTS) ||
        child.type === "_but_only"
    );
}

/** Check if a node is a value type (for UNLESS/IF values). */
function isValueType(type: string): boolean {
    return type === "string" || type === "variable_ref" || type === "identifier" || type === "number";
}

/** Check if child is a COPY flag (GLOB, NOGLOB, +, -). */
function isCopyFlag(text: string): boolean {
    return text === "GLOB" || text === "NOGLOB" || text === "+" || text === "-";
}

/**
 * Parse COPY action into structured parts.
 * Separates keyword, file pairs, patches, and suffix keywords.
 */
function parseCopyAction(node: SyntaxNode): CopyActionParts {
    const parts: CopyActionParts = {
        keyword: "",
        filePairs: [],
        patches: [],
        suffix: [],
    };

    let inPatchArea = false;

    for (const child of node.children) {
        // File pairs
        if (isFilePairType(child.type)) {
            parts.filePairs.push(normalizeWhitespace(child.text));
            continue;
        }

        // Keyword detection
        if (child.type === "identifier" && !parts.keyword) {
            parts.keyword = child.text;
            continue;
        }
        if (child.text.startsWith("COPY") || child.text === "INNER_ACTION") {
            parts.keyword = child.text;
            continue;
        }

        // COPY flags (GLOB, NOGLOB, +, -) - must come before file pairs
        if (parts.keyword && parts.filePairs.length === 0 && isCopyFlag(child.text)) {
            parts.keyword += " " + child.text;
            continue;
        }

        // Patches and patch-related content
        if (isPatchContent(child.type) || isComment(child)) {
            inPatchArea = true;
            parts.patches.push(child);
            continue;
        }

        // Suffix keywords (BUT_ONLY, IF_EXISTS, etc.)
        if (isSuffixKeyword(child)) {
            inPatchArea = true;
            parts.suffix.push(child.text);
            continue;
        }

        // IF keyword in patch area (part of BUT_ONLY IF)
        if (isKeyword(child, KW_IF) && inPatchArea) {
            parts.suffix.push(child.text);
            continue;
        }

        // UNLESS keyword
        if (isKeyword(child, KW_UNLESS)) {
            inPatchArea = true;
            parts.suffix.push(child.text);
            continue;
        }

        // Value following UNLESS
        if (inPatchArea && parts.suffix.length > 0 && parts.suffix[parts.suffix.length - 1] === KW_UNLESS && isValueType(child.type)) {
            parts.suffix[parts.suffix.length - 1] = KW_UNLESS + " " + child.text;
            continue;
        }

        // Value following IF (in BUT_ONLY IF context)
        if (inPatchArea && parts.suffix.length > 0 && parts.suffix[parts.suffix.length - 1] === KW_IF && isValueType(child.type)) {
            parts.suffix[parts.suffix.length - 1] = KW_IF + " " + child.text;
            continue;
        }
    }

    return parts;
}

// ============================================
// COPY action formatting
// ============================================

/** Format the header (keyword + file pairs). */
function formatCopyHeader(parts: CopyActionParts, indent: string, patchIndent: string, lineLimit: number): string[] {
    const lines: string[] = [];

    if (parts.filePairs.length <= 1) {
        const firstPair = parts.filePairs[0] ?? "";
        const header = parts.keyword + " " + firstPair;
        const totalLen = indent.length + header.length;
        if (totalLen <= lineLimit || parts.filePairs.length === 0) {
            lines.push(indent + header);
        } else {
            lines.push(indent + parts.keyword);
            lines.push(patchIndent + firstPair);
        }
    } else {
        lines.push(indent + parts.keyword);
        for (const pair of parts.filePairs) {
            lines.push(patchIndent + pair);
        }
    }

    return lines;
}

/** Format patches inside COPY action. */
function formatCopyPatches(
    patches: SyntaxNode[],
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string[] {
    const patchIndent = ctx.indent.repeat(depth + 1);
    const nestedIndent = ctx.indent.repeat(depth + 2);
    const lines: string[] = [];
    let lastPatchEndRow = -1;

    for (const patch of patches) {
        if (isComment(patch)) {
            handleComment(lines, patch, patchIndent, lastPatchEndRow);
            continue;
        }

        if (patch.type === "patch_block") {
            lines.push(patchIndent + KW_BEGIN);
            let lastBlockPatchEndRow = -1;
            for (const patchChild of patch.children) {
                if (isKeyword(patchChild, KW_BEGIN) || isKeyword(patchChild, KW_END)) {
                    continue;
                }
                if (isComment(patchChild)) {
                    handleComment(lines, patchChild, nestedIndent, lastBlockPatchEndRow);
                } else if (isPatchContent(patchChild.type)) {
                    lines.push(formatNode(patchChild, ctx, depth + 2));
                    lastBlockPatchEndRow = patchChild.endPosition.row;
                }
            }
            lines.push(patchIndent + KW_END);
            lastPatchEndRow = patch.endPosition.row;
        } else {
            lines.push(formatNode(patch, ctx, depth + 1));
            lastPatchEndRow = patch.endPosition.row;
        }
    }

    return lines;
}

/** Format suffix keywords (BUT_ONLY, UNLESS, etc.). */
function formatCopySuffix(suffix: string[], indent: string): string[] {
    if (suffix.length === 0) return [];

    const lines: string[] = [];
    let suffixLine = "";

    for (const item of suffix) {
        if (item.startsWith("//")) {
            if (suffixLine) {
                lines.push(indent + suffixLine);
                suffixLine = "";
            }
            lines.push(indent + normalizeComment(item));
        } else {
            suffixLine = suffixLine ? suffixLine + " " + item : item;
        }
    }

    if (suffixLine) {
        lines.push(indent + suffixLine);
    }

    return lines;
}

/**
 * Format COPY-style actions (COPY, COPY_EXISTING, COPY_LARGE, etc.).
 *
 * Structure: KEYWORD file_pairs [patches] [BUT_ONLY]
 */
export function formatCopyAction(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const patchIndent = ctx.indent.repeat(depth + 1);

    const parts = parseCopyAction(node);

    // Report if COPY action has no keyword (malformed)
    if (!parts.keyword) {
        addFormatError(ctx, `COPY action missing keyword`, node.startPosition.row + 1, node.startPosition.column + 1);
    }

    // Report if COPY action has no file pairs (likely malformed)
    if (parts.filePairs.length === 0 && parts.patches.length === 0) {
        addFormatError(ctx, `COPY action '${parts.keyword}' has no file pairs`, node.startPosition.row + 1, node.startPosition.column + 1);
    }

    const headerLines = formatCopyHeader(parts, indent, patchIndent, ctx.lineLimit);
    const patchLines = formatCopyPatches(parts.patches, ctx, depth, formatNode);
    const suffixLines = formatCopySuffix(parts.suffix, indent);

    return [...headerLines, ...patchLines, ...suffixLines].join("\n");
}
