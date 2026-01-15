/**
 * Core formatting logic for WeiDU TP2 files.
 * Handles proper indentation, comment normalization, and line breaking.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";

export interface FormatOptions {
    indentSize: number;
    lineLimit: number;
}

const DEFAULT_OPTIONS: FormatOptions = {
    indentSize: 4,
    lineLimit: 120,
};

export interface FormatResult {
    text: string;
    errors: FormatError[];
}

/** Reserved for future use - format errors will be reported here when error recovery is implemented. */
interface FormatError {
    message: string;
    line: number;
    column: number;
}

interface FormatContext {
    indent: string;
    lineLimit: number;
    indentSize: number;
}

const INLINE_COMMENT_SPACING = "  ";

// ============================================
// Node type constants
// ============================================

/** Top-level directive types. */
const TOP_LEVEL_DIRECTIVES = [
    "backup_directive",
    "author_directive",
    "support_directive",
    "version_flag",
    "readme_directive",
    "no_if_eval_bug_flag",
    "auto_eval_strings_flag",
    "allow_missing_directive",
    "language_directive",
    "inlined_file",
] as const;

/** FOR_EACH style loops with IN keyword. */
const FOR_EACH_TYPES = [
    "action_for_each",
    "action_php_each",
    "action_bash_for",
    "patch_for_each",
    "php_each_patch",
] as const;

/** Control flow types (IF, MATCH, TRY, WHILE, etc.). */
const CONTROL_FLOW_TYPES = [
    "action_if",
    "action_match",
    "action_try",
    "outer_for",
    "outer_while",
    "patch_if",
    "patch_match",
    "patch_try",
    "for_patch",
    "while_patch",
    "replace_evaluate_patch",
    "inner_patch",
    "inner_patch_save",
    "inner_patch_file",
    "inner_action",
    "decompile_and_patch",
    "with_tra_action",
    // Array definitions with BEGIN...END body
    "action_define_array",
    "action_define_associative_array",
    "define_associative_array_patch",
    // OUTER_* with BEGIN...END body
    "outer_patch_action",
    "outer_patch_save_action",
    "outer_inner_patch_action",
    "outer_inner_patch_save_action",
    // FOR_EACH types
    ...FOR_EACH_TYPES,
] as const;

/** COPY-style action types. */
const COPY_ACTION_TYPES = [
    "copy_action",
    "copy_existing_action",
    "copy_existing_regexp_action",
    "copy_large_action",
    "copy_random_action",
    "copy_all_gam_files_action",
    "create_action",
    "add_spell_action",
] as const;

/** Function/macro definition types. */
const FUNCTION_DEF_TYPES = [
    "define_action_macro",
    "define_patch_macro",
    "define_action_function",
    "define_patch_function",
] as const;

/** Function/macro call types (LPF, LAF, LPM, LAM). */
const FUNCTION_CALL_TYPES = [
    "launch_patch_function",
    "launch_action_function",
    "launch_patch_macro",
    "launch_action_macro",
] as const;

/** Special patch types not caught by isPatch(). */
const SPECIAL_PATCH_TYPES = [
    "compile_baf_to_bcs",
    "decompile_bcs_to_baf",
    "compile_d_to_dlg",
    "decompile_dlg_to_d",
    "evaluate_buffer",
    "get_offset_array",
    "get_offset_array2",
] as const;

// ============================================
// Comment utilities
// ============================================

function isComment(node: SyntaxNode): boolean {
    return node.type === "comment" || node.type === "line_comment";
}

/** Normalize block comments: preserve multi-line, normalize single-line. */
function normalizeBlockComment(text: string): string {
    if (text.includes("\n")) {
        return text; // Preserve multi-line block comments as-is
    }
    // Single-line block comment: preserve JSDoc-style /** ... */ or normalize to /* ... */
    if (text.startsWith("/**")) {
        const inner = text.slice(3, -2).trim();
        return "/** " + inner + " */";
    }
    const inner = text.slice(2, -2).trim();
    return "/* " + inner + " */";
}

/** Normalize line comment: ensure "// comment" format. */
function normalizeLineComment(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("//")) {
        const content = trimmed.slice(2).trimStart();
        return content ? "// " + content : "//";
    }
    return trimmed;
}

/** Normalize any comment. */
function normalizeComment(text: string): string {
    if (text.startsWith("/*")) {
        return normalizeBlockComment(text);
    }
    return normalizeLineComment(text);
}

/** Apply inline comment normalization to a line. */
function withNormalizedComment(line: string): string {
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
function tryAppendInlineComment(lines: string[], child: SyntaxNode, lastEndRow: number): boolean {
    if (lastEndRow < 0 || child.startPosition.row !== lastEndRow || lines.length === 0) {
        return false;
    }
    const lastLine = lines[lines.length - 1]!;
    if (lastLine.includes("//")) {
        return false;
    }
    lines[lines.length - 1] = lastLine + INLINE_COMMENT_SPACING + normalizeComment(child.text);
    return true;
}

// ============================================
// Text utilities
// ============================================

/**
 * Collapse whitespace to single spaces, but preserve newlines after line comments.
 * Line comments (//) consume everything until end of line, so we must keep line breaks after them.
 */
function normalizeWhitespace(text: string): string {
    // If no line comment, simple collapse
    if (!text.includes("//")) {
        return text.replace(/\s+/g, " ").trim();
    }

    // Split into lines and process each
    const lines = text.split("\n");
    const result: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const commentIdx = trimmed.indexOf("//");
        if (commentIdx >= 0) {
            // Line has a line comment - preserve it at end, normalize before it
            const before = trimmed.slice(0, commentIdx).replace(/\s+/g, " ").trim();
            const comment = normalizeLineComment(trimmed.slice(commentIdx));
            if (before) {
                result.push(before + " " + comment);
            } else {
                result.push(comment);
            }
        } else {
            // No comment - collapse whitespace, but may need to join with previous
            const normalized = trimmed.replace(/\s+/g, " ");
            // If previous line ended with a comment, start new line; otherwise join
            if (result.length > 0 && !result[result.length - 1]!.includes("//")) {
                result[result.length - 1] += " " + normalized;
            } else {
                result.push(normalized);
            }
        }
    }

    return result.join("\n");
}

