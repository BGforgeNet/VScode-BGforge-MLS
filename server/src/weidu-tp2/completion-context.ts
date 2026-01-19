/**
 * Context-aware completion for WeiDU TP2 files.
 * Detects cursor context using tree-sitter and filters completions accordingly.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { SyntaxType } from "./tree-sitter.d";
import { CompletionItem } from "vscode-languageserver/node";
import {
    CompletionItemWithCategory,
    getUtf8ByteOffset,
} from "../shared/completion-context";
import { getParser, isInitialized } from "./parser";
import { isAction, isPatch } from "./format-utils";

// ============================================
// Context Types
// ============================================

/**
 * Completion context types matching grammar hierarchy.
 * See grammars/weidu-tp2/README.md for structure documentation.
 *
 * Multiple contexts can be active at once (e.g., both componentFlag and action
 * are valid after BEGIN when no actions exist yet).
 *
 * **Keyword vs value contexts:**
 * "Keyword" contexts (actionKeyword, patchKeyword) indicate command position
 * (start of statement). "Value" contexts (action, patch) indicate value position
 * (after keyword, typing arguments).
 *
 * TODO: Currently actionKeyword and action have identical exclusion rules (same for
 * patchKeyword/patch). Either add rules that use the distinction (e.g., exclude
 * constants from keyword positions) or remove the keyword contexts to simplify.
 *
 * **Note on lafName/lpfName:**
 * These contexts are kept separate for future use (e.g., context-specific signature help).
 * Currently they have no exclusion rules.
 *
 * **Note on when/componentFlag:**
 * These contexts exist but currently have no exclusion rules. Keep for future use.
 */
export type CompletionContext =
    | "prologue"        // BACKUP, AUTHOR before any flag/language
    | "flag"            // TP2 flags, LANGUAGE, BEGIN
    | "componentFlag"   // After BEGIN, component flags allowed
    | "action"          // Inside action context - value position (after keyword)
    | "actionKeyword"   // Start of action statement - command position
    | "patch"           // Inside patch context - value position (after keyword)
    | "patchKeyword"    // Start of patch statement - command position
    | "when"            // After COPY file pairs - when conditions allowed
    | "lafName"         // After LAF keyword (action functions only)
    | "lpfName"         // After LPF keyword (patch functions only)
    | "funcParams"      // Inside function def/call parameter section (INT_VAR, STR_VAR, RET valid)
    | "unknown";        // Fallback - return everything

// ============================================
// Exclusion-Based Filtering
// ============================================

/**
 * Valid completion item categories for WeiDU TP2.
 * Categories determine where completions should appear based on context.
 *
 * **Category types:**
 * - **Structural**: prologue, flag, componentFlag - File/component structure directives
 * - **Commands**: action, patch - Context-specific statements (value positions)
 * - **Keywords**: actionKeywords, patchKeywords - Command-position variants of action/patch
 * - **Functions**: actionFunctions, patchFunctions - User-defined functions
 * - **Values**: constants, vars, value, when, optGlob, optCase, optExact, arraySortType - Value-position items
 * - **IElib**: ielibInt, ielibResref - IElib library constants
 * - **IESDP**: iesdpOther, iesdpStrref, iesdpResref, iesdpDword, iesdpWord, iesdpByte, iesdpChar - Engine constants (patch-only)
 * - **Language**: language - LANGUAGE directive (flag section)
 *
 * **Filtering semantics:**
 * - Items are excluded only when ALL active contexts exclude them (permissive)
 * - If ANY context allows an item, it appears (occasional noise is acceptable)
 * - Missing category = never excluded (backward compatibility)
 *
 * @see CATEGORY_EXCLUSIONS for exclusion rules per category
 */
export type CompletionCategory =
    // Structural directives
    | "prologue"
    | "flag"
    | "componentFlag"
    | "language"
    // Action context (value position)
    | "action"
    // Patch context (value position)
    | "patch"
    // Value items (not commands)
    | "constants"
    | "vars"
    | "value"
    | "when"
    | "optGlob"
    | "optCase"
    | "optExact"
    | "arraySortType"
    // Function parameter keywords (INT_VAR, STR_VAR, RET, RET_ARRAY)
    | "funcVarKeyword"
    // Function libraries
    | "actionFunctions"
    | "patchFunctions"
    // IElib constants
    | "ielibInt"
    | "ielibResref"
    // IESDP constants (patch-only, engine-defined)
    | "iesdpOther"
    | "iesdpStrref"
    | "iesdpResref"
    | "iesdpDword"
    | "iesdpWord"
    | "iesdpByte"
    | "iesdpChar";

/**
 * Exclusion rules: category -> contexts where it should NOT appear.
 *
 * **Current rules (minimal set):**
 * 1. action context excludes: patch, patchFunctions
 * 2. patch context excludes: action, actionFunctions
 *
 * **How filtering works (permissive approach):**
 * - Items are excluded only when ALL active contexts exclude them
 * - If ANY context allows an item, it appears
 * - Missing category = never excluded
 */
