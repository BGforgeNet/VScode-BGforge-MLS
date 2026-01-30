/**
 * Utility functions for WeiDU TP2 formatting.
 * Includes comment handling, whitespace normalization, and type predicates.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import {
    INLINE_COMMENT_SPACING,
    TOP_LEVEL_DIRECTIVES,
    CONTROL_FLOW_TYPES,
    COPY_ACTION_TYPES,
    FUNCTION_DEF_TYPES,
    FUNCTION_CALL_TYPES,
    FOR_EACH_TYPES,
    type CollectedItem,
    CollectedItemType,
} from "./types";
import { SyntaxType } from "../tree-sitter.d";

// ============================================
// Type lookup sets (O(1) instead of O(n) array includes)
// ============================================

const TOP_LEVEL_DIRECTIVE_SET = new Set<string>(TOP_LEVEL_DIRECTIVES);
const CONTROL_FLOW_SET = new Set<string>(CONTROL_FLOW_TYPES);
const COPY_ACTION_SET = new Set<string>(COPY_ACTION_TYPES);
const FUNCTION_DEF_SET = new Set<string>(FUNCTION_DEF_TYPES);
const FUNCTION_CALL_SET = new Set<string>(FUNCTION_CALL_TYPES);
const FOR_EACH_SET = new Set<string>(FOR_EACH_TYPES);

/** Parameter keywords for function calls/definitions. */
const PARAM_KEYWORDS = new Set(["INT_VAR", "STR_VAR", "RET", "RET_ARRAY"]);

/** Associative array definition types. */
const ASSOC_ARRAY_DEF_TYPES = new Set(["action_define_associative_array", "patch_define_associative_array"]);

/** Primitive value types (for array definitions). */
const PRIMITIVE_TYPES = new Set(["value", "binary_expr", "variable_ref", "identifier", "string", "number"]);

/** Special action types that don't use action_ prefix. */
const SPECIAL_ACTION_TYPES = new Set(["text_sprint_action"]);

/** Special patch types that don't use patch_ prefix. */
const SPECIAL_PATCH_TYPES = new Set(["write_var", "read_var", "set_var"]);

// ============================================
// Comment utilities
// ============================================

/** Check if a node is a comment. */
export function isComment(node: SyntaxNode): boolean {
    return node.type === SyntaxType.LineComment || node.type === SyntaxType.Comment;
}

/** Normalize block comment: preserve content, just trim outer whitespace. */
export function normalizeBlockComment(text: string): string {
    return text.trim();
}

/** Normalize line comment: ensure space after // but preserve intentional indentation. */
export function normalizeLineComment(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("//")) {
        const afterSlashes = trimmed.slice(2);
        if (afterSlashes.length === 0) {
            return "//";
        }
        // If no space after //, add one; otherwise preserve original spacing
        if (afterSlashes[0] !== " " && afterSlashes[0] !== "\t") {
            return "// " + afterSlashes;
        }
        return trimmed;
    }
    return trimmed;
}

/** Normalize a comment node's text. */
export function normalizeComment(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("//")) {
        return normalizeLineComment(trimmed);
    }
    return normalizeBlockComment(trimmed);
}

/** Normalize line with potential inline comment. */
export function withNormalizedComment(line: string): string {
    if (!line.includes("//")) return line;
    const idx = line.indexOf("//");
    const before = line.slice(0, idx);
    if (!before.trim()) {
        // Standalone comment - preserve indent, normalize comment
        return before + normalizeLineComment(line.slice(idx));
    }
    // Inline comment
    const code = before.trimEnd();
    const comment = line.slice(idx + 2).trimStart();
    return comment ? code + INLINE_COMMENT_SPACING + "// " + comment : code + INLINE_COMMENT_SPACING + "//";
}

/**
 * Try to append an inline comment to the last line.
 * Returns true if successful, false if comment should be on its own line.
 */