/** Operand with optional preceding operator (OR/AND). */
interface ConditionOperand {
    operator: string | null; // null for first operand, "OR"/"AND" for subsequent
    text: string;
}

/**
 * Flatten a binary_expr tree with OR/AND into a list of operands.
 * Returns null if the expression doesn't use OR/AND at top level.
 */
function flattenOrAndExpr(node: SyntaxNode): ConditionOperand[] | null {
    const op = node.childForFieldName("op");
    if (!op) return null;

    const opText = op.text.toUpperCase();
    // Only split on OR/AND, not other binary operators
    if (opText !== "OR" && opText !== "AND" && opText !== "||" && opText !== "&&") {
        return null;
    }

    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    if (!left || !right) return null;

    const result: ConditionOperand[] = [];

    // Recursively flatten left side (for chained OR/AND)
    if (left.type === "binary_expr") {
        const leftFlat = flattenOrAndExpr(left);
        if (leftFlat) {
            result.push(...leftFlat);
        } else {
            result.push({ operator: null, text: normalizeWhitespace(left.text) });
        }
    } else {
        result.push({ operator: null, text: normalizeWhitespace(left.text) });
    }

    // Add right side with the operator
    // Normalize || to OR and && to AND for consistency
    const normalizedOp = opText === "||" ? "OR" : opText === "&&" ? "AND" : opText;
    result.push({ operator: normalizedOp, text: normalizeWhitespace(right.text) });

    return result;
}

/**
 * Format a condition, splitting at OR/AND boundaries if too long.
 * Returns array of lines.
 */
function formatCondition(
    conditionNode: SyntaxNode | null,
    prefix: string,
    indent: string,
    contIndent: string,
    lineLimit: number
): string[] {
    if (!conditionNode) {
        return [indent + prefix];
    }

    const condText = normalizeWhitespace(conditionNode.text);
    const fullLine = indent + prefix + " " + condText;

    if (fullLine.length <= lineLimit) {
        return [fullLine];
    }

    // Try to flatten OR/AND expressions
    if (conditionNode.type === "binary_expr") {
        const operands = flattenOrAndExpr(conditionNode);
        if (operands && operands.length > 1) {
            const lines: string[] = [];
            for (let i = 0; i < operands.length; i++) {
                const op = operands[i]!;
                if (i === 0) {
                    lines.push(indent + prefix + " " + op.text);
                } else {
                    lines.push(contIndent + op.operator + " " + op.text);
                }
            }
            return lines;
        }
    }

    // Can't split - return as single line
    return [fullLine];
}

// ============================================
// Node classification helpers
// ============================================

/** Check if this is a top-level directive. */
function isTopLevelDirective(type: string): boolean {
    return (TOP_LEVEL_DIRECTIVES as readonly string[]).includes(type);
}

/** Check if this is an action node. */
function isAction(type: string): boolean {
    return (
        type.endsWith("_action") ||
        type.startsWith("action_") ||
        type === "launch_action_function" ||
        type === "launch_action_macro"
    );
}

/** Check if this is a patch node. */
function isPatch(type: string): boolean {
    return (
        type.endsWith("_patch") ||
        type.startsWith("patch_") ||
        type === "launch_patch_function" ||
        type === "launch_patch_macro"
    );
}

/** Check if this is a special patch type not caught by isPatch(). */
function isSpecialPatch(type: string): boolean {
    return (SPECIAL_PATCH_TYPES as readonly string[]).includes(type);
}

/** Check if text is a parameter keyword (INT_VAR, STR_VAR, RET, RET_ARRAY). */
function isParamKeyword(text: string): boolean {
    const upper = text.toUpperCase();
    return upper === "INT_VAR" || upper === "STR_VAR" || upper === "RET" || upper === "RET_ARRAY";
}

/** Check if node type is a control flow construct with BEGIN...END body. */
function isControlFlow(type: string): boolean {
    return (CONTROL_FLOW_TYPES as readonly string[]).includes(type);
}

/** Check if node type is a FOR_EACH style loop with IN keyword. */
function isForEach(type: string): boolean {
    return (FOR_EACH_TYPES as readonly string[]).includes(type);
}

/** Check if node is a function/macro definition. */
function isFunctionDef(type: string): boolean {
    return (FUNCTION_DEF_TYPES as readonly string[]).includes(type);
}

/** Check if node is a function/macro call (LPF, LAF, LPM, LAM). */
function isFunctionCall(type: string): boolean {
    return (FUNCTION_CALL_TYPES as readonly string[]).includes(type);
}

/** Check if node is a COPY-style action with inline patches. */
function isCopyAction(type: string): boolean {
    return (COPY_ACTION_TYPES as readonly string[]).includes(type);
}

/** Check if node is valid body content (actions, patches, control flow, etc.). */
function isBodyContent(type: string): boolean {
    return (
        isAction(type) ||
        isPatch(type) ||
        isControlFlow(type) ||
        isFunctionCall(type) ||
        isSpecialPatch(type)
    );
}

/** Check if node text matches a keyword (case-insensitive). */
function isKeyword(node: SyntaxNode, keyword: string): boolean {
    return node.text.toUpperCase() === keyword;
}

// ============================================
// Formatters for specific node types
// ============================================

/**
 * Format a simple directive like BACKUP ~path~ or LANGUAGE.
 */
function formatDirective(node: SyntaxNode): string {
    return normalizeWhitespace(node.text);
}

/**
 * Format a component: BEGIN ~name~ followed by flags and actions, all at depth 0.
 * Comments are kept inline with their preceding element.
 */
