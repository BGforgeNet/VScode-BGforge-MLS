/**
 * Context-aware completion for WeiDU TP2 files.
 * Detects cursor context using tree-sitter and filters completions accordingly.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";
import { isAction, isPatch } from "./format-utils";

// ============================================
// Context Types
// ============================================

/**
 * Completion context types matching grammar hierarchy.
 * See grammars/weidu-tp2/README.md for structure documentation.
 */
export type CompletionContext =
    | "prologue"        // BACKUP, AUTHOR before any flag/language
    | "flag"            // TP2 flags, LANGUAGE, BEGIN
    | "componentFlag"   // After BEGIN, before first action
    | "componentFlagBoundary" // At boundary between componentFlag and action
    | "action"          // Inside component, .tpa, .tph
    | "patch"           // Inside COPY patches, .tpp
    | "lafName"         // After LAF keyword (action functions only)
    | "lpfName"         // After LPF keyword (patch functions only)
    | "unknown";        // Fallback - return everything

// ============================================
// Category to Context Mapping
// ============================================

/**
 * Maps YAML data categories to their allowed completion contexts.
 * Categories not listed here are allowed in all contexts.
 */
const CATEGORY_CONTEXTS: Record<string, CompletionContext[]> = {
    // Prologue only
    prologue: ["prologue"],

    // Flag context (flag)
    flag: ["flag"],
    language: ["flag"],

    // Component flags (after BEGIN, before actions)
    componentFlag: ["componentFlag", "componentFlagBoundary"],

    // Action context (also at boundary where both flags and actions are valid)
    action: ["action", "componentFlagBoundary"],
    when: ["action"],
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
 * Check if a category is allowed in the given context.
 * Categories not in CATEGORY_CONTEXTS are allowed everywhere.
 */
export function isCategoryAllowed(category: string | undefined, context: CompletionContext): boolean {
    if (context === "unknown") {
        return true; // Fallback: show everything
    }
    if (!category) {
        return true; // No category: show everywhere
    }
    const allowed = CATEGORY_CONTEXTS[category];
    if (!allowed) {
        return true; // Category not in mapping: show everywhere
    }
    return allowed.includes(context);
}

/**
 * Check if a specific item should be shown in a context.
 * Handles items that appear in multiple contexts without YAML duplication.
 * BEGIN is in tp2-value (for blocks) but also starts components at flag level.
 */
export function isItemAllowedInContext(itemName: string, category: string | undefined, context: CompletionContext): boolean {
    // BEGIN starts components at top level (flag context)
    if (itemName === "BEGIN" && context === "flag") {
        return true;
    }
    return isCategoryAllowed(category, context);
}

// ============================================
// Context Detection
// ============================================

/**
 * Determine the completion context at a given position.
 * Uses tree-sitter to parse the text and walk up from cursor position.
 *
 * @param text Document text
 * @param line 0-based line number
 * @param character 0-based character offset
 * @param fileExtension File extension (e.g., ".tp2", ".tpa", ".tpp")
 * @returns The detected context, or "unknown" if detection fails
 */
export function getContextAtPosition(
    text: string,
    line: number,
    character: number,
    fileExtension: string
): CompletionContext {
    // Fallback based on file extension
    const extLower = fileExtension.toLowerCase();
    const defaultContext = getDefaultContext(extLower);

    if (!isInitialized()) {
        return defaultContext;
    }

    const parser = getParser();
    const tree = parser.parse(text);
    if (!tree) {
        return defaultContext;
    }

    // Compute cursor byte offset from line/character
    const cursorOffset = getByteOffset(text, line, character);

    // Find node at cursor position
    const node = tree.rootNode.descendantForPosition({ row: line, column: character });
    if (!node) {
        return defaultContext;
    }

    // Walk up the tree to find context-defining ancestor
    return detectContextFromNode(node, extLower, cursorOffset);
}

/**
 * Convert line/character to byte offset.
 */
function getByteOffset(text: string, line: number, character: number): number {
    let offset = 0;
    let currentLine = 0;

    for (let i = 0; i < text.length; i++) {
        if (currentLine === line) {
            return offset + character;
        }
        if (text[i] === "\n") {
            currentLine++;
        }
        offset++;
    }

    // If we're past the end, return the end offset
    return offset + character;
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
 * Detect context by walking up from a node.
 */
function detectContextFromNode(node: SyntaxNode, ext: string, cursorOffset: number): CompletionContext {
    let current: SyntaxNode | null = node;

    while (current) {
        const type = current.type;

        // Check for function call name position (LAF/LPF)
        if (type === "action_launch_function" || type === "launch_action_function") {
            if (isAtFunctionName(cursorOffset, current)) {
                return "lafName";
            }
            return "action";
        }
        if (type === "patch_launch_function" || type === "launch_patch_function") {
            if (isAtFunctionName(cursorOffset, current)) {
                return "lpfName";
            }
            return "patch";
        }

        // INNER_ACTION creates action context inside patch
        if (type === "inner_action") {
            return "action";
        }

        // INNER_PATCH/OUTER_PATCH creates patch context
        if (type === "inner_patch" || type === "inner_patch_save" || type === "inner_patch_file") {
            return "patch";
        }
        if (type === "outer_patch" || type === "outer_patch_save") {
            return "patch";
        }

        // Patch file (.tpp content)
        if (type === "patch_file") {
            return "patch";
        }

        // Inside patches block (COPY...BEGIN...END)
        if (type === "patches") {
            return "patch";
        }

        // COPY actions with patches inside
        if (type.startsWith("action_copy")) {
            // If we're inside the patches block, it's patch context
            // Otherwise it's action context
            if (isInsidePatchesBlock(cursorOffset, current)) {
                return "patch";
            }
            return "action";
        }

        // Component body
        if (type === "component") {
            return getComponentContext(cursorOffset, current);
        }

        // Action or patch node directly
        if (isAction(type)) {
            return "action";
        }
        if (isPatch(type)) {
            return "patch";
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
                return "action";
            }
            // For .tpp, default to patch
            if (ext === ".tpp") {
                return "patch";
            }
        }

        current = current.parent;
    }

    return "unknown";
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

/**
 * Check if cursor is inside the patches block of a COPY action.
 * Uses positional heuristics for incomplete code where patches node may not exist.
 */
function isInsidePatchesBlock(cursorOffset: number, copyAction: SyntaxNode): boolean {
    // Look for explicit patches node first
    let patchesStart = -1;
    for (const child of copyAction.children) {
        if (child.type === "patches") {
            patchesStart = child.startIndex;
            // Cursor inside patches node
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return true;
            }
        }
    }

    // If there's a patches node and cursor is before it but after file pairs,
    // we're still in patch context (e.g., on empty line between COPY header and patches)
    if (patchesStart > 0 && cursorOffset < patchesStart) {
        // Check if we're past the file pairs
        for (const child of copyAction.children) {
            if (child.type === "file_pair" && cursorOffset > child.endIndex) {
                return true;
            }
        }
    }

    // For incomplete code, use positional heuristic:
    // If cursor is after the last file_pair or string (destination), we're in patch context
    let lastFilePairEnd = -1;
    let lastStringEnd = -1;
    let actionEnd = copyAction.endIndex;
    let keywordEnd = -1;

    for (const child of copyAction.children) {
        // Track keyword position
        if (child.text.startsWith("COPY") || child.text === "INNER_ACTION") {
            keywordEnd = child.endIndex;
            continue;
        }

        if (child.type === "file_pair") {
            lastFilePairEnd = child.endIndex;
        }

        // Also check for bare strings (source/destination in incomplete parses)
        if (child.type === "string" && lastFilePairEnd < 0) {
            lastStringEnd = Math.max(lastStringEnd, child.endIndex);
        }

        // BUT_ONLY and similar come after patches, so if cursor is before them, we're in patches
        if (child.type === "but_only" && cursorOffset < child.startIndex) {
            actionEnd = child.startIndex;
        }
    }

    // Use whichever positional marker we found
    const patchAreaStart = lastFilePairEnd > 0 ? lastFilePairEnd : lastStringEnd;

    // If cursor is past the file pairs/strings area, it's patch context
    if (patchAreaStart > 0 && cursorOffset > patchAreaStart && cursorOffset < actionEnd) {
        return true;
    }

    // Fallback: if cursor is well inside the action (past keyword), assume patch context
    // This handles cases where tree-sitter doesn't recognize the structure at all
    if (keywordEnd > 0 && cursorOffset > keywordEnd + 10) {
        return true;
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
 * Check if cursor is inside a component flag node.
 */
function isInsideComponentFlag(cursorOffset: number, component: SyntaxNode): boolean {
    for (const child of component.children) {
        if (COMPONENT_FLAG_TYPES.has(child.type)) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Check if cursor is before the first action in a component.
 */
function isBeforeFirstAction(cursorOffset: number, component: SyntaxNode): boolean {
    // Find the first action child
    for (const child of component.children) {
        if (isAction(child.type)) {
            return cursorOffset < child.startIndex;
        }
    }
    // No actions found - we're in component flags area
    return true;
}

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
 * Detect context within .tp2 source file root.
 * Determines if we're in prologue or flag section.
 *
 * Note: Component nodes only span from BEGIN to the last action/flag.
 * Empty lines after a component (but before the next BEGIN) are not part
 * of the component node, but should still be treated as inside the component
 * for completion purposes.
 */
function detectTp2RootContext(cursorOffset: number, root: SyntaxNode): CompletionContext {
    // TP2 is strictly ordered: prologue → flags → language → components
    let foundLanguage = false;
    let lastComponent: SyntaxNode | null = null;

    for (const child of root.children) {
        if (child.type === "language_directive") {
            foundLanguage = true;
            if (cursorOffset < child.startIndex) {
                return "prologue";
            }
        }
        if (child.type === "component") {
            // Check if cursor is BEFORE this component
            if (cursorOffset < child.startIndex) {
                // If we have a previous component, cursor is in its trailing area
                if (lastComponent) {
                    return getComponentContext(cursorOffset, lastComponent);
                }
                return foundLanguage ? "flag" : "prologue";
            }
            // Check if cursor is INSIDE this component's span
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return getComponentContext(cursorOffset, child);
            }
            // Cursor is after this component - remember it for trailing area check
            lastComponent = child;
        }
    }

    // Cursor is after all children - if we found a component, we're in its trailing area
    if (lastComponent) {
        return getComponentContext(cursorOffset, lastComponent);
    }

    // After all components or before any - check what we found
    if (foundLanguage) {
        return "flag"; // After LANGUAGE, ready for BEGIN
    }
    return "prologue"; // Before LANGUAGE
}

/**
 * Get completion context within a component (flag area, boundary, or action area).
 * At the boundary between flags and actions, both are valid completions.
 */
function getComponentContext(cursorOffset: number, component: SyntaxNode): CompletionContext {
    if (!isBeforeFirstAction(cursorOffset, component)) {
        return "action";
    }
    // Cursor is before first action (or no actions yet)
    // Check if we're inside a flag node or at the boundary
    if (isInsideComponentFlag(cursorOffset, component)) {
        return "componentFlag";
    }
    // At boundary: after BEGIN+name (and possibly flags) but not inside a flag
    return "componentFlagBoundary";
}