const CATEGORY_EXCLUSIONS: Partial<Record<CompletionCategory, CompletionContext[]>> = {
    // Rule 1: No patch items in action context or funcParams
    patch: ["action", "actionKeyword", "funcParams"],
    patchFunctions: ["action", "actionKeyword", "funcParams"],

    // Rule 2: No action items in patch context or funcParams
    action: ["patch", "patchKeyword", "funcParams"],
    actionFunctions: ["patch", "patchKeyword", "funcParams"],

    // Rule 3: No structural items in funcParams or inappropriate contexts
    prologue: ["funcParams"],
    flag: ["funcParams", "action", "actionKeyword", "patch", "patchKeyword", "componentFlag"],
    componentFlag: ["funcParams"],
    language: ["funcParams"],

    // Rule 4: INT_VAR, STR_VAR, RET, RET_ARRAY - only in function def/call parameter sections
    funcVarKeyword: ["action", "actionKeyword", "patch", "patchKeyword", "prologue", "flag", "componentFlag", "when", "lafName", "lpfName"],
};

/**
 * Valid contexts for validation.
 */
const VALID_CONTEXTS = new Set<CompletionContext>([
    "prologue",
    "flag",
    "componentFlag",
    "action",
    "actionKeyword",
    "patch",
    "patchKeyword",
    "when",
    "lafName",
    "lpfName",
    "funcParams",
    "unknown",
]);

// Validate exclusion rules at module load
for (const [category, exclusions] of Object.entries(CATEGORY_EXCLUSIONS)) {
    for (const ctx of exclusions) {
        if (!VALID_CONTEXTS.has(ctx)) {
            console.warn(`[weidu-tp2] Invalid context "${ctx}" in exclusion for category "${category}"`);
        }
    }
}

/**
 * Filter completion items based on exclusion rules.
 * Public API for use by provider.
 *
 * An item is excluded only if ALL active contexts exclude it.
 * This is permissive: when uncertain, we show more rather than less.
 */
export function filterItemsByContext(items: CompletionItem[], contexts: CompletionContext[]): CompletionItem[] {
    // Unknown context = show everything
    if (contexts.includes("unknown")) {
        return items;
    }

    return items.filter(item => !isItemExcluded(item, contexts));
}

/**
 * Check if item should be excluded based on active contexts.
 * Returns true only if ALL active contexts exclude this item's category.
 *
 * **Permissive filtering principle:**
 * - Only exclude when CERTAIN it's wrong
 * - If even one context allows the item, show it
 * - Occasional noise is acceptable; hiding wanted items is not
 *
 * **Logic:**
 * - Empty contexts array → never excluded (nothing to check against)
 * - Item with no category → never excluded (backward compatibility)
 * - Category with no exclusions → never excluded (default allow)
 * - Category excluded by ALL contexts → excluded (unanimous rejection)
 * - Category excluded by SOME contexts → NOT excluded (permissive - any approval wins)
 *
 * @param item Completion item to check
 * @param contexts Active completion contexts (may be empty)
 * @returns true if item should be hidden, false otherwise
 */
function isItemExcluded(item: CompletionItem, contexts: CompletionContext[]): boolean {
    // No contexts = nothing to exclude against
    if (contexts.length === 0) {
        return false;
    }

    const category = (item as CompletionItemWithCategory).category as CompletionCategory | undefined;

    // No category = never excluded
    if (!category) {
        return false;
    }

    // Get exclusion rules for this category
    const exclusions = CATEGORY_EXCLUSIONS[category];
    if (!exclusions || exclusions.length === 0) {
        return false;
    }

    // Exclude only if ALL active contexts are in the exclusion list
    // (If any context allows it, show it)
    return contexts.every(ctx => exclusions.includes(ctx));
}

// ============================================
// Context Detection
// ============================================

/**
 * Determine the completion context at a given position.
 * Uses tree-sitter to parse the text and walk up from cursor position.
 *
 * Returns an array of contexts because multiple contexts can be active simultaneously
 * (e.g., after BEGIN with no actions, both componentFlag and action are valid).
 *
 * @param text Document text
 * @param line 0-based line number
 * @param character 0-based character offset
 * @param fileExtension File extension (e.g., ".tp2", ".tpa", ".tpp")
 * @returns Array of detected contexts, or ["unknown"] if detection fails
 */
export function getContextAtPosition(
    text: string,
    line: number,
    character: number,
    fileExtension: string
): CompletionContext[] {
    // Fallback based on file extension
    const extLower = fileExtension.toLowerCase();
    const defaultContext = getDefaultContext(extLower);

    if (!isInitialized()) {
        return [defaultContext];
    }

    const parser = getParser();
    const tree = parser.parse(text);
    if (!tree) {
        return [defaultContext];
    }

    // Compute cursor byte offset from line/character (UTF-8 safe)
    const cursorOffset = getUtf8ByteOffset(text, line, character);

    // Find node at cursor position
    const node = tree.rootNode.descendantForPosition({ row: line, column: character });
    if (!node) {
        return [defaultContext];
    }

    // Walk up the tree to find context-defining ancestor
    return detectContextFromNode(node, extLower, cursorOffset);
}


/**
 * Get default context based on file extension.
 */
function getDefaultContext(ext: string): CompletionContext {
    switch (ext) {
        case ".tpp":
            return "patch";
        case ".tpa":
        case ".tph":
            return "action";
        case ".tp2":
            return "prologue";
        default:
            return "unknown";
    }
}