function formatComponent(node: SyntaxNode, ctx: FormatContext): string {
    const lines: string[] = [];
    let beginLine = "";
    let currentLine = ""; // Current flag line being built
    let inBody = false;

    for (const child of node.children) {
        if (isComment(child)) {
            if (inBody) {
                // Comments in body at depth 0
                lines.push(normalizeComment(child.text));
            } else {
                // Comment in header - append to current line
                if (currentLine) {
                    currentLine += " " + normalizeComment(child.text);
                } else if (beginLine) {
                    beginLine += " " + normalizeComment(child.text);
                } else {
                    // Standalone comment before BEGIN
                    lines.push(normalizeComment(child.text));
                }
            }
            continue;
        }

        if (isKeyword(child, "BEGIN")) {
            beginLine = "BEGIN";
            continue;
        }

        // Component name - append to BEGIN line
        if (
            child.type === "string" ||
            child.type === "tilde_string" ||
            child.type === "double_string" ||
            child.type === "tra_ref" ||
            child.type === "identifier" ||
            child.type === "variable_ref"
        ) {
            beginLine += " " + child.text;
            continue;
        }

        // Flags - each on its own line at depth 0
        if (
            child.type === "designated_flag" ||
            child.type === "subcomponent_flag" ||
            child.type === "group_flag" ||
            child.type === "label_flag" ||
            child.type === "require_predicate_flag" ||
            child.type === "require_component_flag"
        ) {
            // Output previous line if any
            if (currentLine) {
                lines.push(currentLine);
            } else if (beginLine) {
                lines.push(beginLine);
                beginLine = "";
            }
            currentLine = normalizeWhitespace(child.text);
            continue;
        }

        // First action starts the body - all at depth 0
        if (isAction(child.type) || child.type === "top_level_assignment") {
            if (!inBody) {
                // Output pending lines
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = "";
                } else if (beginLine) {
                    lines.push(beginLine);
                    beginLine = "";
                }
                inBody = true;
            }
            lines.push(formatNode(child, ctx, 0));
            continue;
        }
    }

    // Output any pending line
    if (currentLine) {
        lines.push(currentLine);
    } else if (beginLine) {
        lines.push(beginLine);
    }

    return lines.join("\n");
}

/**
 * Format ALWAYS block: ALWAYS actions... END
 */
function formatAlwaysBlock(node: SyntaxNode, ctx: FormatContext): string {
    const lines: string[] = ["ALWAYS"];
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, "ALWAYS") || isKeyword(child, "END")) {
            continue;
        }
        if (isComment(child)) {
            if (!tryAppendInlineComment(lines, child, lastEndRow)) {
                lines.push(ctx.indent + normalizeComment(child.text));
            }
        } else if (child.type === "inlined_file") {
            lines.push(formatInlinedFile(child, ctx, 1));
            lastEndRow = child.endPosition.row;
        } else if (isAction(child.type) || child.type === "top_level_assignment") {
            lines.push(formatNode(child, ctx, 1));
            lastEndRow = child.endPosition.row;
        }
    }

    lines.push("END");
    return lines.join("\n");
}

/**
 * Format patch_file: a file containing only patches (e.g., .tpp includes).
 */
function formatPatchFile(node: SyntaxNode, ctx: FormatContext): string {
    const lines: string[] = [];

    for (const child of node.children) {
        if (isComment(child)) {
            lines.push(normalizeComment(child.text));
        } else {
            lines.push(formatNode(child, ctx, 0));
        }
    }

    return lines.join("\n");
}

/**
 * Format COPY-style action: COPY ~from~ ~to~ patches... [BUT_ONLY]
 */
