/**
 * Context-aware completion for WeiDU TP2 files.
 * Detects cursor context using tree-sitter and filters completions accordingly.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { CompletionItem } from "vscode-languageserver/node";
import {
    CategoryContextMap,
    CompletionItemWithCategory,
    ContextFilterConfig,
    getUtf8ByteOffset,
    validateCategoryContextMap,
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
 */
export type CompletionContext =
    | "prologue"        // BACKUP, AUTHOR before any flag/language
    | "flag"            // TP2 flags, LANGUAGE, BEGIN
    | "componentFlag"   // After BEGIN, component flags allowed
    | "action"          // Inside component, .tpa, .tph - actions allowed
    | "patch"           // Inside COPY patches, .tpp - patches allowed
    | "when"            // After COPY file pairs - when conditions allowed
    | "lafName"         // After LAF keyword (action functions only)
    | "lpfName"         // After LPF keyword (patch functions only)
    | "unknown";        // Fallback - return everything

// ============================================
// Category to Context Mapping
// ============================================

/**
 * Maps YAML data categories to their allowed completion contexts.
 * Categories not listed here are allowed in all contexts.
 *
 * Note: Multiple contexts can be active simultaneously. For example, after BEGIN
 * with no actions, both "componentFlag" and "action" contexts are active.
 *
 * IMPORTANT: Keep this synchronized with:
 * - data/completion/weidu-tp2.yaml category names
 * - Grammar node types in grammars/weidu-tp2/
 */
const CATEGORY_CONTEXTS: CategoryContextMap<CompletionContext> = {
    // Prologue only
    prologue: ["prologue"],

    // Flag context (flag)
    flag: ["flag"],
    language: ["flag"],

    // Component flags
    componentFlag: ["componentFlag"],

    // Action context
    action: ["action"],
    when: ["when"],
    optGlob: ["action"],
    optCase: ["action"],
    optExact: ["action"],
    arraySortType: ["action"],

    // Patch context
    patch: ["patch"],
    iesdpOther: ["patch"],
    iesdpStrref: ["patch"],
    iesdpResref: ["patch"],
    iesdpDword: ["patch"],
    iesdpWord: ["patch"],
    iesdpByte: ["patch"],
    iesdpChar: ["patch"],

    // Both action and patch
    value: ["action", "patch"],
    constants: ["action", "patch"],
    vars: ["action", "patch"],
    ielibResref: ["action", "patch"],
    ielibInt: ["action", "patch"],

    // Function libraries - context specific
    actionFunctions: ["action", "lafName"],
    patchFunctions: ["patch", "lpfName"],
};

/**
 * Filter configuration for TP2 completion context.
 * Defines how completion items are filtered based on cursor context.
 *
 * Note: Component BEGIN (starts a component, in "flag" category) and block BEGIN
 * (creates code blocks, in "value" category) use the same keyword. The grammar
 * uses alias("BEGIN", $.component_begin) to distinguish them at the AST level.
 * Both are included in completion data - the context filtering ensures the right
 * one appears at the right time.
 */
const FILTER_CONFIG: ContextFilterConfig<CompletionContext> = {
    categoryMap: CATEGORY_CONTEXTS,
    fallbackContext: "unknown",
};

/**
 * Validate configuration at module load time.
 * Logs warnings if mappings reference invalid contexts.
 */
const VALID_CONTEXTS = new Set<CompletionContext>([
    "prologue",
    "flag",
    "componentFlag",
    "action",
    "patch",
    "when",
    "lafName",
    "lpfName",
    "unknown",
]);

// Run validation once at module load
validateCategoryContextMap(FILTER_CONFIG, VALID_CONTEXTS, "weidu-tp2");

/**
 * Filter completion items based on multiple active contexts.
 * Public API for use by provider.
 */
export function filterItemsByContext(items: CompletionItem[], contexts: CompletionContext[]): CompletionItem[] {
    // If any context allows an item, include it
    return items.filter(item =>
        contexts.some(context =>
            isItemAllowedInContext(item, context, FILTER_CONFIG)
        )
    );
}