export function tryAppendInlineComment(lines: string[], child: SyntaxNode, lastEndRow: number): boolean {
    if (lastEndRow < 0 || child.startPosition.row !== lastEndRow || lines.length === 0) {
        return false;
    }
    const lastLine = lines[lines.length - 1];
    if (lastLine === undefined || lastLine.includes("//")) {
        return false;
    }
    lines[lines.length - 1] = lastLine + INLINE_COMMENT_SPACING + normalizeComment(child.text);
    return true;
}

/**
 * Handle a comment node: try to append as inline comment, otherwise add on its own line.
 * This is the standard pattern for handling comments in body contexts.
 */
export function handleComment(lines: string[], child: SyntaxNode, indent: string, lastEndRow: number): void {
    if (!tryAppendInlineComment(lines, child, lastEndRow)) {
        lines.push(indent + normalizeComment(child.text));
    }
}

// ============================================
// Whitespace utilities
// ============================================

/** Normalize whitespace: collapse multiple spaces, preserve line comments. */
export function normalizeWhitespace(text: string): string {
    // Check if text contains block comments (/* */ or /** */)
    // Block comments must be preserved as-is with their newline structure
    const hasBlockComment = text.includes("/*");
    if (hasBlockComment) {
        // Don't normalize text containing block comments - return trimmed as-is
        return text.trim();
    }

    // Handle line comments specially - preserve content after //
    const lines = text.split("\n");
    const normalizedLines: string[] = [];
    let hasComments = false;

    for (const line of lines) {
        const commentIdx = line.indexOf("//");
        if (commentIdx >= 0) {
            hasComments = true;
            // Normalize before comment, preserve comment
            const before = line.slice(0, commentIdx).trim().replace(/\s+/g, " ");
            const comment = normalizeLineComment(line.slice(commentIdx));
            normalizedLines.push(before ? before + " " + comment : comment);
        } else {
            const normalized = line.trim().replace(/\s+/g, " ");
            if (normalized) {
                normalizedLines.push(normalized);
            }
        }
    }

    // Join with newlines if there are comments (to preserve comment line structure),
    // otherwise join with spaces to produce a single line for proper length checking
    return hasComments ? normalizedLines.join("\n").trim() : normalizedLines.join(" ").trim();
}

// ============================================
// Type predicates
// ============================================

/** Check if node type is a top-level directive. */
export function isTopLevelDirective(type: string): boolean {
    return TOP_LEVEL_DIRECTIVE_SET.has(type);
}

/** Check if node type is an action. */
export function isAction(type: string): boolean {
    return (
        type.startsWith("action_") ||
        type.startsWith("outer_") ||
        SPECIAL_ACTION_TYPES.has(type)
    );
}

/** Check if node type is a patch. */
export function isPatch(type: string): boolean {
    return (
        type.startsWith("patch_") ||
        type.startsWith("inner_") ||
        SPECIAL_PATCH_TYPES.has(type)
    );
}

/** Check if text is a parameter keyword. */
export function isParamKeyword(text: string): boolean {
    return PARAM_KEYWORDS.has(text);
}

/** Check if node type is a control flow construct with BEGIN...END body. */
export function isControlFlow(type: string): boolean {
    return CONTROL_FLOW_SET.has(type);
}

/** Check if node type is an associative array definition. */
export function isAssociativeArrayDef(type: string): boolean {
    return ASSOC_ARRAY_DEF_TYPES.has(type);
}

/** Check if node type is a FOR_EACH style loop with IN keyword. */
export function isForEach(type: string): boolean {
    return FOR_EACH_SET.has(type);
}

/** Check if node type is a function/macro definition. */
export function isFunctionDef(type: string): boolean {
    return FUNCTION_DEF_SET.has(type);
}

/** Check if node type is a function/macro call. */
export function isFunctionCall(type: string): boolean {
    return FUNCTION_CALL_SET.has(type);
}

/** Check if node type is a COPY-style action. */
export function isCopyAction(type: string): boolean {
    return COPY_ACTION_SET.has(type);
}

