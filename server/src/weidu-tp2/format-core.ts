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
// Keyword constants
// ============================================

const KW_BEGIN = "BEGIN";
const KW_END = "END";
const KW_ELSE = "ELSE";
const KW_THEN = "THEN";
const KW_WITH = "WITH";
const KW_DEFAULT = "DEFAULT";
const KW_IN = "IN";
const KW_ALWAYS = "ALWAYS";
const KW_BUT_ONLY = "BUT_ONLY";
const KW_BUT_ONLY_IF_IT_CHANGES = "BUT_ONLY_IF_IT_CHANGES";
const KW_IF_EXISTS = "IF_EXISTS";
const KW_UNLESS = "UNLESS";
const KW_IF = "IF";
const KW_FOR = "FOR";
const KW_OUTER_FOR = "OUTER_FOR";
const KW_LPF = "LPF";
const KW_LAF = "LAF";
const KW_LPM = "LPM";
const KW_LAM = "LAM";
const KW_PATCH_IF = "PATCH_IF";
const KW_ACTION_IF = "ACTION_IF";

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

/** Normalize line comment: ensure space after // but preserve intentional indentation. */
function normalizeLineComment(text: string): string {
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

/**
 * Handle a comment node: try to append as inline comment, otherwise add on its own line.
 * This is the standard pattern for handling comments in body contexts.
 */
function handleComment(lines: string[], child: SyntaxNode, indent: string, lastEndRow: number): void {
    if (!tryAppendInlineComment(lines, child, lastEndRow)) {
        lines.push(indent + normalizeComment(child.text));
    }
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

    // Only split on OR/AND, not other binary operators
    const opText = op.text;
    if (opText !== "OR" && opText !== "AND") {
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

    // Add right side with the operator (preserve original case)
    result.push({ operator: op.text, text: normalizeWhitespace(right.text) });

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

    // Find the actual expression to split - may be wrapped in paren_expr
    let exprNode = conditionNode;
    let hasOuterParens = false;
    if (exprNode.type === "paren_expr" && exprNode.children.length > 0) {
        // Look for binary_expr inside parentheses
        for (const child of exprNode.children) {
            if (child.type === "binary_expr") {
                exprNode = child;
                hasOuterParens = true;
                break;
            }
        }
    }

    // Try to flatten OR/AND expressions
    if (exprNode.type === "binary_expr") {
        const operands = flattenOrAndExpr(exprNode);
        if (operands && operands.length > 1) {
            const lines: string[] = [];
            const openParen = hasOuterParens ? "(" : "";
            const closeParen = hasOuterParens ? ")" : "";
            for (let i = 0; i < operands.length; i++) {
                const op = operands[i]!;
                if (i === 0) {
                    lines.push(indent + prefix + " " + openParen + op.text);
                } else if (i === operands.length - 1) {
                    lines.push(contIndent + op.operator + " " + op.text + closeParen);
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
    return text === "INT_VAR" || text === "STR_VAR" || text === "RET" || text === "RET_ARRAY";
}

/** Check if node type is a control flow construct with BEGIN...END body. */
function isControlFlow(type: string): boolean {
    return (CONTROL_FLOW_TYPES as readonly string[]).includes(type);
}

/** Check if node type is an associative array definition. */
function isAssociativeArrayDef(type: string): boolean {
    return type === "action_define_associative_array" || type === "define_associative_array_patch";
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

/** Check if node text matches a keyword. */
function isKeyword(node: SyntaxNode, keyword: string): boolean {
    return node.text === keyword;
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

        if (isKeyword(child, KW_BEGIN)) {
            beginLine = KW_BEGIN;
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
    const lines: string[] = [KW_ALWAYS];
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_ALWAYS) || isKeyword(child, KW_END)) {
            continue;
        }
        if (isComment(child)) {
            handleComment(lines, child, ctx.indent, lastEndRow);
        } else if (child.type === "inlined_file") {
            lines.push(formatInlinedFile(child, ctx, 1));
            lastEndRow = child.endPosition.row;
        } else if (isAction(child.type) || child.type === "top_level_assignment") {
            lines.push(formatNode(child, ctx, 1));
            lastEndRow = child.endPosition.row;
        }
    }

    lines.push(KW_END);
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
            isKeyword(child, KW_BUT_ONLY) ||
            isKeyword(child, KW_BUT_ONLY_IF_IT_CHANGES) ||
            isKeyword(child, KW_IF_EXISTS) ||
            isKeyword(child, KW_UNLESS) ||
            (isKeyword(child, KW_IF) && inPatchArea) ||
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
                keyword = child.text;
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
            handleComment(lines, patch, patchIndent, lastPatchEndRow);
        } else if (patch.type === "patch_block") {
            // BEGIN patches... END
            lines.push(patchIndent + KW_BEGIN);
            let lastBlockPatchEndRow = -1;
            for (const patchChild of patch.children) {
                if (isKeyword(patchChild, KW_BEGIN) || isKeyword(patchChild, KW_END)) {
                    continue;
                }
                if (isComment(patchChild)) {
                    handleComment(lines, patchChild, ctx.indent.repeat(depth + 2), lastBlockPatchEndRow);
                } else if (isPatch(patchChild.type) || isControlFlow(patchChild.type)) {
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
    const bodyIndent = ctx.indent.repeat(bodyDepth);

    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            lines.push(indent + header + " " + KW_BEGIN);
            inBody = true;
            continue;
        }

        if (isKeyword(child, KW_END)) {
            lines.push(indent + KW_END);
            continue;
        }

        if (inBody) {
            if (isComment(child)) {
                handleComment(lines, child, bodyIndent, lastEndRow);
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
        if (child.text === KW_FOR || child.text === KW_OUTER_FOR) {
            parts.push(child.text);
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
        if (isKeyword(child, KW_BEGIN)) {
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
        if (isKeyword(child, KW_BEGIN)) {
            break;
        }
        if (isKeyword(child, KW_IN)) {
            seenIN = true;
            headerParts.push(KW_IN);
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
        lines.push(indent + KW_BEGIN);
    } else {
        // Everything on one line with BEGIN
        const fullHeader = headerParts.join(" ") + " " + itemsAfterIN.join(" ");
        lines.push(indent + fullHeader + " " + KW_BEGIN);
    }

    // Second pass: format body
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            inBody = true;
            continue;
        }
        if (isKeyword(child, KW_END)) {
            lines.push(indent + KW_END);
            continue;
        }
        if (!inBody) {
            continue;
        }

        if (isComment(child)) {
            handleComment(lines, child, bodyIndent, lastEndRow);
        } else if (isBodyContent(child.type)) {
            lines.push(formatNode(child, ctx, depth + 1));
            lastEndRow = child.endPosition.row;
        }
    }

    return lines.join("\n");
}

/**
 * Parse associative array entry: key => value
 * Returns { name, value } for use with outputAlignedAssignments.
 */
function parseAssocEntry(node: SyntaxNode): { name: string; value: string } | null {
    // assoc_entry has: key [, key]* => value
    // Find the => separator
    let arrowIdx = -1;
    for (let i = 0; i < node.children.length; i++) {
        if (node.children[i]!.text === "=>") {
            arrowIdx = i;
            break;
        }
    }

    if (arrowIdx < 0 || arrowIdx >= node.children.length - 1) {
        return null;
    }

    // Key is everything before =>
    const keyParts: string[] = [];
    for (let i = 0; i < arrowIdx; i++) {
        const child = node.children[i]!;
        keyParts.push(child.text);
    }

    // Value is everything after =>
    const valueParts: string[] = [];
    for (let i = arrowIdx + 1; i < node.children.length; i++) {
        valueParts.push(node.children[i]!.text);
    }

    return {
        name: keyParts.join(" "),
        value: valueParts.join(" "),
    };
}

/**
 * Format associative array definition with aligned => operators.
 */
function formatAssociativeArray(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    // Collect header parts and entries
    const headerParts: string[] = [];
    const items: CollectedItem[] = [];
    let inBody = false;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            lines.push(indent + headerParts.join(" ") + " " + KW_BEGIN);
            inBody = true;
            continue;
        }

        if (isKeyword(child, KW_END)) {
            break;
        }

        if (!inBody) {
            headerParts.push(child.text);
            continue;
        }

        if (isComment(child)) {
            items.push({ type: "comment", text: normalizeComment(child.text), endRow: child.endPosition.row });
            continue;
        }

        if (child.type === "assoc_entry") {
            const parsed = parseAssocEntry(child);
            if (parsed) {
                items.push({ type: "assignment", name: parsed.name, value: parsed.value, endRow: child.endPosition.row });
            }
        }
    }

    // Use shared alignment function with " => " separator
    const entryLines = outputAlignedAssignments(items, "", indent, bodyIndent, " => ");
    lines.push(...entryLines);
    lines.push(indent + KW_END);

    return lines.join("\n");
}

/** State for control flow formatting. */
interface ControlFlowState {
    lines: string[];
    headerLines: string[][];
    conditionNode: SyntaxNode | null;
    headerKeyword: string;
    inBody: boolean;
    afterELSE: boolean;
    lastEndRow: number;
    beginRow: number;
}

/** Check if a node type is valid body content for control flow. */
function isControlFlowBodyContent(type: string): boolean {
    return (
        isBodyContent(type) ||
        type === "match_case" ||
        type === "action_match_case" ||
        type === "inlined_file" ||
        type === "assoc_entry" ||
        type === "binary_expr" ||
        type === "variable_ref" ||
        type === "identifier" ||
        type === "string" ||
        type === "number"
    );
}

/** Output collected header lines. */
function outputHeaderLines(headerLines: string[][], lines: string[], indent: string, contIndent: string): void {
    for (let j = 0; j < headerLines.length; j++) {
        const lineParts = headerLines[j]!;
        if (lineParts.length > 0) {
            const lineIndent = j === 0 ? indent : contIndent;
            lines.push(lineIndent + normalizeWhitespace(lineParts.join(" ")));
        }
    }
}

/** Handle BEGIN keyword in control flow. */
function handleControlFlowBegin(
    child: SyntaxNode,
    state: ControlFlowState,
    indent: string,
    contIndent: string,
    lineLimit: number
): void {
    const wasAfterELSE = state.afterELSE;
    state.afterELSE = false;

    // If we're after ELSE, just append BEGIN to the ELSE line
    if (wasAfterELSE && state.lines.length > 0 && state.lines[state.lines.length - 1]!.trimEnd().endsWith(KW_ELSE)) {
        state.lines[state.lines.length - 1] += " " + KW_BEGIN;
        state.headerLines = [[]];
        state.conditionNode = null;
        state.headerKeyword = "";
        state.inBody = true;
        return;
    }

    // Use grammar-based condition formatting for IF statements
    if (state.conditionNode && state.headerKeyword) {
        const condLines = formatCondition(state.conditionNode, state.headerKeyword, indent, contIndent, lineLimit);
        state.lines.push(...condLines);
        if (condLines.length > 1) {
            state.lines.push(indent + KW_BEGIN);
        } else {
            state.lines[state.lines.length - 1] += " " + KW_BEGIN;
        }
        state.headerLines = [[]];
        state.conditionNode = null;
        state.headerKeyword = "";
        state.inBody = true;
        state.beginRow = child.startPosition.row;
        return;
    }

    // Fallback: output header lines then BEGIN
    let nonEmptyCount = 0;
    for (const lineParts of state.headerLines) {
        if (lineParts.length > 0) nonEmptyCount++;
    }

    const multiLine = nonEmptyCount > 1;
    outputHeaderLines(state.headerLines, state.lines, indent, contIndent);

    // Check if last line ends with a line comment - can't append BEGIN to comment
    const lastLine = state.lines[state.lines.length - 1] ?? "";
    const endsWithComment = lastLine.includes("//");

    if (multiLine || nonEmptyCount === 0 || endsWithComment) {
        state.lines.push(indent + KW_BEGIN);
    } else {
        const lastIdx = state.lines.length - 1;
        if (lastIdx >= 0) {
            state.lines[lastIdx] += " " + KW_BEGIN;
        } else {
            state.lines.push(indent + KW_BEGIN);
        }
    }
    state.headerLines = [[]];
    state.inBody = true;
    state.beginRow = child.startPosition.row;
}

/** Handle comment in control flow formatting. */
function handleControlFlowComment(
    child: SyntaxNode,
    state: ControlFlowState,
    indent: string,
    bodyIndent: string
): void {
    if (state.inBody) {
        // Check if this is an inline comment (same row as BEGIN or previous item)
        const rowToCheck = state.beginRow >= 0 ? state.beginRow : state.lastEndRow;
        if (tryAppendInlineComment(state.lines, child, rowToCheck)) {
            state.beginRow = -1;
            return;
        }
        state.lines.push(bodyIndent + normalizeComment(child.text));
        state.beginRow = -1;
    } else if (state.afterELSE) {
        // Comment between ELSE and BEGIN - keep at ELSE indent level
        state.lines.push(indent + normalizeComment(child.text));
    } else {
        // Add comment to current header line
        state.headerLines[state.headerLines.length - 1]!.push(normalizeComment(child.text));
        // Line comments force a new line after them
        if (child.type === "line_comment") {
            state.headerLines.push([]);
        }
    }
}

/**
 * Format control flow: ACTION_IF cond BEGIN actions END [ELSE BEGIN actions END]
 */
function formatControlFlow(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    // Special handling for FOR loops
    const forHeader = formatForLoopHeader(node);
    if (forHeader !== null) {
        return formatForLoop(node, ctx, depth, forHeader);
    }

    // Special handling for FOR_EACH style loops
    if (isForEach(node.type)) {
        return formatForEach(node, ctx, depth);
    }

    // Special handling for associative arrays (aligned =>)
    if (isAssociativeArrayDef(node.type)) {
        return formatAssociativeArray(node, ctx, depth);
    }

    const indent = ctx.indent.repeat(depth);
    const contIndent = indent + ctx.indent;
    const bodyDepth = depth + 1;
    const bodyIndent = ctx.indent.repeat(bodyDepth);

    const state: ControlFlowState = {
        lines: [],
        headerLines: [[]],
        conditionNode: null,
        headerKeyword: "",
        inBody: false,
        afterELSE: false,
        lastEndRow: -1,
        beginRow: -1,
    };

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            handleControlFlowBegin(child, state, indent, contIndent, ctx.lineLimit);
            continue;
        }

        if (isKeyword(child, KW_END)) {
            state.inBody = false;
            state.lines.push(indent + KW_END);
            continue;
        }

        if (isKeyword(child, KW_ELSE)) {
            // Append ELSE to the previous END line
            if (state.lines.length > 0 && state.lines[state.lines.length - 1]!.trimEnd().endsWith(KW_END)) {
                state.lines[state.lines.length - 1] += " " + KW_ELSE;
            } else {
                state.lines.push(indent + KW_ELSE);
            }
            state.afterELSE = true;
            continue;
        }

        if (isKeyword(child, KW_THEN)) {
            state.headerLines[state.headerLines.length - 1]!.push(KW_THEN);
            continue;
        }

        if (isKeyword(child, KW_WITH)) {
            // WITH starts body for PATCH_MATCH/ACTION_MATCH
            outputHeaderLines(state.headerLines, state.lines, indent, contIndent);
            state.headerLines = [[]];
            state.lines.push(indent + KW_WITH);
            state.inBody = true;
            continue;
        }

        if (isKeyword(child, KW_DEFAULT)) {
            state.lines.push(indent + KW_DEFAULT);
            continue;
        }

        // Handle else-if chains: ELSE PATCH_IF/ACTION_IF without BEGIN
        if (state.afterELSE && (child.type === "action_if" || child.type === "patch_if")) {
            state.lines.push(formatNode(child, ctx, depth));
            state.afterELSE = false;
            continue;
        }

        if (isComment(child)) {
            handleControlFlowComment(child, state, indent, bodyIndent);
            continue;
        }

        if (state.inBody) {
            if (isControlFlowBodyContent(child.type)) {
                state.lines.push(formatNode(child, ctx, bodyDepth));
                state.lastEndRow = child.endPosition.row;
                state.beginRow = -1;
            }
        } else {
            // Header content (keyword, condition)
            if (child.text === KW_PATCH_IF || child.text === KW_ACTION_IF) {
                state.headerKeyword = child.text;
                state.conditionNode = node.childForFieldName("condition") ?? null;
                continue;
            }
            // Skip the condition node if we're using grammar-based formatting
            if (state.conditionNode && child === state.conditionNode) {
                continue;
            }
            state.headerLines[state.headerLines.length - 1]!.push(child.text);
        }
    }

    // Output any remaining header parts (shouldn't happen normally)
    outputHeaderLines(state.headerLines, state.lines, indent, contIndent);

    return state.lines.join("\n");
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
 * Handles inline comments and alignment on separator.
 * @param separator - The separator between name and value (default " = ")
 */
function outputAlignedAssignments(
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
            keyword = child.text;
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
            keyword = child.text;
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
        if (isKeyword(child, KW_BEGIN)) {
            // Output def line if we have one
            if (defLine) {
                lines.push(indent + defLine);
                defLine = "";
            }
            lines.push(indent + KW_BEGIN);
            inBody = true;
            continue;
        }

        if (isKeyword(child, KW_END)) {
            inBody = false;
            lines.push(indent + KW_END);
            continue;
        }

        if (isComment(child)) {
            if (inBody) {
                handleComment(lines, child, bodyIndent, lastEndRow);
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
            } else if (child.text.startsWith("DEFINE_")) {
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
 * Format REQUIRE_PREDICATE action, splitting long conditions at OR/AND.
 */
function formatPredicateAction(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const contIndent = indent + ctx.indent;

    const predicate = node.childForFieldName("predicate");
    const message = node.childForFieldName("message");

    if (!predicate || !message) {
        // Fallback to simple formatting
        return withNormalizedComment(indent + normalizeWhitespace(node.text));
    }

    // Try to format with condition splitting
    const condLines = formatCondition(predicate, "REQUIRE_PREDICATE", indent, contIndent, ctx.lineLimit);

    if (condLines.length === 1) {
        // Fits on one line
        return condLines[0] + " " + normalizeWhitespace(message.text);
    }

    // Multiple lines - put message on the last line
    condLines[condLines.length - 1] += " " + normalizeWhitespace(message.text);
    return condLines.join("\n");
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
        if (isKeyword(child, KW_BEGIN)) {
            const header = normalizeWhitespace(headerParts.join(" "));
            // If header contains line comment, can't append BEGIN to it
            if (header.includes("//")) {
                lines.push(indent + header);
                lines.push(indent + KW_BEGIN);
            } else {
                lines.push(indent + header + " " + KW_BEGIN);
            }
            headerParts = [];
            inBody = true;
            continue;
        }

        if (isKeyword(child, KW_END)) {
            lines.push(indent + KW_END);
            inBody = false;
            continue;
        }

        if (isComment(child)) {
            if (inBody) {
                handleComment(lines, child, bodyIndent, lastEndRow);
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
        if (isKeyword(child, KW_END)) {
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            lines.push(indent + KW_END);
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
            isKeyword(child, KW_LPF) ||
            isKeyword(child, KW_LAF) ||
            isKeyword(child, KW_LPM) ||
            isKeyword(child, KW_LAM)
        ) {
            // Start of call
            callLine = child.text;
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

    // REQUIRE_PREDICATE - may have long condition that needs splitting
    if (type === "require_predicate_action") {
        return formatPredicateAction(node, ctx, depth);
    }

    // Simple nodes (actions, patches, assignments)
    return formatSimpleNode(node, ctx, depth);
}

// ============================================
// Main entry point
// ============================================

/**
 * Try to append an inline comment to the last result entry.
 * Returns true if successful.
 */
function tryAppendTopLevelInlineComment(
    result: string[],
    child: SyntaxNode,
    lastEndRow: number
): boolean {
    if (!isComment(child) || lastEndRow < 0 || child.startPosition.row !== lastEndRow) {
        return false;
    }
    if (result.length === 0) {
        return false;
    }

    // Handle multi-line results by appending to the last non-empty line
    const lastResult = result[result.length - 1]!;
    const lastResultLines = lastResult.split("\n");
    const lastLine = lastResultLines[lastResultLines.length - 1]!;

    if (lastLine.includes("//")) {
        return false;
    }

    lastResultLines[lastResultLines.length - 1] = lastLine + INLINE_COMMENT_SPACING + normalizeComment(child.text);
    result[result.length - 1] = lastResultLines.join("\n");
    return true;
}

/**
 * Check if a comment chain is attached to a following component.
 * Returns true if the comment(s) should be kept with the next BEGIN block.
 */
function isCommentAttachedToComponent(
    children: SyntaxNode[],
    idx: number,
    lastEndRow: number
): boolean {
    const child = children[idx]!;
    if (!isComment(child)) {
        return false;
    }

    // Only consider attached if there's already separation before the comment
    const hasSeparationBefore = lastEndRow < 0 || child.startPosition.row > lastEndRow + 1;
    if (!hasSeparationBefore) {
        return false;
    }

    // Look ahead to find next non-comment sibling
    let nextIdx = idx + 1;
    let lastCommentEndRow = child.endPosition.row;
    while (nextIdx < children.length && isComment(children[nextIdx]!)) {
        lastCommentEndRow = children[nextIdx]!.endPosition.row;
        nextIdx++;
    }

    // Check if next non-comment is a component on adjacent row
    if (nextIdx < children.length && children[nextIdx]!.type === "component") {
        const component = children[nextIdx]!;
        return component.startPosition.row <= lastCommentEndRow + 1;
    }

    return false;
}

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
    const children = root.children;
    let skipBlankBeforeComponent = false;

    for (let i = 0; i < children.length; i++) {
        const child = children[i]!;

        // Try to append inline comment to previous line
        if (tryAppendTopLevelInlineComment(result, child, lastEndRow)) {
            continue;
        }

        // Check if comment is attached to following component
        const attachedToComponent = isCommentAttachedToComponent(children, i, lastEndRow);
        if (attachedToComponent) {
            skipBlankBeforeComponent = true;
        }

        // Preserve blank lines between top-level items
        if (lastEndRow >= 0 && child.startPosition.row > lastEndRow + 1) {
            result.push("");
        }

        // Ensure blank line before components (or attached comments)
        const needsBlankBefore = attachedToComponent || (child.type === "component" && !skipBlankBeforeComponent);
        if (needsBlankBefore && result.length > 0 && result[result.length - 1] !== "") {
            result.push("");
        }

        // Reset flag after processing component
        if (child.type === "component") {
            skipBlankBeforeComponent = false;
        }

        // Format the child
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
