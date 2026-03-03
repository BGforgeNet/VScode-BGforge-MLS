/**
 * Completion item filtering based on context.
 * Determines which completions should appear based on cursor context.
 */

import type { CompletionItem } from "vscode-languageserver/node";
import { CompletionCategory, CompletionContext, type Tp2CompletionItem } from "./types";

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
/** All name contexts (function/macro name positions). */
const ALL_NAME_CONTEXTS: CompletionContext[] = [
    CompletionContext.LafName, CompletionContext.LpfName,
    CompletionContext.LamName, CompletionContext.LpmName,
];

/** Common exclusions for non-completable contexts: all name and param contexts. */
const FUNC_PARAM_CONTEXTS: CompletionContext[] = [
    CompletionContext.FuncParamName, CompletionContext.FuncParamValue,
];

const CATEGORY_EXCLUSIONS: Partial<Record<CompletionCategory, CompletionContext[]>> = {
    // Rule 1: Patch commands excluded from action and all name contexts
    [CompletionCategory.Patch]: [CompletionContext.Action, CompletionContext.ActionKeyword, ...FUNC_PARAM_CONTEXTS, ...ALL_NAME_CONTEXTS],
    // PatchFunctions: show in LpfName (that's their purpose), exclude from all other name contexts
    [CompletionCategory.PatchFunctions]: [CompletionContext.Action, CompletionContext.ActionKeyword, ...FUNC_PARAM_CONTEXTS, CompletionContext.LafName, CompletionContext.LamName, CompletionContext.LpmName],
    // PatchMacros: show in LpmName, exclude from all other name contexts
    [CompletionCategory.PatchMacros]: [CompletionContext.Action, CompletionContext.ActionKeyword, ...FUNC_PARAM_CONTEXTS, CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.LamName],

    // Rule 2: Action commands excluded from patch and all name contexts
    [CompletionCategory.Action]: [CompletionContext.Patch, CompletionContext.PatchKeyword, ...FUNC_PARAM_CONTEXTS, ...ALL_NAME_CONTEXTS],
    // ActionFunctions: show in LafName, exclude from all other name contexts
    [CompletionCategory.ActionFunctions]: [CompletionContext.Patch, CompletionContext.PatchKeyword, ...FUNC_PARAM_CONTEXTS, CompletionContext.LpfName, CompletionContext.LamName, CompletionContext.LpmName],
    // ActionMacros: show in LamName, exclude from all other name contexts
    [CompletionCategory.ActionMacros]: [CompletionContext.Patch, CompletionContext.PatchKeyword, ...FUNC_PARAM_CONTEXTS, CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.LpmName],

    // Rule 3: Dimorphic functions show in LafName and LpfName, exclude from macro name contexts
    [CompletionCategory.DimorphicFunctions]: [...FUNC_PARAM_CONTEXTS, CompletionContext.LamName, CompletionContext.LpmName],

    // Rule 4: No structural items in funcParamName/Value or inappropriate contexts
    [CompletionCategory.Prologue]: [...FUNC_PARAM_CONTEXTS, ...ALL_NAME_CONTEXTS],
    [CompletionCategory.Flag]: [...FUNC_PARAM_CONTEXTS, CompletionContext.Action, CompletionContext.ActionKeyword, CompletionContext.Patch, CompletionContext.PatchKeyword, CompletionContext.ComponentFlag, ...ALL_NAME_CONTEXTS],
    [CompletionCategory.ComponentFlag]: [...FUNC_PARAM_CONTEXTS, ...ALL_NAME_CONTEXTS],
    [CompletionCategory.Language]: [...FUNC_PARAM_CONTEXTS, ...ALL_NAME_CONTEXTS],

    // Rule 5: INT_VAR, STR_VAR, RET, RET_ARRAY - only in funcParamName context (not value)
    [CompletionCategory.FuncVarKeyword]: [CompletionContext.Action, CompletionContext.ActionKeyword, CompletionContext.Patch, CompletionContext.PatchKeyword, CompletionContext.Prologue, CompletionContext.Flag, CompletionContext.ComponentFlag, CompletionContext.When, ...ALL_NAME_CONTEXTS, CompletionContext.FuncParamValue],

    // Rule 6: Value items not allowed in any name context or funcParamName
    [CompletionCategory.Constants]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.Vars]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.Value]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.When]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.OptGlob]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.OptCase]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.OptExact]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.Caching]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
    [CompletionCategory.ArraySortType]: [...ALL_NAME_CONTEXTS, CompletionContext.FuncParamName],
};

/**
 * Valid contexts for validation.
 */
const VALID_CONTEXTS = new Set<CompletionContext>([
    CompletionContext.Prologue,
    CompletionContext.Flag,
    CompletionContext.ComponentFlag,
    CompletionContext.Action,
    CompletionContext.ActionKeyword,
    CompletionContext.Patch,
    CompletionContext.PatchKeyword,
    CompletionContext.When,
    CompletionContext.LafName,
    CompletionContext.LpfName,
    CompletionContext.LamName,
    CompletionContext.LpmName,
    CompletionContext.FuncParamName,
    CompletionContext.FuncParamValue,
    CompletionContext.Unknown,
]);

// Validation of exclusion rules is covered by unit tests in completion-filter.test.ts.
// Exported for test access.
export { CATEGORY_EXCLUSIONS, VALID_CONTEXTS };

/**
 * Filter completion items based on exclusion rules.
 * Public API for use by provider.
 *
 * An item is excluded only if ALL active contexts exclude it.
 * This is permissive: when uncertain, we show more rather than less.
 */
export function filterItemsByContext(items: Tp2CompletionItem[], contexts: CompletionContext[]): CompletionItem[] {
    // Unknown context = show everything
    if (contexts.includes(CompletionContext.Unknown)) {
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
 * - Category with no exclusions → never excluded (default allow)
 * - Category excluded by ALL contexts → excluded (unanimous rejection)
 * - Category excluded by SOME contexts → NOT excluded (permissive - any approval wins)
 *
 * @param item TP2 completion item (category is always present)
 * @param contexts Active completion contexts (may be empty)
 * @returns true if item should be hidden, false otherwise
 */
function isItemExcluded(item: Tp2CompletionItem, contexts: CompletionContext[]): boolean {
    // No contexts = nothing to exclude against
    if (contexts.length === 0) {
        return false;
    }

    // Items without category are never excluded (e.g., local symbols without YAML data)
    if (item.category === undefined) {
        return false;
    }

    // Get exclusion rules for this category
    const exclusions = CATEGORY_EXCLUSIONS[item.category];
    if (!exclusions || exclusions.length === 0) {
        return false;
    }

    // Exclude only if ALL active contexts are in the exclusion list
    // (If any context allows it, show it)
    return contexts.every(ctx => exclusions.includes(ctx));
}