function formatCopyAction(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const patchIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    // Separate keyword, file pairs, patches, and suffix
    let keyword = "";
    const filePairs: Array<{ text: string; comment?: string }> = [];
    let patches: SyntaxNode[] = [];
    let suffix: string[] = []; // BUT_ONLY, IF_EXISTS, etc.
    let inPatchArea = false; // Track when we've started seeing patches

    for (const child of node.children) {
        if (isComment(child)) {
            if (!inPatchArea && suffix.length === 0) {
                // Comment in file pair area - attach to previous file pair
                if (filePairs.length > 0) {
                    filePairs[filePairs.length - 1]!.comment = normalizeComment(child.text);
                }
                // Comments before any file pairs are rare and would be lost - acceptable tradeoff
            } else if (suffix.length === 0) {
                // Comment among patches
                patches.push(child);
            } else {
                suffix.push(normalizeComment(child.text));
            }
            continue;
        }

        if (child.type === "file_pair") {
            filePairs.push({ text: normalizeWhitespace(child.text) });
            continue;
        }

        if (
            isPatch(child.type) ||
            isControlFlow(child.type) ||
            isFunctionCall(child.type) ||
            isSpecialPatch(child.type) ||
            child.type === "patch_block" ||
            child.type === "unless_filter" ||
            child.type === "if_filter"
        ) {
            inPatchArea = true;
            patches.push(child);
        } else if (
            isKeyword(child, "BUT_ONLY") ||
            isKeyword(child, "BUT_ONLY_IF_IT_CHANGES") ||
            isKeyword(child, "IF_EXISTS") ||
            isKeyword(child, "UNLESS") ||
            (isKeyword(child, "IF") && inPatchArea) ||
            child.type === "_but_only"
        ) {
            // Collect suffix - includes filters (UNLESS, IF) and modifiers (BUT_ONLY, IF_EXISTS)
            // Order is preserved by pushing to array
            inPatchArea = true;
            suffix.push(child.text);
        } else if (child.type === "identifier" || child.type === "variable_ref") {
            // For CREATE-style actions: type and resref are identifiers
            if (suffix.length > 0) {
                // After a filter keyword, identifiers are part of filter pattern
                suffix.push(child.text);
            } else if (filePairs.length === 0 && keyword) {
                // First identifier after keyword
                filePairs.push({ text: child.text });
            } else if (filePairs.length > 0 && !inPatchArea) {
                // Append to previous entry
                filePairs[filePairs.length - 1]!.text += " " + child.text;
            } else {
                filePairs.push({ text: child.text });
            }
        } else if (suffix.length > 0) {
            // After suffix started - strings are filter patterns (UNLESS ~pattern~)
            suffix.push(child.text);
        } else if (inPatchArea) {
            // In patch area but before suffix - should be caught by patch check
            patches.push(child);
        } else {
            // COPY keyword or other header part
            const isFileContent =
                child.type === "string" ||
                child.type === "tilde_string" ||
                child.type === "double_string" ||
                child.type === "percent_string";
            if (!keyword) {
                keyword = child.text.toUpperCase();
            } else if (!isFileContent && filePairs.length === 0) {
                // Flags before first file pattern (e.g., GLOB, +, -) stay with keyword
                keyword += " " + child.text;
            } else if (filePairs.length > 0 && !isFileContent) {
                // Append flags to last file pair
                filePairs[filePairs.length - 1]!.text += " " + child.text;
            } else {
                filePairs.push({ text: child.text });
            }
        }
    }

    // Build output
    // First line: keyword + first file pair
    if (filePairs.length > 0) {
        let firstLine = indent + keyword + " " + filePairs[0]!.text;
        if (filePairs[0]!.comment) {
            firstLine += " " + filePairs[0]!.comment;
        }
        lines.push(firstLine);

        // Additional file pairs indented to align
        const fileIndent = indent + " ".repeat(keyword.length + 1);
        for (let i = 1; i < filePairs.length; i++) {
            let fpLine = fileIndent + filePairs[i]!.text;
            if (filePairs[i]!.comment) {
                fpLine += " " + filePairs[i]!.comment;
            }
            lines.push(fpLine);
        }
    } else {
        lines.push(indent + keyword);
    }

    // Format patches
    let lastPatchEndRow = -1;
    for (const patch of patches) {
        if (isComment(patch)) {
            if (!tryAppendInlineComment(lines, patch, lastPatchEndRow)) {
                lines.push(patchIndent + normalizeComment(patch.text));
            }
        } else if (patch.type === "patch_block") {
            // BEGIN patches... END
            lines.push(patchIndent + "BEGIN");
            let lastBlockPatchEndRow = -1;
            for (const patchChild of patch.children) {
                if (isKeyword(patchChild, "BEGIN") || isKeyword(patchChild, "END")) {
                    continue;
                }
                if (isComment(patchChild)) {
                    if (!tryAppendInlineComment(lines, patchChild, lastBlockPatchEndRow)) {
                        lines.push(ctx.indent.repeat(depth + 2) + normalizeComment(patchChild.text));
                    }
                } else if (isPatch(patchChild.type) || isControlFlow(patchChild.type)) {
                    lines.push(formatNode(patchChild, ctx, depth + 2));
                    lastBlockPatchEndRow = patchChild.endPosition.row;
                }
            }
            lines.push(patchIndent + "END");
            lastPatchEndRow = patch.endPosition.row;
        } else {
            lines.push(formatNode(patch, ctx, depth + 1));
            lastPatchEndRow = patch.endPosition.row;
        }
    }

    // Add suffix - handle line comments specially (content after them needs new line)
    if (suffix.length > 0) {
        let suffixLine = "";
        for (const part of suffix) {
            if (suffixLine.includes("//")) {
                // Previous line had a comment, start new line
                lines.push(indent + suffixLine);
                suffixLine = part;
            } else if (suffixLine) {
                suffixLine += " " + part;
            } else {
                suffixLine = part;
            }
        }
        if (suffixLine) {
            lines.push(indent + suffixLine);
        }
    }

    return lines.join("\n");
}

/**
 * Format FOR loop with pre-formatted header.
 */
function formatForLoop(node: SyntaxNode, ctx: FormatContext, depth: number, header: string): string {
    const indent = ctx.indent.repeat(depth);
    const lines: string[] = [];
    const bodyDepth = depth + 1;

    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, "BEGIN")) {
            lines.push(indent + header + " BEGIN");
            inBody = true;
            continue;
        }

        if (isKeyword(child, "END")) {
            lines.push(indent + "END");
            continue;
        }

        if (inBody) {
            if (isComment(child)) {
                if (!tryAppendInlineComment(lines, child, lastEndRow)) {
                    lines.push(ctx.indent.repeat(bodyDepth) + normalizeComment(child.text));
                }
            } else if (isBodyContent(child.type)) {
                lines.push(formatNode(child, ctx, bodyDepth));
                lastEndRow = child.endPosition.row;
            }
        }
    }

    return lines.join("\n");
}

/**
 * Format FOR loop header: FOR (init; condition; increment)
 * Returns formatted header string or null if not a FOR loop.
 */
function formatForLoopHeader(node: SyntaxNode): string | null {
    if (node.type !== "for_patch" && node.type !== "outer_for") {
        return null;
    }

    const parts: string[] = [];
    let inParens = false;
    let parenContent: string[] = [];

    for (const child of node.children) {
        const upper = child.text.toUpperCase();
        if (upper === "FOR" || upper === "OUTER_FOR") {
            parts.push(upper);
            continue;
        }
        if (child.text === "(") {
            inParens = true;
            continue;
        }
        if (child.text === ")") {
            inParens = false;
            // Format paren content: join with "; " but no space before semicolons
            parts.push("(" + parenContent.join("; ") + ")");
            continue;
        }
        if (isKeyword(child, "BEGIN")) {
            break; // Stop at BEGIN, we only want the header
        }
        if (inParens) {
            if (child.text === ";") {
                // Semicolons handled by join
                continue;
            }
            if (!isComment(child)) {
                // Normalize whitespace in expressions
                parenContent.push(normalizeWhitespace(child.text));
            }
        }
    }

    return parts.join(" ");
}

/**
 * Format FOR_EACH style loop: PATCH_FOR_EACH var IN items BEGIN body END
 * Handles oneItemPerLine logic for long item lists.
 */
