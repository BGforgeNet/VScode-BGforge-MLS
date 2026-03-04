/**
 * Module-level constants for TP2 completion context detection.
 * Contains Sets and RegExp patterns used to classify tree-sitter node types
 * into prologue directives, flags, control flow constructs, and function call keywords.
 */

import { SyntaxType } from "../../tree-sitter.d";

/** Prologue-only directive types (BACKUP and AUTHOR/SUPPORT are required first). */
export const PROLOGUE_DIRECTIVE_TYPES = new Set<string>([
    SyntaxType.BackupDirective,
    SyntaxType.AuthorDirective,
    SyntaxType.SupportDirective,  // Alias for AUTHOR
]);

/** Flag directive/statement types (can appear after prologue, before components). */
export const FLAG_TYPES = new Set<string>([
    SyntaxType.VersionFlag,
    SyntaxType.NoIfEvalBugFlag,
    SyntaxType.AutoEvalStringsFlag,
    SyntaxType.ReadmeDirective,
    SyntaxType.AllowMissingDirective,
    SyntaxType.AutoTraDirective,
    SyntaxType.AlwaysBlock,
    SyntaxType.InlinedFile,
    // Add other flag types as needed
]);

/** Patch control flow constructs with BEGIN...END bodies (command position inside body). */
export const PATCH_CONTROL_FLOW_CONSTRUCTS = new Set<string>([
    SyntaxType.PatchIf,
    SyntaxType.PatchMatch,
    SyntaxType.PatchFor,
    SyntaxType.PatchWhile,
    SyntaxType.PatchPhpEach,
    SyntaxType.PatchForEach,
    SyntaxType.PatchReplaceEvaluate,
    SyntaxType.PatchDecompileAndPatch,
    SyntaxType.PatchTry,
    SyntaxType.InnerPatch,
    SyntaxType.InnerPatchSave,
    SyntaxType.InnerPatchFile,
]);

/** Action control flow constructs with BEGIN...END bodies (command position inside body). */
export const ACTION_CONTROL_FLOW_CONSTRUCTS = new Set<string>([
    SyntaxType.ActionIf,
    SyntaxType.ActionMatch,
    SyntaxType.ActionForEach,
    SyntaxType.ActionPhpEach,
    SyntaxType.OuterFor,
    SyntaxType.OuterWhile,
    SyntaxType.ActionTry,
    SyntaxType.ActionWithTra,
    SyntaxType.ActionBashFor,
]);

/** Patch commands that are always patch context regardless of parsing context. */
export const ALWAYS_PATCH_KEYWORDS = new Set([
    "READ_BYTE",
    "READ_SHORT",
    "READ_LONG",
    "READ_ASCII",
    "READ_STRREF",
    "WRITE_BYTE",
    "WRITE_SHORT",
    "WRITE_LONG",
    "WRITE_ASCII",
    "WRITE_ASCIIE",
    "WRITE_ASCIIT",
    "WRITE_EVALUATED_ASCII",
]);

/** Component flag node types. */
export const COMPONENT_FLAG_TYPES = new Set<string>([
    SyntaxType.DesignatedFlag,
    SyntaxType.DeprecatedFlag,
    SyntaxType.SubcomponentFlag,
    SyntaxType.GroupFlag,
    SyntaxType.LabelFlag,
    SyntaxType.RequirePredicateFlag,
    SyntaxType.RequireComponentFlag,
    SyntaxType.ForbidComponentFlag,
    "install_by_default_flag",  // Not yet in SyntaxType enum
    "no_log_record_flag",  // Not yet in SyntaxType enum
    "metadata_flag",  // Not yet in SyntaxType enum
    "forced_subcomponent_flag",  // Not yet in SyntaxType enum
]);

/** Component flag keywords (for checking text when parsed as identifiers in ERROR nodes). */
export const COMPONENT_FLAG_KEYWORDS = new Set([
    "DESIGNATED",
    "DEPRECATED",
    "SUBCOMPONENT",
    "GROUP",
    "LABEL",
    "REQUIRE_PREDICATE",
    "REQUIRE_COMPONENT",
    "FORBID_COMPONENT",
    "INSTALL_BY_DEFAULT",
    "NO_LOG_RECORD",
    "METADATA",
    "FORCED_SUBCOMPONENT",
]);

/** LAF/LPF/LAM/LPM keywords that indicate function/macro name position. */
export const FUNC_CALL_KEYWORDS = /^\s*(LAF|LPF|LAM|LPM|LAUNCH_ACTION_FUNCTION|LAUNCH_PATCH_FUNCTION|LAUNCH_ACTION_MACRO|LAUNCH_PATCH_MACRO)\s+\S*$/i;

/**
 * Declaration keywords where the identifier after the keyword is a new name being declared.
 * Matches when the line (up to cursor) ends with an unfinished identifier — the declaration name.
 * Used to suppress completions at declaration sites where the user is naming a new symbol.
 *
 * Why regex instead of tree-sitter AST:
 * At declaration sites the user is mid-typing a new identifier (e.g. `OUTER_SET fo|`).
 * Tree-sitter cannot produce a valid declaration node for incomplete input — the grammar
 * requires both a name and a value (`OUTER_SET name = expr`), so partial input lands in
 * an ERROR node. An earlier attempt modified the grammar to make parts optional, but this
 * introduced unresolvable ambiguities (e.g. optional `BEGIN...END` on function definitions
 * conflicted with the `component` rule). This is a known tree-sitter limitation —
 * error recovery does not produce typed incomplete nodes, only ERROR nodes with no
 * reliable structure to match against (see https://github.com/tree-sitter/tree-sitter/issues/923).
 * Line-text regex is the fallback convention used throughout this codebase for similar
 * incomplete-input scenarios (see FUNC_CALL_KEYWORDS above).
 * See also: SSL_DECLARATION_SITE_PATTERN in fallout-ssl/completion-context.ts.
 */
export const DECLARATION_SITE_PATTERN = new RegExp(
    "^\\s*(" +
    // Variable SET/SPRINT declarations with optional EVAL/EVALUATE_BUFFER/GLOBAL modifier
    "(?:OUTER_)?(?:SET|SPRINT|TEXT_SPRINT)\\s+(?:(?:EVAL(?:UATE_BUFFER)?|GLOBAL)\\s+)?|" +
    // Function/macro definitions
    "DEFINE_(?:ACTION|PATCH)_(?:FUNCTION|MACRO)\\s+|" +
    // Array definitions
    "(?:ACTION_)?DEFINE_(?:ASSOCIATIVE_)?ARRAY\\s+|" +
    // Loop variable bindings
    "(?:PATCH_|ACTION_)?(?:FOR_EACH|PHP_EACH)\\s+" +
    ")\\S*$",
    "i"
);