/** Prologue-only directive types (BACKUP and AUTHOR/SUPPORT are required first). */
const PROLOGUE_DIRECTIVE_TYPES = new Set([
    "backup_directive",
    "author_directive",
    "support_directive",  // Alias for AUTHOR
]);

/** Flag directive/statement types (can appear after prologue, before components). */
const FLAG_TYPES = new Set([
    "version_flag",
    "no_if_eval_bug_flag",
    "auto_eval_strings_flag",
    "readme_directive",
    "allow_missing_directive",
    "auto_tra_directive",
    "always_block",
    "inlined_file",
    // Add other flag types as needed
]);

/** Patch control flow constructs with BEGIN...END bodies (command position inside body). */
const PATCH_CONTROL_FLOW_CONSTRUCTS = new Set([
    "patch_if",
    "patch_match",
    "patch_for",
    "patch_while",
    "patch_php_each",
    "patch_for_each",
    "patch_replace_evaluate",
    "patch_decompile_and_patch",
    "patch_try",
    "inner_patch",
    "inner_patch_save",
    "inner_patch_file",
]);

/** Action control flow constructs with BEGIN...END bodies (command position inside body). */
const ACTION_CONTROL_FLOW_CONSTRUCTS = new Set([
    "action_if",
    "action_match",
    "action_for_each",
    "action_php_each",
    "outer_for",
    "outer_while",
    "action_try",
    "with_tra",
    "action_bash_for",
]);

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
function isInsideControlFlowBody(
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
 * Check if cursor is in a control flow body and return the appropriate context.
 * Returns null if not in a control flow body.
 *
 * @param node Starting node (cursor position)
 * @param cursorOffset Byte offset of cursor
 * @param constructs Set of control flow construct types to check
 * @param keywordContext Context to return for command position
 * @param valueContext Context to return for value position
 * @returns Context array if inside control flow body, null otherwise
 */
function getControlFlowBodyContext(
    node: SyntaxNode,
    cursorOffset: number,
    constructs: Set<string>,
    keywordContext: "actionKeyword" | "patchKeyword",
    valueContext: "action" | "patch"
): CompletionContext[] | null {
    if (isInsideControlFlowBody(node, cursorOffset, constructs)) {
        if (isInValuePosition(cursorOffset, node)) {
            return [valueContext];
        }
        return [keywordContext];
    }
    return null;
}

/**
 * BEGIN/END block boundary positions.
 * Used by function definitions and control flow constructs.
 */
interface BlockBoundaries {
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
function findBeginEndBoundaries(node: SyntaxNode, trackFunctionName = false): BlockBoundaries {
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
 * Detect context inside a function definition (action or patch).
 * Handles both complete parses (action_define_*_function nodes) and incomplete parses
 * (flattened structure in ERROR nodes).
 *
 * @param node Function definition node
 * @param cursorOffset Byte offset of cursor
 * @param funcType "patch" or "action" - determines context type
 * @param statementChecker Function to check if a node is a statement of the appropriate type
 * @returns Context array if cursor is in relevant position, null otherwise
 */
function detectFunctionDefinitionContext(
    node: SyntaxNode,
    cursorOffset: number,
    funcType: "patch" | "action",
    statementChecker: (type: string) => boolean
): CompletionContext[] | null {
    const boundaries = findBeginEndBoundaries(node, true);
    const { beginEnd, endStart, functionNameEnd } = boundaries;

    // If cursor is AFTER function name but BEFORE BEGIN → funcParams context
    if (functionNameEnd && functionNameEnd > 0 && cursorOffset > functionNameEnd && (beginEnd < 0 || cursorOffset < beginEnd)) {
        return ["funcParams"];
    }

    // If cursor is between BEGIN and END, we're in the function body
    // Note: endStart will be -1 for incomplete code (no END yet), so only check beginEnd
    if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
        // Walk down from function node to find if cursor is at a statement node
        let statement: SyntaxNode | null = null;
        for (const child of node.children) {
            if (statementChecker(child.type) && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                statement = child;
                break;
            }
        }

        // If at a statement, determine command vs value position
        if (statement) {
            if (isInValuePosition(cursorOffset, statement)) {
                return [funcType];
            }
            return [funcType === "patch" ? "patchKeyword" : "actionKeyword"];
        }
        // Not at a specific statement node yet - return keyword context (command position)
        return [funcType === "patch" ? "patchKeyword" : "actionKeyword"];
    }

    // Cursor is in the function header or outside the function body
    return null;
}

/**
 * Detect context by walking up from cursor node to find parent context,
 * then walking down through siblings to narrow the context.
 * Returns an array of contexts - multiple when ambiguous.
 */
/**
 * Determine function definition context when inside ERROR node with incomplete code.
 * In incomplete parses, function definitions may be flattened (keyword, params, BEGIN, body
 * all as siblings under ERROR), rather than wrapped in action_define_*_function node.
 *
 * Returns "patch" or "action" if inside function body, null otherwise.
 */
function getFunctionContextInError(startNode: SyntaxNode, cursorOffset: number): "patch" | "action" | null {
    // Walk up to find ERROR node
    let errorNode: SyntaxNode | null = startNode;
    while (errorNode && errorNode.type !== "ERROR") {
        errorNode = errorNode.parent;
    }

    if (!errorNode) {
        return null;
    }

    // Check ERROR node's children for function definition pattern:
    // DEFINE_*_FUNCTION keyword before cursor, BEGIN before cursor, cursor after BEGIN
    let foundFuncType: "patch" | "action" | null = null;
    let beginEnd = -1;
    let endStart = -1;

    for (const child of errorNode.children) {
        // Check for function definition keywords before cursor
        if (child.endIndex <= cursorOffset) {
            const text = child.text.toUpperCase();
            if (text === "DEFINE_PATCH_FUNCTION" || text === "DEFINE_PATCH_MACRO") {
                foundFuncType = "patch";
            } else if (text === "DEFINE_ACTION_FUNCTION" || text === "DEFINE_ACTION_MACRO") {
                foundFuncType = "action";
            } else if (text === "BEGIN" && child.type === "BEGIN") {
                beginEnd = child.endIndex;
            }
        }

        // Check for END keyword
        if (child.type === "END") {
            endStart = child.startIndex;
        }
    }

    // If we found a function definition and BEGIN, and cursor is after BEGIN (and before END if present)
    if (foundFuncType && beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
        return foundFuncType;
    }

    return null;
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
        if (lastChild.type === "identifier" || lastChild.type === "variable_ref" || lastChild.type === "value") {
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
function isInValuePosition(cursorOffset: number, node: SyntaxNode): boolean {
    // Check for command position indicators first
    if (isInCommandPosition(cursorOffset, node)) {
        return false;
    }

    // Check basic position between keyword and last arg
    return isBetweenKeywordAndLastArg(cursorOffset, node);
}

/**
 * Check if cursor is inside a prologue directive node.
 * Returns context array if detected, null otherwise.
 */
function detectPrologueContext(node: SyntaxNode): CompletionContext[] | null {
    if (PROLOGUE_DIRECTIVE_TYPES.has(node.type)) {
        return ["prologue"];
    }
    return null;
}

/**
 * Check if cursor is inside a flag directive node.
 * Returns context array if detected, null otherwise.
 */
function detectFlagContext(node: SyntaxNode): CompletionContext[] | null {
    if (FLAG_TYPES.has(node.type)) {
        return ["flag"];
    }
    return null;
}

/**
 * Check if cursor is at function call name position (LAF/LPF).
 * Returns context array if detected, null otherwise.
 */
function detectFunctionCallContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // Action function call (LAF)
    if (type === "action_launch_function" || type === "launch_action_function") {
        if (isAtFunctionName(cursorOffset, node)) {
            return ["lafName"];
        }
        // After function name → funcParams context (for INT_VAR, STR_VAR, RET, etc.)
        return ["funcParams"];
    }

    // Patch function call (LPF)
    if (type === "patch_launch_function" || type === "launch_patch_function") {
        if (isAtFunctionName(cursorOffset, node)) {
            return ["lpfName"];
        }
        // After function name → funcParams context (for INT_VAR, STR_VAR, RET, etc.)
        return ["funcParams"];
    }

    return null;
}

/**
 * Check if cursor is inside a function definition (DEFINE_*_FUNCTION).
 * Returns context array if detected, null otherwise.
 */
function detectFunctionDefContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // DEFINE_PATCH_FUNCTION body is patch context
    if (type === "action_define_patch_function" || type === "action_define_patch_macro") {
        return detectFunctionDefinitionContext(node, cursorOffset, "patch", isPatch);
    }

    // DEFINE_ACTION_FUNCTION body is action context
    if (type === "action_define_function" || type === "action_define_macro") {
        return detectFunctionDefinitionContext(node, cursorOffset, "action", isAction);
    }

    return null;
}

/**
 * Check if cursor is inside INNER_ACTION context.
 * Returns context array if detected, null otherwise.
 */
function detectInnerActionContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    if (node.type !== "inner_action") {
        return null;
    }

    const { beginEnd, endStart } = findBeginEndBoundaries(node);

    // If cursor is between BEGIN and END, check for command vs value position
    if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
        // Look for action statement at cursor position
        let actionStatement: SyntaxNode | null = null;
        for (const child of node.children) {
            if (isAction(child.type) && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                actionStatement = child;
                break;
            }
        }

        if (actionStatement) {
            if (isInValuePosition(cursorOffset, actionStatement)) {
                return ["action"];
            }
            return ["actionKeyword"];
        }
        return ["actionKeyword"];
    }
    return ["action"];
}