function formatForEach(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    // First pass: collect header parts and items after IN
    const headerParts: string[] = []; // PATCH_FOR_EACH var
    const itemsAfterIN: string[] = [];
    let seenIN = false;

    for (const child of node.children) {
        if (isKeyword(child, "BEGIN")) {
            break;
        }
        if (isKeyword(child, "IN")) {
            seenIN = true;
            headerParts.push("IN");
            continue;
        }
        if (isComment(child)) {
            continue; // Skip comments in first pass
        }
        if (seenIN) {
            itemsAfterIN.push(child.text);
        } else {
            headerParts.push(child.text);
        }
    }

    // Determine if items should be one per line
    const allItemsLength = itemsAfterIN.join(" ").length;
    const headerLength = indent.length + headerParts.join(" ").length + 1 + allItemsLength;
    const oneItemPerLine = itemsAfterIN.length > 1 && headerLength > ctx.lineLimit;

    // Build output
    if (oneItemPerLine) {
        // Header without items, then each item on its own line
        lines.push(indent + headerParts.join(" "));
        for (const item of itemsAfterIN) {
            lines.push(bodyIndent + item);
        }
        lines.push(indent + "BEGIN");
    } else {
        // Everything on one line with BEGIN
        const fullHeader = headerParts.join(" ") + " " + itemsAfterIN.join(" ");
        lines.push(indent + fullHeader + " BEGIN");
    }

    // Second pass: format body
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, "BEGIN")) {
            inBody = true;
            continue;
        }
        if (isKeyword(child, "END")) {
            lines.push(indent + "END");
            continue;
        }
        if (!inBody) {
            continue;
        }

        if (isComment(child)) {
            if (!tryAppendInlineComment(lines, child, lastEndRow)) {
                lines.push(bodyIndent + normalizeComment(child.text));
            }
        } else if (isBodyContent(child.type)) {
            lines.push(formatNode(child, ctx, depth + 1));
            lastEndRow = child.endPosition.row;
        }
    }

    return lines.join("\n");
}

/**
 * Format control flow: ACTION_IF cond BEGIN actions END [ELSE BEGIN actions END]
 */
function formatControlFlow(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const lines: string[] = [];

    // Special handling for FOR loops
    const forHeader = formatForLoopHeader(node);
    if (forHeader !== null) {
        return formatForLoop(node, ctx, depth, forHeader);
    }

    // Special handling for FOR_EACH style loops
    if (isForEach(node.type)) {
        return formatForEach(node, ctx, depth);
    }

    // Build header as list of lines, each line is array of parts
    // Line comments force a new line after them
    let headerLines: string[][] = [[]];
    let conditionNode: SyntaxNode | null = null; // Track condition node for IF statements
    let headerKeyword = ""; // Track the keyword (PATCH_IF, ACTION_IF, etc.)
    let inBody = false;
    let afterELSE = false; // Track if we just saw ELSE (for else-if chains)
    const bodyDepth = depth + 1;
    let lastEndRow = -1; // Track last node's end row for inline comments
    let beginRow = -1; // Track BEGIN's row for inline comments after BEGIN
    const contIndent = indent + ctx.indent;

    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]!;

        if (isKeyword(child, "BEGIN")) {
            const wasAfterELSE = afterELSE;
            afterELSE = false; // Reset after ELSE flag

            // If we're after ELSE, just append BEGIN to the ELSE line
            if (wasAfterELSE && lines.length > 0 && lines[lines.length - 1]!.trimEnd().endsWith("ELSE")) {
                lines[lines.length - 1] += " BEGIN";
                headerLines = [[]];
                conditionNode = null;
                headerKeyword = "";
                inBody = true;
                continue;
            }

            // Use grammar-based condition formatting for IF statements
            if (conditionNode && headerKeyword) {
                const condLines = formatCondition(conditionNode, headerKeyword, indent, contIndent, ctx.lineLimit);
                lines.push(...condLines);
                if (condLines.length > 1) {
                    lines.push(indent + "BEGIN");
                } else {
                    lines[lines.length - 1] += " BEGIN";
                }
                headerLines = [[]];
                conditionNode = null;
                headerKeyword = "";
                inBody = true;
                beginRow = child.startPosition.row;
                continue;
            }

            // Fallback: output header lines then BEGIN
            // Count non-empty lines
            let nonEmptyCount = 0;
            for (const lineParts of headerLines) {
                if (lineParts.length > 0) nonEmptyCount++;
            }

            // If multiple lines, put BEGIN on its own line
            const multiLine = nonEmptyCount > 1;

            for (let j = 0; j < headerLines.length; j++) {
                const lineParts = headerLines[j]!;
                if (lineParts.length > 0) {
                    const lineIndent = j === 0 ? indent : contIndent;
                    lines.push(lineIndent + normalizeWhitespace(lineParts.join(" ")));
                }
            }

            // Check if last line ends with a line comment - can't append BEGIN to comment
            const lastLine = lines[lines.length - 1] ?? "";
            const endsWithComment = lastLine.includes("//");

            if (multiLine || nonEmptyCount === 0 || endsWithComment) {
                lines.push(indent + "BEGIN");
            } else {
                // Single line header - append BEGIN to it
                const lastIdx = lines.length - 1;
                if (lastIdx >= 0) {
                    lines[lastIdx] += " BEGIN";
                } else {
                    lines.push(indent + "BEGIN");
                }
            }
            headerLines = [[]];
            inBody = true;
            beginRow = child.startPosition.row;
            continue;
        }

        if (isKeyword(child, "END")) {
            inBody = false;
            lines.push(indent + "END");
            continue;
        }

        if (isKeyword(child, "ELSE")) {
            // Append ELSE to the previous END line
            if (lines.length > 0 && lines[lines.length - 1]!.trimEnd().endsWith("END")) {
                lines[lines.length - 1] += " ELSE";
            } else {
                lines.push(indent + "ELSE");
            }
            afterELSE = true; // Track that we just saw ELSE
            continue;
        }

        if (isKeyword(child, "THEN")) {
            headerLines[headerLines.length - 1]!.push("THEN");
            continue;
        }

        if (isKeyword(child, "WITH")) {
            // WITH starts body for PATCH_MATCH/ACTION_MATCH
            // Output header parts first
            for (const lineParts of headerLines) {
                if (lineParts.length > 0) {
                    lines.push(indent + normalizeWhitespace(lineParts.join(" ")));
                }
            }
            headerLines = [[]];
            lines.push(indent + "WITH");
            inBody = true;
            continue;
        }

        if (isKeyword(child, "DEFAULT")) {
            lines.push(indent + "DEFAULT");
            continue;
        }

        // Handle else-if chains: ELSE PATCH_IF/ACTION_IF without BEGIN
        if (afterELSE && (child.type === "action_if" || child.type === "patch_if")) {
            lines.push(formatNode(child, ctx, depth));
            afterELSE = false;
            continue;
        }

        if (isComment(child)) {
            if (inBody) {
                // Check if this is an inline comment (same row as BEGIN or previous item)
                const rowToCheck = beginRow >= 0 ? beginRow : lastEndRow;
                if (tryAppendInlineComment(lines, child, rowToCheck)) {
                    beginRow = -1;
                    continue;
                }
                lines.push(ctx.indent.repeat(bodyDepth) + normalizeComment(child.text));
                beginRow = -1; // Reset after first non-inline body item
            } else if (afterELSE) {
                // Comment between ELSE and BEGIN - keep at ELSE indent level
                lines.push(indent + normalizeComment(child.text));
            } else {
                // Add comment to current header line
                headerLines[headerLines.length - 1]!.push(normalizeComment(child.text));
                // Line comments force a new line after them
                if (child.type === "line_comment") {
                    headerLines.push([]);
                }
            }
            continue;
        }

        if (inBody) {
            // Body content (actions, patches, control flow, inlined files, array entries)
            // Note: else-if chains (ELSE ACTION_IF without BEGIN) are handled above at afterELSE check
            if (
                isBodyContent(child.type) ||
                child.type === "match_case" ||
                child.type === "action_match_case" ||
                child.type === "inlined_file" ||
                child.type === "assoc_entry" ||
                child.type === "binary_expr" ||
                child.type === "variable_ref" ||
                child.type === "identifier" ||
                child.type === "string" ||
                child.type === "number"
            ) {
                lines.push(formatNode(child, ctx, bodyDepth));
                lastEndRow = child.endPosition.row;
                beginRow = -1; // Reset after first body item
            }
        } else {
            // Header content (keyword, condition)
            // Detect IF keywords and save condition node for grammar-based formatting
            const upperText = child.text.toUpperCase();
            if (upperText === "PATCH_IF" || upperText === "ACTION_IF") {
                headerKeyword = upperText;
                // The condition is a named field on the parent node
                conditionNode = node.childForFieldName("condition") ?? null;
                // Don't add keyword to headerLines - formatCondition will handle it
                continue;
            }
            // Skip the condition node if we're using grammar-based formatting
            if (conditionNode && child === conditionNode) {
                continue;
            }
            headerLines[headerLines.length - 1]!.push(child.text);
        }
    }

    // If we still have header parts (shouldn't happen normally)
    for (const lineParts of headerLines) {
        if (lineParts.length > 0) {
            lines.push(indent + normalizeWhitespace(lineParts.join(" ")));
        }
    }

    return lines.join("\n");
}