/** Helper to check if item is allowed in a single context. */
function isItemAllowedInContext(item: CompletionItem, context: CompletionContext, config: ContextFilterConfig<CompletionContext>): boolean {
    const category = (item as CompletionItemWithCategory).category;
    const label = item.label as string;

    // Check item-specific overrides first
    if (config.itemOverride) {
        const override = config.itemOverride(label, category, context);
        if (override !== undefined) {
            return override;
        }
    }

    // No category: show everywhere
    if (!category) {
        return true;
    }

    // Check if context is the fallback (permissive)
    if (context === config.fallbackContext) {
        return true;
    }

    // Category not in mapping: show everywhere
    const allowedContexts = config.categoryMap[category];
    if (!allowedContexts) {
        return true;
    }

    return allowedContexts.includes(context);
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

/**
 * Detect context by walking up from cursor node to find parent context,
 * then walking down through siblings to narrow the context.
 * Returns an array of contexts - multiple when ambiguous.
 */
function detectContextFromNode(node: SyntaxNode, ext: string, cursorOffset: number): CompletionContext[] {
    let current: SyntaxNode | null = node;

    while (current) {
        const type = current.type;

        // Check for function call name position (LAF/LPF)
        if (type === "action_launch_function" || type === "launch_action_function") {
            if (isAtFunctionName(cursorOffset, current)) {
                return ["lafName"];
            }
            return ["action"];
        }
        if (type === "patch_launch_function" || type === "launch_patch_function") {
            if (isAtFunctionName(cursorOffset, current)) {
                return ["lpfName"];
            }
            return ["patch"];
        }

        // INNER_ACTION creates action context inside patch
        if (type === "inner_action") {
            return ["action"];
        }

        // INNER_PATCH/OUTER_PATCH creates patch context
        if (type === "inner_patch" || type === "inner_patch_save" || type === "inner_patch_file") {
            return ["patch"];
        }
        if (type === "outer_patch" || type === "outer_patch_save") {
            return ["patch"];
        }

        // Patch file (.tpp content)
        if (type === "patch_file") {
            return ["patch"];
        }

        // Inside patches block (COPY...BEGIN...END)
        if (type === "patches") {
            return ["patch"];
        }

        // COPY actions - walk down to see what's below
        if (type.startsWith("action_copy")) {
            // Check if we're inside a patches block node
            for (const child of current.children) {
                if (child.type === "patches") {
                    if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                        return ["patch"];
                    }
                }
            }

            // Walk through children to determine position and what's below
            let hasPatchesBelow = false;
            let hasWhenBelow = false;
            let lastFilePairEnd = -1;

            for (const child of current.children) {
                if (child.type === "file_pair") {
                    lastFilePairEnd = Math.max(lastFilePairEnd, child.endIndex);
                }

                if (child.startIndex > cursorOffset) {
                    if (child.type === "patches" || isPatch(child.type)) {
                        hasPatchesBelow = true;
                    }
                    if (child.type === "when") {
                        hasWhenBelow = true;
                    }
                }
            }

            // Before/within file pairs → action context (COPY header)
            if (lastFilePairEnd > 0 && cursorOffset <= lastFilePairEnd) {
                return ["action"];
            }

            // Both patches and when below → both valid
            if (hasPatchesBelow && hasWhenBelow) {
                return ["patch", "when"];
            }
            // Only patches below → patch context
            if (hasPatchesBelow) {
                return ["patch"];
            }
            // Only when below → when context
            if (hasWhenBelow) {
                return ["when"];
            }

            // Default: after file pairs, both patches and when are possible
            return ["patch", "when"];
        }

        // Component body - walk down to see what's below
        if (type === "component") {
            return getComponentContextFromNode(cursorOffset, current);
        }

        // Action or patch node directly
        if (isAction(type)) {
            return ["action"];
        }
        if (isPatch(type)) {
            return ["patch"];
        }

        // Source file root
        if (type === "source_file") {
            // For .tp2 files, determine prologue vs flag
            if (ext === ".tp2") {
                return detectTp2RootContext(cursorOffset, current);
            }
            // For .tpa/.tph, check if file has component structure (BEGIN/GROUP)
            // If so, use tp2-style context detection; otherwise default to action
            if (ext === ".tpa" || ext === ".tph") {
                if (hasComponentStructure(current)) {
                    return detectTp2RootContext(cursorOffset, current);
                }
                return ["action"];
            }
            // For .tpp, default to patch
            if (ext === ".tpp") {
                return ["patch"];
            }
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
        if (child.type === "identifier") {
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



/**
 * Check if source file has component structure (BEGIN, GROUP, LANGUAGE).
 * Used to detect .tpa/.tph files that define components rather than just actions.
 */
function hasComponentStructure(root: SyntaxNode): boolean {
    for (const child of root.children) {
        if (child.type === "component" || child.type === "language_directive") {
            return true;
        }
    }
    return false;
}

/**
 * Get component context by walking through children (both above and below cursor).
 * Shared logic for both direct component nodes and trailing areas.
 */
function getComponentContextFromNode(cursorOffset: number, component: SyntaxNode): CompletionContext[] {
    // Check if we're inside a component flag node
    for (const child of component.children) {
        if (COMPONENT_FLAG_TYPES.has(child.type)) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return ["componentFlag"];
            }
        }
    }

    // Walk both directions: check what's above and below cursor
    let hasActionsAbove = false;
    let hasFlagsBelow = false;
    let hasActionsBelow = false;

    for (const child of component.children) {
        if (child.endIndex < cursorOffset) {
            // Above cursor - only track actions (once an action appears, we're past flags)
            if (isAction(child.type)) {
                hasActionsAbove = true;
            }
        } else if (child.startIndex > cursorOffset) {
            // Below cursor
            if (COMPONENT_FLAG_TYPES.has(child.type)) {
                hasFlagsBelow = true;
            }
            if (isAction(child.type)) {
                hasActionsBelow = true;
            }
        }
    }

    // If there's an action above, we're past the flags section → action context
    if (hasActionsAbove) {
        return ["action"];
    }

    // Both flags and actions below → both valid
    if (hasFlagsBelow && hasActionsBelow) {
        return ["componentFlag", "action"];
    }
    // Only flags below → componentFlag context
    if (hasFlagsBelow) {
        return ["componentFlag"];
    }
    // Only actions below → action context
    if (hasActionsBelow) {
        return ["action"];
    }
    // Nothing above or below → both valid
    return ["componentFlag", "action"];
}

/**
 * Detect context within .tp2 source file root.
 * Determines if we're in prologue or flag section.
 *
 * Note: Component nodes only span from BEGIN to the last action/flag.
 * Empty lines after a component (but before the next BEGIN) are not part
 * of the component node, but should still be treated as inside the component
 * for completion purposes.
 */
function detectTp2RootContext(cursorOffset: number, root: SyntaxNode): CompletionContext[] {
    // TP2 is strictly ordered: prologue → flags → language → components
    let foundLanguage = false;
    let lastComponent: SyntaxNode | null = null;

    for (const child of root.children) {
        if (child.type === "language_directive") {
            foundLanguage = true;
            if (cursorOffset < child.startIndex) {
                return ["prologue"];
            }
        }
        if (child.type === "component") {
            // Check if cursor is BEFORE this component
            if (cursorOffset < child.startIndex) {
                // If we have a previous component, cursor is in its trailing area
                if (lastComponent) {
                    return getComponentContextFromNode(cursorOffset, lastComponent);
                }
                return foundLanguage ? ["flag"] : ["prologue"];
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

    // After all components or before any - check what we found
    if (foundLanguage) {
        return ["flag"]; // After LANGUAGE, ready for BEGIN
    }
    return ["prologue"]; // Before LANGUAGE
}