/**
 * Check if cursor is inside INNER_PATCH/OUTER_PATCH context.
 * Returns context array if detected, null otherwise.
 */
function detectPatchContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // INNER_PATCH with BEGIN...END body
    if (type === "inner_patch" || type === "inner_patch_save" || type === "inner_patch_file") {
        const { beginEnd, endStart } = findBeginEndBoundaries(node);

        // If cursor is between BEGIN and END, check for command vs value position
        if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
            // Look for patch statement at cursor position
            let patchStatement: SyntaxNode | null = null;
            for (const child of node.children) {
                if (isPatch(child.type) && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                    patchStatement = child;
                    break;
                }
            }

            if (patchStatement) {
                if (isInValuePosition(cursorOffset, patchStatement)) {
                    return ["patch"];
                }
                return ["patchKeyword"];
            }
            return ["patchKeyword"];
        }
        return ["patch"];
    }

    // OUTER_PATCH (no body parsing needed)
    if (type === "outer_patch" || type === "outer_patch_save") {
        return ["patch"];
    }

    // Patch file
    if (type === "patch_file") {
        return ["patch"];
    }

    // Inside patches block (COPY...BEGIN...END)
    if (type === SyntaxType.Patches) {
        return ["patch"];
    }

    return null;
}

/**
 * Check if cursor is inside COPY action context.
 * Returns context array if detected, null otherwise.
 */
function detectCopyActionContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    if (!node.type.startsWith("action_copy")) {
        return null;
    }

    // Check if COPY itself is inside a control flow construct's body
    const controlFlowContext = getControlFlowBodyContext(
        node,
        cursorOffset,
        ACTION_CONTROL_FLOW_CONSTRUCTS,
        "actionKeyword",
        "action"
    );
    if (controlFlowContext) {
        return controlFlowContext;
    }

    // Check if we're inside a patches block node
    for (const child of node.children) {
        if (child.type === SyntaxType.Patches) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return ["patch"];
            }
        }
    }

    // Walk through children to determine position and what's above/below
    let hasPatchesAbove = false;
    let hasWhenAbove = false;
    let hasPatchesBelow = false;
    let hasWhenBelow = false;
    let lastFilePairEnd = -1;

    for (const child of node.children) {
        if (child.type === SyntaxType.FilePair) {
            lastFilePairEnd = Math.max(lastFilePairEnd, child.endIndex);
        }

        if (child.endIndex < cursorOffset) {
            // Above cursor
            if (child.type === SyntaxType.Patches || isPatch(child.type)) {
                hasPatchesAbove = true;
            }
            if (child.type === SyntaxType.When) {
                hasWhenAbove = true;
            }
        } else if (child.startIndex > cursorOffset) {
            // Below cursor - check both proper nodes and incomplete keywords in ERROR nodes
            if (child.type === SyntaxType.Patches || isPatch(child.type) || containsPatch(child)) {
                hasPatchesBelow = true;
            }
            if (child.type === SyntaxType.When || containsWhen(child)) {
                hasWhenBelow = true;
            }
        }
    }

    // Before/within file pairs → action context (COPY header)
    if (lastFilePairEnd > 0 && cursorOffset <= lastFilePairEnd) {
        return ["action"];
    }

    // If there's content both above and below, return what's below (certain context)
    if ((hasPatchesAbove || hasWhenAbove) && (hasPatchesBelow || hasWhenBelow)) {
        const contexts: CompletionContext[] = [];
        if (hasPatchesBelow) contexts.push("patch");
        if (hasWhenBelow) contexts.push("when");
        return contexts;
    }

    // If there's content above but nothing below, determine what's allowed next
    if (hasPatchesAbove || hasWhenAbove) {
        if (hasWhenAbove) {
            // After when: can add more when OR new action (NOT patches)
            return ["when", "action"];
        } else {
            // After patches: can add more patches, when, OR new action
            return ["patch", "when", "action"];
        }
    }

    // After file pairs with nothing below: all three possible
    return ["patch", "when", "action"];
}

/**
 * Check if cursor is inside component node.
 * Returns context array if detected, null otherwise.
 */
function detectComponentContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    if (node.type !== SyntaxType.Component) {
        return null;
    }
    return getComponentContextFromNode(cursorOffset, node);
}

/**
 * Check if cursor is at an action/patch statement and determine context.
 * Returns context array if detected, null otherwise.
 *
 * This handles statements that aren't inside function definitions or patches blocks.
 * It walks up to find the containing function/block to determine the correct context.
 */
function detectStatementContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    if (!isAction(type) && !isPatch(type)) {
        return null;
    }

    // Remember this node and continue walking
    const statementNode = node;
    const isActionNode = isAction(type);
    const isPatchNode = isPatch(type);

    // Check if we're inside a patches block or inner_action
    // (e.g., inside COPY...BEGIN...END). These override function context.
    let parent = node.parent;
    let foundPatchesBlock = false;

    while (parent) {
        // INNER_ACTION creates action context even inside patches block
        if (parent.type === "inner_action") {
            if (isActionNode && isInValuePosition(cursorOffset, statementNode)) {
                return ["action"];
            }
            if (isActionNode) {
                return ["actionKeyword"];
            }
            // Patch inside INNER_ACTION shouldn't happen, but fall through
        }

        if (parent.type === SyntaxType.Patches) {
            foundPatchesBlock = true;
            // Don't return yet - keep checking for inner_action above
        }
        parent = parent.parent;
    }

    // If we found a patches block and no inner_action, return patch context
    if (foundPatchesBlock) {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return ["patch"];
        }
        return ["patchKeyword"];
    }

    // Not in patches block - check for function definitions
    // We need to skip past ERROR nodes since incomplete code may be wrapped in ERROR
    parent = node.parent;
    while (parent) {
        // Skip ERROR nodes - continue up the tree
        if (parent.type !== "ERROR") {
            // Check for function definitions
            if (parent.type === "action_define_patch_function" || parent.type === "action_define_patch_macro") {
                // Inside DEFINE_PATCH_FUNCTION - body is patch context
                if (isInValuePosition(cursorOffset, statementNode)) {
                    return ["patch"];
                }
                return ["patchKeyword"];
            }
            if (parent.type === "action_define_function" || parent.type === "action_define_macro") {
                // Inside DEFINE_ACTION_FUNCTION - body is action context
                if (isInValuePosition(cursorOffset, statementNode)) {
                    return ["action"];
                }
                return ["actionKeyword"];
            }
        }
        parent = parent.parent;
    }

    // Not found via walking up - might be in ERROR node with incomplete code
    // Check if we're inside a flattened function definition
    const funcContext = getFunctionContextInError(node, cursorOffset);
    if (funcContext === "patch") {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return ["patch"];
        }
        return ["patchKeyword"];
    }
    if (funcContext === "action") {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return ["action"];
        }
        return ["actionKeyword"];
    }

    // Not inside a function def - use the statement node's context
    if (isPatchNode) {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return ["patch"];
        }
        return ["patchKeyword"];
    }
    if (isActionNode) {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return ["action"];
        }
        return ["actionKeyword"];
    }

    return null;
}