/** Collected assignment for aligned output. */
interface AssignmentItem {
    type: "assignment";
    name: string;
    value: string;
    endRow: number;
}

/** Collected comment for aligned output. */
interface CommentItem {
    type: "comment";
    text: string;
    endRow: number;
}

/** Discriminated union for collected items. */
type CollectedItem = AssignmentItem | CommentItem;

/**
 * Output aligned assignments with optional keyword prefix.
 * Handles inline comments and alignment on '='.
 */
function outputAlignedAssignments(
    items: CollectedItem[],
    keyword: string,
    keywordIndent: string,
    assignIndent: string
): string[] {
    const lines: string[] = [];

    // Find max name length for alignment (only for items with values)
    let maxNameLen = 0;
    for (const item of items) {
        if (item.type === "assignment" && item.value) {
            maxNameLen = Math.max(maxNameLen, item.name.length);
        }
    }

    let keywordOutput = false;
    let lastEndRow = -1;

    for (const item of items) {
        if (item.type === "comment") {
            // Check for inline comment
            if (lastEndRow >= 0 && item.endRow === lastEndRow && lines.length > 0) {
                const lastLine = lines[lines.length - 1]!;
                if (!lastLine.includes("//")) {
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
                lines.push(assignIndent + item.name + padding + " = " + item.value);
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

/**
 * Format parameter declaration block (INT_VAR, STR_VAR, RET, RET_ARRAY).
 * Keyword on its own line, assignments indented one level below, aligned on '='.
 */
function formatParamDecl(node: SyntaxNode, indent: string, ctx: FormatContext): string[] {
    const assignIndent = indent + ctx.indent;
    let keyword = "";

    // Collect all assignments and comments
    const items: CollectedItem[] = [];
    let currentName = "";
    let currentValue: string[] = [];
    let lastChildEndRow = -1;

    for (const child of node.children) {
        if (isParamKeyword(child.text)) {
            keyword = child.text.toUpperCase();
            continue;
        }

        if (isComment(child)) {
            // Save pending assignment first
            if (currentName) {
                items.push({ type: "assignment", name: currentName, value: currentValue.join(" "), endRow: lastChildEndRow });
                currentName = "";
                currentValue = [];
            }
            items.push({ type: "comment", text: normalizeComment(child.text), endRow: child.endPosition.row });
            continue;
        }

        // Start of new assignment (identifier or string as param name)
        if (child.type === "identifier" || child.type === "string" || child.type === "double_string") {
            if (currentName) {
                items.push({ type: "assignment", name: currentName, value: currentValue.join(" "), endRow: lastChildEndRow });
                currentValue = [];
            }
            currentName = child.text;
            lastChildEndRow = child.endPosition.row;
        } else if (child.text === "=") {
            // Skip, added during output
        } else {
            currentValue.push(normalizeWhitespace(child.text));
            lastChildEndRow = child.endPosition.row;
        }
    }

    // Save last assignment
    if (currentName) {
        items.push({ type: "assignment", name: currentName, value: currentValue.join(" "), endRow: lastChildEndRow });
    }

    return outputAlignedAssignments(items, keyword, indent, assignIndent);
}

/**
 * Extract name and value from an assignment expression.
 * For "name = value" returns { name, value }, otherwise returns null.
 */
function parseAssignment(node: SyntaxNode): { name: string; value: string } | null {
    // binary_expr has fields: left, op, right
    if (node.type === "binary_expr") {
        const left = node.childForFieldName("left");
        const op = node.childForFieldName("op");
        const right = node.childForFieldName("right");
        if (left && op && op.text === "=" && right) {
            return {
                name: normalizeWhitespace(left.text),
                value: normalizeWhitespace(right.text),
            };
        }
    }
    return null;
}

/**
 * Format parameter call block (int_var_call, str_var_call, ret_call, ret_array_call).
 * Keyword on its own line, assignments indented one level below, aligned on '='.
 */
function formatParamCall(node: SyntaxNode, indent: string, ctx: FormatContext): string[] {
    const children = node.children;
    const assignIndent = indent + ctx.indent;
    let keyword = "";

    // First pass: collect all items
    const items: CollectedItem[] = [];

    for (const child of children) {
        if (isParamKeyword(child.text)) {
            keyword = child.text.toUpperCase();
            continue;
        }

        if (isComment(child)) {
            items.push({ type: "comment", text: normalizeComment(child.text), endRow: child.endPosition.row });
            continue;
        }

        // binary_expr nodes are assignments, ternary_expr for conditionals, variable_ref are just names
        if (child.type === "binary_expr" || child.type === "ternary_expr") {
            const parsed = parseAssignment(child);
            if (parsed) {
                items.push({ type: "assignment", name: parsed.name, value: parsed.value, endRow: child.endPosition.row });
            } else {
                // Couldn't parse, output as-is (treat as assignment with no alignment)
                items.push({ type: "assignment", name: normalizeWhitespace(child.text), value: "", endRow: child.endPosition.row });
            }
        } else if (child.type === "variable_ref" || child.type === "identifier") {
            // Just a name without value
            items.push({ type: "assignment", name: child.text, value: "", endRow: child.endPosition.row });
        }
    }

    return outputAlignedAssignments(items, keyword, indent, assignIndent);
}

/**
 * Format function definition: DEFINE_ACTION_FUNCTION name params BEGIN body END
 */
function formatFunctionDef(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    let defLine = ""; // DEFINE_xxx_FUNCTION name
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, "BEGIN")) {
            // Output def line if we have one
            if (defLine) {
                lines.push(indent + defLine);
                defLine = "";
            }
            lines.push(indent + "BEGIN");
            inBody = true;
            continue;
        }

        if (isKeyword(child, "END")) {
            inBody = false;
            lines.push(indent + "END");
            continue;
        }

        if (isComment(child)) {
            if (inBody) {
                if (!tryAppendInlineComment(lines, child, lastEndRow)) {
                    lines.push(bodyIndent + normalizeComment(child.text));
                }
            } else {
                // Comment in header - output after current def line
                if (defLine) {
                    lines.push(indent + defLine);
                    defLine = "";
                }
                lines.push(indent + normalizeComment(child.text));
            }
            continue;
        }

        if (inBody) {
            if (isBodyContent(child.type)) {
                lines.push(formatNode(child, ctx, depth + 1));
                lastEndRow = child.endPosition.row;
            } else if (child.type === "inlined_file") {
                lines.push(formatInlinedFile(child, ctx, depth + 1));
                lastEndRow = child.endPosition.row;
            }
        } else {
            // Header: DEFINE keyword, function name, or param declarations
            if (
                child.type === "int_var_decl" ||
                child.type === "str_var_decl" ||
                child.type === "ret_decl" ||
                child.type === "ret_array_decl"
            ) {
                // Output def line first
                if (defLine) {
                    lines.push(indent + defLine);
                    defLine = "";
                }
                // Format parameter declarations - each assignment on its own line
                const declLines = formatParamDecl(child, bodyIndent, ctx);
                lines.push(...declLines);
            } else if (child.text.toUpperCase().startsWith("DEFINE_")) {
                // Start of function definition
                defLine = normalizeWhitespace(child.text);
            } else if (child.type === "identifier" && !defLine.includes(" ")) {
                // Function name - append to def line
                if (defLine) {
                    defLine += " " + child.text;
                } else {
                    defLine = child.text;
                }
            } else {
                // Other header parts
                if (defLine) {
                    defLine += " " + normalizeWhitespace(child.text);
                } else {
                    defLine = normalizeWhitespace(child.text);
                }
            }
        }
    }

    // Output any remaining def line
    if (defLine) {
        lines.push(indent + defLine);
    }

    return lines.join("\n");
}

/**
 * Format a simple patch or action as a single line.
 */
function formatSimpleNode(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    return withNormalizedComment(indent + normalizeWhitespace(node.text));
}

/**
 * Format match_case: values BEGIN body END
 */
function formatMatchCase(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    let headerParts: string[] = [];
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, "BEGIN")) {
            const header = normalizeWhitespace(headerParts.join(" "));
            // If header contains line comment, can't append BEGIN to it
            if (header.includes("//")) {
                lines.push(indent + header);
                lines.push(indent + "BEGIN");
            } else {
                lines.push(indent + header + " BEGIN");
            }
            headerParts = [];
            inBody = true;
            continue;
        }

        if (isKeyword(child, "END")) {
            lines.push(indent + "END");
            inBody = false;
            continue;
        }

        if (isComment(child)) {
            if (inBody) {
                if (!tryAppendInlineComment(lines, child, lastEndRow)) {
                    lines.push(bodyIndent + normalizeComment(child.text));
                }
            } else {
                headerParts.push(normalizeComment(child.text));
            }
            continue;
        }

        if (inBody) {
            if (isBodyContent(child.type)) {
                lines.push(formatNode(child, ctx, depth + 1));
                lastEndRow = child.endPosition.row;
            }
        } else {
            headerParts.push(child.text);
        }
    }

    return lines.join("\n");
}

