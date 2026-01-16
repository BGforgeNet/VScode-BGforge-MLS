/**
 * Types, interfaces, and constants for WeiDU TP2 formatting.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";

// ============================================
// Public types
// ============================================

export interface FormatOptions {
    indentSize: number;
    lineLimit: number;
}

export const DEFAULT_OPTIONS: FormatOptions = {
    indentSize: 4,
    lineLimit: 120,
};

export interface FormatResult {
    text: string;
    errors: FormatError[];
}

/** Reserved for future use - format errors will be reported here when error recovery is implemented. */
export interface FormatError {
    message: string;
    line: number;
    column: number;
}

export interface FormatContext {
    indent: string;
    lineLimit: number;
    indentSize: number;
}

// ============================================
// Internal constants
// ============================================

export const INLINE_COMMENT_SPACING = "  ";

// ============================================
// Keyword constants
// ============================================

export const KW_BEGIN = "BEGIN";
export const KW_END = "END";
export const KW_ELSE = "ELSE";
export const KW_THEN = "THEN";
export const KW_WITH = "WITH";
export const KW_DEFAULT = "DEFAULT";
export const KW_IN = "IN";
export const KW_ALWAYS = "ALWAYS";
export const KW_BUT_ONLY = "BUT_ONLY";
export const KW_BUT_ONLY_IF_IT_CHANGES = "BUT_ONLY_IF_IT_CHANGES";
export const KW_IF_EXISTS = "IF_EXISTS";
export const KW_UNLESS = "UNLESS";
export const KW_IF = "IF";
export const KW_FOR = "FOR";
export const KW_OUTER_FOR = "OUTER_FOR";
export const KW_LPF = "LPF";
export const KW_LAF = "LAF";
export const KW_LPM = "LPM";
export const KW_LAM = "LAM";
export const KW_PATCH_IF = "PATCH_IF";
export const KW_ACTION_IF = "ACTION_IF";

// ============================================
// Node type constants
// ============================================

/** Top-level directive types. */
export const TOP_LEVEL_DIRECTIVES = [
    "backup_directive",
    "author_directive",
    "support_directive",
    "version_flag",
    "readme_directive",
    "no_if_eval_bug_flag",
    "auto_eval_strings_flag",
    "allow_missing_directive",
    "language_directive",
] as const;

/** FOR_EACH style loops with IN keyword. */
export const FOR_EACH_TYPES = [
    "action_for_each",
    "action_php_each",
    "action_bash_for",
    "patch_for_each",
    "php_each_patch",
] as const;

/** Control flow types (IF, MATCH, TRY, WHILE, etc.). */
export const CONTROL_FLOW_TYPES = [
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
    // Array definitions with BEGIN...END body
    "action_define_array",
    "action_define_associative_array",
    "define_associative_array_patch",
    // OUTER_* with BEGIN...END body
    "outer_patch_action",
    "outer_patch_save_action",
    "outer_inner_patch_action",
    "outer_inner_patch_save_action",
    // Patches with BEGIN...END body
    "decompile_and_patch",
    // FOR_EACH types
    ...FOR_EACH_TYPES,
] as const;

/** COPY-style action types. */
export const COPY_ACTION_TYPES = [
    "copy_action",
    "copy_existing_action",
    "copy_existing_regexp_action",
    "copy_random_action",
    "copy_large_action",
    "copy_kit_action",
    "copy_2da_action",
    "copy_all_gam_files_action",
    "inner_action",
] as const;

/** Function/macro definition types. */
export const FUNCTION_DEF_TYPES = [
    "define_action_function",
    "define_patch_function",
    "define_action_macro",
    "define_patch_macro",
] as const;

/** Function/macro call types. */
export const FUNCTION_CALL_TYPES = [
    "launch_action_function",
    "launch_action_macro",
    "launch_patch_function",
    "launch_patch_macro",
] as const;

// ============================================
// Collected item types for aligned output
// ============================================

/** Collected assignment for aligned output. */
export interface AssignmentItem {
    type: "assignment";
    name: string;
    value: string;
    endRow: number;
}

/** Collected comment for aligned output. */
export interface CommentItem {
    type: "comment";
    text: string;
    endRow: number;
}

/** Discriminated union for collected items. */
export type CollectedItem = AssignmentItem | CommentItem;

// ============================================
// State types
// ============================================

/** State for control flow formatting. */
export interface ControlFlowState {
    lines: string[];
    headerLines: string[][];
    conditionNode: SyntaxNode | null;
    headerKeyword: string;
    inBody: boolean;
    afterELSE: boolean;
    lastEndRow: number;
    beginRow: number;
}

/** Operand with optional preceding operator (OR/AND). */
export interface ConditionOperand {
    operator: string | null; // null for first operand, "OR"/"AND" for subsequent
    text: string;
}