/** Check if node type is valid body content (actions, patches, control flow). */
export function isBodyContent(type: string): boolean {
    return (
        isAction(type) ||
        isPatch(type) ||
        isControlFlow(type) ||
        isFunctionCall(type) ||
        type === SyntaxType.TopLevelAssignment ||
        type === SyntaxType.PatchAssignment ||
        type === SyntaxType.InlinedFile
    );
}

/** Check if a node is a specific keyword. */
export function isKeyword(node: SyntaxNode, keyword: string): boolean {
    return node.text === keyword;
}

/** Match case types. */
const MATCH_CASE_TYPES = new Set(["match_case", "action_match_case", "assoc_entry"]);

/**
 * Check if a node type is valid body content for control flow constructs.
 *
 * Includes:
 * - Standard body content (actions, patches, control flow, function calls)
 * - Match cases for MATCH statements
 * - Associative array entries (key => value)
 * - Primitive values for array definitions (ACTION_DEFINE_ARRAY arr BEGIN 1 2 3 END)
 *
 * Note: Primitive types (string, number, identifier, variable_ref, binary_expr) are
 * included because array body content can be raw values, not wrapped in actions.
 */
export function isControlFlowBodyContent(type: string): boolean {
    return (
        isBodyContent(type) ||
        MATCH_CASE_TYPES.has(type) ||
        PRIMITIVE_TYPES.has(type) ||
        type === SyntaxType.DirectoryFileRegexp // For MAKE_BIFF, ACTION_BASH_FOR, PATCH_BASH_FOR
    );
}

// ============================================
// Aligned output utilities
// ============================================

/**
 * Output aligned assignments with optional keyword prefix.
 * Handles inline comments and alignment on separator.
 * @param separator - The separator between name and value (default " = ")
 */
export function outputAlignedAssignments(
    items: CollectedItem[],
    keyword: string,
    keywordIndent: string,
    assignIndent: string,
    separator: string = " = "
): string[] {
    const lines: string[] = [];

    // Find max name length for alignment (only for items with values)
    let maxNameLen = 0;
    for (const item of items) {
        if (item.type === CollectedItemType.Assignment && item.value) {
            maxNameLen = Math.max(maxNameLen, item.name.length);
        }
    }

    let keywordOutput = false;
    let lastEndRow = -1;

    for (const item of items) {
        if (item.type === CollectedItemType.Comment) {
            // Check for inline comment - comment starts on same row as previous item ended
            if (lastEndRow >= 0 && item.startRow === lastEndRow && lines.length > 0) {
                const lastLine = lines[lines.length - 1];
                if (lastLine !== undefined && !lastLine.includes("//")) {
                    lines[lines.length - 1] = lastLine + INLINE_COMMENT_SPACING + item.text;
                    continue;
                }
            }
            if (!keywordOutput && keyword) {
                lines.push(keywordIndent + keyword);
                keywordOutput = true;
            }
            lines.push(assignIndent + item.text);
        } else {
            if (!keywordOutput && keyword) {
                lines.push(keywordIndent + keyword);
                keywordOutput = true;
            }
            if (item.value) {
                const padding = " ".repeat(maxNameLen - item.name.length);
                lines.push(assignIndent + item.name + padding + separator + item.value);
            } else {
                // No value (variable_ref or name-only)
                lines.push(assignIndent + item.name);
            }
            lastEndRow = item.endRow;
        }
    }

    // Output keyword even if no assignments
    if (!keywordOutput && keyword) {
        lines.push(keywordIndent + keyword);
    }

    return lines;
}

/** Output collected header lines. */
export function outputHeaderLines(headerLines: string[][], lines: string[], indent: string, contIndent: string): void {
    for (let j = 0; j < headerLines.length; j++) {
        const lineParts = headerLines[j];
        if (lineParts && lineParts.length > 0) {
            const lineIndent = j === 0 ? indent : contIndent;
            lines.push(lineIndent + normalizeWhitespace(lineParts.join(" ")));
        }
    }
}

// ============================================
// Safe array access
// ============================================

/** Get last element of array safely. */
export function lastElement<T>(arr: T[]): T | undefined {
    return arr[arr.length - 1];
}
