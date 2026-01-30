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
const CATEGORY_EXCLUSIONS: Partial<Record<CompletionCategory, CompletionContext[]>> = {
    // Rule 1: No patch items in action context, funcParamName/Value, or lafName
    [CompletionCategory.Patch]: [CompletionContext.Action, CompletionContext.ActionKeyword, CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.LafName, CompletionContext.LpfName],
    [CompletionCategory.PatchFunctions]: [CompletionContext.Action, CompletionContext.ActionKeyword, CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.LafName],

    // Rule 2: No action items in patch context, funcParamName/Value, or lpfName
    [CompletionCategory.Action]: [CompletionContext.Patch, CompletionContext.PatchKeyword, CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.LafName, CompletionContext.LpfName],
    [CompletionCategory.ActionFunctions]: [CompletionContext.Patch, CompletionContext.PatchKeyword, CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.LpfName],

    // Rule 3: No structural items in funcParamName/Value or inappropriate contexts
    [CompletionCategory.Prologue]: [CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.LafName, CompletionContext.LpfName],
    [CompletionCategory.Flag]: [CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.Action, CompletionContext.ActionKeyword, CompletionContext.Patch, CompletionContext.PatchKeyword, CompletionContext.ComponentFlag, CompletionContext.LafName, CompletionContext.LpfName],
    [CompletionCategory.ComponentFlag]: [CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.LafName, CompletionContext.LpfName],
    [CompletionCategory.Language]: [CompletionContext.FuncParamName, CompletionContext.FuncParamValue, CompletionContext.LafName, CompletionContext.LpfName],

    // Rule 4: INT_VAR, STR_VAR, RET, RET_ARRAY - only in funcParamName context (not value)
    [CompletionCategory.FuncVarKeyword]: [CompletionContext.Action, CompletionContext.ActionKeyword, CompletionContext.Patch, CompletionContext.PatchKeyword, CompletionContext.Prologue, CompletionContext.Flag, CompletionContext.ComponentFlag, CompletionContext.When, CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamValue],

    // Rule 5: Value items not allowed in lafName/lpfName or funcParamName
    [CompletionCategory.Constants]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
    [CompletionCategory.Vars]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
    [CompletionCategory.Value]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
    [CompletionCategory.When]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
    [CompletionCategory.OptGlob]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
    [CompletionCategory.OptCase]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
    [CompletionCategory.OptExact]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
    [CompletionCategory.ArraySortType]: [CompletionContext.LafName, CompletionContext.LpfName, CompletionContext.FuncParamName],
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
    CompletionContext.FuncParamName,
    CompletionContext.FuncParamValue,
    CompletionContext.Unknown,
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

    // Get exclusion rules for this category
    const exclusions = CATEGORY_EXCLUSIONS[item.category];
    if (!exclusions || exclusions.length === 0) {
        return false;
    }

    // Exclude only if ALL active contexts are in the exclusion list
    // (If any context allows it, show it)
    return contexts.every(ctx => exclusions.includes(ctx));
}