/**
 * Format inlined file: <<<<<<<< filename\nbody\n>>>>>>>>
 */
function formatInlinedFile(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    // Preserve inlined files as-is since they contain arbitrary content
    return indent + node.text;
}

/**
 * Format function/macro call: LPF/LAF/LPM/LAM name INT_VAR/STR_VAR... END
 */
function formatFunctionCall(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const paramIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    let callLine = ""; // LPF/LAF/LPM/LAM name

    for (const child of node.children) {
        if (isKeyword(child, "END")) {
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            lines.push(indent + "END");
            continue;
        }

        if (isComment(child)) {
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            lines.push(indent + normalizeComment(child.text));
            continue;
        }

        // INT_VAR, STR_VAR, RET, RET_ARRAY declarations go on their own lines
        if (
            child.type === "int_var_call" ||
            child.type === "str_var_call" ||
            child.type === "ret_call" ||
            child.type === "ret_array_call"
        ) {
            // Output call line first
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            // Format with each assignment on its own line
            const paramLines = formatParamCall(child, paramIndent, ctx);
            lines.push(...paramLines);
        } else if (
            isKeyword(child, "LPF") ||
            isKeyword(child, "LAF") ||
            isKeyword(child, "LPM") ||
            isKeyword(child, "LAM")
        ) {
            // Start of call
            callLine = child.text.toUpperCase();
        } else if (child.type === "identifier") {
            // Function/macro name
            if (callLine) {
                callLine += " " + child.text;
            } else {
                callLine = child.text;
            }
        } else {
            // Other parts (shouldn't happen often)
            if (callLine) {
                callLine += " " + normalizeWhitespace(child.text);
            } else {
                callLine = normalizeWhitespace(child.text);
            }
        }
    }

    // Output any remaining call line
    if (callLine) {
        lines.push(indent + callLine);
    }

    return lines.join("\n");
}