/**
 * Check if cursor is at source file root and determine context.
 * Returns context array if detected, null otherwise.
 */
function detectSourceFileContext(node: SyntaxNode, cursorOffset: number, ext: string): CompletionContext[] | null {
    if (node.type !== SyntaxType.SourceFile) {
        return null;
    }

    // For .tp2 files, determine prologue vs flag
    if (ext === ".tp2") {
        return detectTp2RootContext(cursorOffset, node);
    }

    // For .tpa/.tph, check if file has component structure (BEGIN/GROUP)
    // If so, use tp2-style context detection; otherwise default to action
    if (ext === ".tpa" || ext === ".tph") {
        if (hasComponentStructure(node)) {
            return detectTp2RootContext(cursorOffset, node);
        }
        // Top level is command position - return only actionKeyword to exclude constants
        return ["actionKeyword"];
    }

    // For .tpp, top level is command position
    if (ext === ".tpp") {
        return ["patchKeyword"];
    }

    return null;
}

function detectContextFromNode(node: SyntaxNode, ext: string, cursorOffset: number): CompletionContext[] {
    let current: SyntaxNode | null = node;

    while (current) {
        // Try each handler in order of priority
        const context =
            detectPrologueContext(current) ??
            detectFlagContext(current) ??
            detectFunctionCallContext(current, cursorOffset) ??
            detectFunctionDefContext(current, cursorOffset) ??
            detectInnerActionContext(current, cursorOffset) ??
            detectPatchContext(current, cursorOffset) ??
            detectCopyActionContext(current, cursorOffset) ??
            detectComponentContext(current, cursorOffset) ??
            detectStatementContext(current, cursorOffset) ??
            detectSourceFileContext(current, cursorOffset, ext);

        if (context) {
            return context;
        }

        current = current.parent;
    }

    return ["unknown"];
}

/**
 * Check if cursor is at the function name position in a function call.
 * Uses positional heuristics for incomplete code where identifier may not exist.
 */
function isAtFunctionName(cursorOffset: number, funcCall: SyntaxNode): boolean {
    let keywordEnd = -1;
    let firstArgStart = -1;

    for (const child of funcCall.children) {
        const text = child.text.toUpperCase();

        // Track keyword position (LAF, LPF, LAUNCH_ACTION_FUNCTION, LAUNCH_PATCH_FUNCTION)
        if (text === "LAF" || text === "LPF" || text === "LAUNCH_ACTION_FUNCTION" || text === "LAUNCH_PATCH_FUNCTION") {
            keywordEnd = child.endIndex;
            continue;
        }

        // If cursor is within an identifier (the function name), return true
        if (child.type === SyntaxType.Identifier) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return true;
            }
            // Past the identifier - not at function name position
            if (cursorOffset > child.endIndex) {
                return false;
            }
        }

        // Track first argument keyword (INT_VAR, STR_VAR, RET, END)
        if (text === "INT_VAR" || text === "STR_VAR" || text === "RET" || text === "RET_ARRAY" || text === "END") {
            if (firstArgStart < 0) {
                firstArgStart = child.startIndex;
            }
        }
    }

    // Positional heuristic: cursor is after keyword but before any arguments
    if (keywordEnd > 0 && cursorOffset > keywordEnd) {
        if (firstArgStart < 0 || cursorOffset < firstArgStart) {
            return true;
        }
    }

    return false;
}


/** Component flag node types. */
const COMPONENT_FLAG_TYPES = new Set([
    "designated_flag",
    "deprecated_flag",
    "subcomponent_flag",
    "group_flag",
    "label_flag",
    "require_predicate_flag",
    "require_component_flag",
    "forbid_component_flag",
    "install_by_default_flag",
    "no_log_record_flag",
    "metadata_flag",
    "forced_subcomponent_flag",
]);

/** Component flag keywords (for checking text when parsed as identifiers in ERROR nodes). */
const COMPONENT_FLAG_KEYWORDS = new Set([
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

/**
 * Check if a node or its children recursively contain a patch node.
 * Used to detect patches in ERROR nodes or nested structures.
 */
function containsPatch(node: SyntaxNode): boolean {
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
function containsWhen(node: SyntaxNode): boolean {
    if (node.type === SyntaxType.When) return true;
    for (const child of node.children) {
        if (containsWhen(child)) return true;
    }
    return false;
}

// ============================================
// Structural Node Detection
// ============================================

// Note: NodeType.ERROR is used consistently throughout this file
// instead of string literal "ERROR" for better maintainability

/** Structural nodes (actions, flags) found around cursor position. */
interface StructuralNodes {
    actionBefore: SyntaxNode | null;
    flagAfter: SyntaxNode | null;
}

/** Check if node is a component flag (by type or as incomplete keyword). */
function isComponentFlag(node: SyntaxNode): boolean {
    return (
        COMPONENT_FLAG_TYPES.has(node.type) ||
        (node.type === "identifier" && COMPONENT_FLAG_KEYWORDS.has(node.text.toUpperCase()))
    );
}

/** Update accumulator with actionBefore (keep latest). */
function updateActionBefore(acc: StructuralNodes, node: SyntaxNode): void {
    const current = acc.actionBefore;
    if (!current || node.endIndex > current.endIndex) {
        acc.actionBefore = node;
    }
}

/** Update accumulator with flagAfter (keep earliest). */
function updateFlagAfter(acc: StructuralNodes, node: SyntaxNode): void {
    const current = acc.flagAfter;
    if (!current || node.startIndex < current.startIndex) {
        acc.flagAfter = node;
    }
}

/**
 * Check a single node and update accumulator.
 * Handles both direct nodes and ERROR node children.
 */
function checkNode(node: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    const isBefore = node.endIndex <= cursorOffset;
    const isAfter = node.startIndex > cursorOffset;

    if (isBefore && isAction(node.type)) {
        updateActionBefore(acc, node);
    }

    if (isAfter && isComponentFlag(node)) {
        updateFlagAfter(acc, node);
    }
}

/**
 * Check ERROR node children for structural nodes.
 * ERROR nodes may contain flags/actions when code is incomplete.
 */
function checkErrorNodeChildren(errorNode: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    for (const child of errorNode.children) {
        if (child.startIndex <= cursorOffset) continue;
        checkNode(child, cursorOffset, acc);
    }
}

/**
 * Find structural nodes in component's direct children.
 */
function findInComponentChildren(component: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    for (const child of component.children) {
        checkNode(child, cursorOffset, acc);

        // Also check inside ERROR nodes that are after cursor
        if (child.type === "ERROR" && child.startIndex > cursorOffset) {
            checkErrorNodeChildren(child, cursorOffset, acc);
        }
    }
}

/**
 * Find structural nodes in parent's children (siblings of component).
 * Handles incomplete code where flags/actions escape the component node.
 */
function findInParentSiblings(component: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    const parent = component.parent;
    if (!parent) return;

    for (const sibling of parent.children) {
        if (sibling === component) continue;

        // ERROR nodes: check children even if ERROR starts before cursor
        // (the ERROR may span the cursor, but contain valid nodes after it)
        if (sibling.type === "ERROR") {
            checkErrorNodeChildren(sibling, cursorOffset, acc);
            continue;
        }

        // Regular siblings: only check if after cursor
        if (sibling.startIndex > cursorOffset) {
            checkNode(sibling, cursorOffset, acc);
        }
    }
}

/**
 * Find structural nodes (actions, flags) immediately before and after cursor.
 *
 * Searches in two places:
 * 1. Component's direct children
 * 2. Parent's children (for incomplete code where nodes escape the component)
 */
function findStructuralNodesAroundCursor(component: SyntaxNode, cursorOffset: number): StructuralNodes {
    const acc: StructuralNodes = {
        actionBefore: null,
        flagAfter: null,
    };

    findInComponentChildren(component, cursorOffset, acc);
    findInParentSiblings(component, cursorOffset, acc);

    return acc;
}

/**
 * Check if source file has component structure (BEGIN, GROUP, LANGUAGE).
 * Used to detect .tpa/.tph files that define components rather than just actions.
 */
function hasComponentStructure(root: SyntaxNode): boolean {
    for (const child of root.children) {
        if (child.type === SyntaxType.Component || child.type === SyntaxType.LanguageDirective) {
            return true;
        }
    }
    return false;
}

/**
 * Get context for cursor position inside or after a COPY action.
 * COPY actions have a complex structure: file pairs, then optional patches, then optional when.
 */
function getCopyActionContext(copyAction: SyntaxNode, cursorOffset: number): CompletionContext[] {
    let hasPatchesBelow = false;
    let hasWhenBelow = false;
    let hasPatchesInCopy = false;
    let hasWhenInCopy = false;

    for (const child of copyAction.children) {
        const isChildPatch = child.type === SyntaxType.Patches || isPatch(child.type) || containsPatch(child);
        const isChildWhen = child.type === SyntaxType.When || containsWhen(child);

        if (isChildPatch) {
            hasPatchesInCopy = true;
            if (child.startIndex > cursorOffset) {
                hasPatchesBelow = true;
            }
        }
        if (isChildWhen) {
            hasWhenInCopy = true;
            if (child.startIndex > cursorOffset) {
                hasWhenBelow = true;
            }
        }
    }

    // Content below within COPY → only those contexts (certain)
    if (hasPatchesBelow || hasWhenBelow) {
        const contexts: CompletionContext[] = [];
        if (hasPatchesBelow) contexts.push("patch");
        if (hasWhenBelow) contexts.push("when");
        return contexts;
    }

    // Nothing below → determine by what's already in COPY
    if (hasWhenInCopy) {
        // After when: more when OR new action (NOT patches - when comes after patches)
        return ["when", "action"];
    }
    if (hasPatchesInCopy) {
        // After patches: more patches, when, OR new action
        return ["patch", "when", "action"];
    }
    // After file pairs only: all three possible
    return ["patch", "when", "action"];
}

/**
 * Get context for cursor after an action (possibly inside it for COPY).
 */
function getActionContext(action: SyntaxNode, cursorOffset: number): CompletionContext[] {
    // COPY actions have special handling for patches/when
    if (action.type.startsWith("action_copy")) {
        return getCopyActionContext(action, cursorOffset);
    }
    // Regular action → determine if cursor is at command position or value position
    if (isInValuePosition(cursorOffset, action)) {
        return ["action"];
    }
    return ["actionKeyword"];
}

/**
 * Get component context by analyzing structural nodes around cursor.
 *
 * NOTE: When typing incomplete code, tree-sitter may not include subsequent flags
 * as children of the component. We also check siblings in the parent (root) node.
 */
function getComponentContextFromNode(cursorOffset: number, component: SyntaxNode): CompletionContext[] {
    // Check if cursor is inside a component flag node
    for (const child of component.children) {
        if (COMPONENT_FLAG_TYPES.has(child.type)) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return ["componentFlag"];
            }
        }
    }

    // Find structural nodes around cursor
    const { actionBefore, flagAfter } = findStructuralNodesAroundCursor(component, cursorOffset);

    // Action above → delegate to action context handler (we're past flag section)
    if (actionBefore) {
        return getActionContext(actionBefore, cursorOffset);
    }

    // Flags below cursor → in flag section (can only add more flags)
    if (flagAfter) {
        return ["componentFlag"];
    }

    // No flags after, no actions before → at boundary, both valid
    return ["componentFlag", "actionKeyword"];
}

/**
 * Detect context within .tp2 source file root.
 * Determines if we're in prologue or flag section.
 *
 * **Decision: Grammar vs Completion Context**
 * - Grammar: BACKUP and AUTHOR/SUPPORT are optional (for error recovery/malformed files)
 * - Completion: Encourages BACKUP first, then AUTHOR/SUPPORT, by showing prologue context
 * - This allows parsing of incomplete/test files while guiding users to write correct TP2s
 *
 * **Context Flow:**
 * 1. Empty file → "prologue" (must start with BACKUP)
 * 2. After BACKUP only → "prologue" (AUTHOR/SUPPORT still needed)
 * 3. After BACKUP + AUTHOR/SUPPORT → "flag" (prologue complete)
 * 4. After any non-prologue → "flag" (past prologue section)
 *
 * Note: Component nodes only span from BEGIN to the last action/flag.
 * Empty lines after a component (but before the next BEGIN) are not part
 * of the component node, but should still be treated as inside the component
 * for completion purposes.
 */
function detectTp2RootContext(cursorOffset: number, root: SyntaxNode): CompletionContext[] {
    // Track what we've seen
    let seenBackup = false;
    let seenAuthorOrSupport = false;
    let seenAnyNonPrologue = false;
    let lastComponent: SyntaxNode | null = null;

    for (const child of root.children) {
        const type = child.type;

        // Track what we've seen before cursor (use <= to include nodes ending at cursor)
        if (child.endIndex <= cursorOffset) {
            if (type === "backup_directive") {
                seenBackup = true;
            }
            if (type === "author_directive" || type === "support_directive") {
                seenAuthorOrSupport = true;
            }
            if (!PROLOGUE_DIRECTIVE_TYPES.has(type)) {
                seenAnyNonPrologue = true;
            }
        }

        if (child.type === SyntaxType.Component) {
            // Check if cursor is BEFORE this component
            if (cursorOffset < child.startIndex) {
                // If we have a previous component, cursor is in its trailing area
                if (lastComponent) {
                    return getComponentContextFromNode(cursorOffset, lastComponent);
                }
                return ["flag"];
            }
            // Check if cursor is INSIDE this component's span
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return getComponentContextFromNode(cursorOffset, child);
            }
            // Cursor is after this component - remember it for trailing area check
            lastComponent = child;
        }
    }

    // Cursor is after all children - if we found a component, we're in its trailing area
    if (lastComponent) {
        return getComponentContextFromNode(cursorOffset, lastComponent);
    }

    // Determine context based on what we've seen
    // Once we've seen any non-prologue directive, we're past the prologue section
    if (seenAnyNonPrologue) {
        return ["flag"];
    }

    // If we've seen both required directives, prologue is complete
    if (seenBackup && seenAuthorOrSupport) {
        return ["flag"];
    }

    // If we've seen BACKUP only, AUTHOR/SUPPORT is still required
    if (seenBackup) {
        return ["prologue"];
    }

    // Beginning of file - BACKUP is required first
    return ["prologue"];
}