// ============================================
// Main formatting dispatcher
// ============================================

/**
 * Format a node at the given depth.
 */
function formatNode(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const type = node.type;

    // Top-level directives
    if (isTopLevelDirective(type)) {
        if (type === "inlined_file") {
            return formatInlinedFile(node, ctx, depth);
        }
        return formatDirective(node);
    }

    // Blocks
    if (type === "component") {
        return formatComponent(node, ctx);
    }

    if (type === "always_block") {
        return formatAlwaysBlock(node, ctx);
    }

    // Patch file (top-level patches for .tpp files)
    if (type === "patch_file") {
        return formatPatchFile(node, ctx);
    }

    // COPY-style actions
    if (isCopyAction(type)) {
        return formatCopyAction(node, ctx, depth);
    }

    // Control flow
    if (isControlFlow(type)) {
        return formatControlFlow(node, ctx, depth);
    }

    // Function/macro definitions
    if (isFunctionDef(type)) {
        return formatFunctionDef(node, ctx, depth);
    }

    // Match cases
    if (type === "match_case" || type === "action_match_case") {
        return formatMatchCase(node, ctx, depth);
    }

    // Function/macro calls (LPF, LAF, LPM, LAM)
    if (isFunctionCall(type)) {
        return formatFunctionCall(node, ctx, depth);
    }

    // Simple nodes (actions, patches, assignments)
    return formatSimpleNode(node, ctx, depth);
}

// ============================================
// Main entry point
// ============================================

/**
 * Format a TP2 document.
 */
export function formatDocument(root: SyntaxNode, options?: Partial<FormatOptions>): FormatResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const ctx: FormatContext = {
        indent: " ".repeat(opts.indentSize),
        lineLimit: opts.lineLimit,
        indentSize: opts.indentSize,
    };

    const result: string[] = [];
    let lastEndRow = -1;

    for (const child of root.children) {
        // Check if this is an inline comment (on same line as previous item)
        if (isComment(child) && lastEndRow >= 0 && child.startPosition.row === lastEndRow) {
            // Append inline comment to previous line
            // Handle multi-line results by appending to the last non-empty line
            if (result.length > 0) {
                // Find the last line of the result array
                const lastResult = result[result.length - 1]!;
                const lastResultLines = lastResult.split("\n");
                const lastLine = lastResultLines[lastResultLines.length - 1]!;
                if (!lastLine.includes("//")) {
                    lastResultLines[lastResultLines.length - 1] = lastLine + INLINE_COMMENT_SPACING + normalizeComment(child.text);
                    result[result.length - 1] = lastResultLines.join("\n");
                    continue;
                }
            }
        }

        // Preserve blank lines between top-level items (only if present in source)
        if (lastEndRow >= 0 && child.startPosition.row > lastEndRow + 1) {
            result.push("");
        }

        // Ensure blank line before components (BEGIN blocks) for readability
        if (child.type === "component" && result.length > 0 && result[result.length - 1] !== "") {
            result.push("");
        }

        if (isComment(child)) {
            result.push(normalizeComment(child.text));
        } else {
            result.push(formatNode(child, ctx, 0));
        }

        lastEndRow = child.endPosition.row;
    }

    // Ensure exactly one trailing newline
    while (result.length > 0 && result[result.length - 1] === "") {
        result.pop();
    }

    return {
        text: result.join("\n") + "\n",
        errors: [],
    };
}
