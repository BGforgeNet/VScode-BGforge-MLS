/**
 * Completion item filtering based on context.
 * Determines which completions should appear based on cursor context.
 */

import { CompletionItem } from "vscode-languageserver/node";
import { CompletionItemWithCategory } from "../../shared/completion-context";
import { CompletionCategory, CompletionContext } from "./types";

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
    patch: ["action", "actionKeyword", "funcParamName", "funcParamValue", "lafName", "lpfName"],
    patchFunctions: ["action", "actionKeyword", "funcParamName", "funcParamValue", "lafName"],

    // Rule 2: No action items in patch context, funcParamName/Value, or lpfName
    action: ["patch", "patchKeyword", "funcParamName", "funcParamValue", "lafName", "lpfName"],
    actionFunctions: ["patch", "patchKeyword", "funcParamName", "funcParamValue", "lpfName"],

    // Rule 3: No structural items in funcParamName/Value or inappropriate contexts
    prologue: ["funcParamName", "funcParamValue", "lafName", "lpfName"],
    flag: ["funcParamName", "funcParamValue", "action", "actionKeyword", "patch", "patchKeyword", "componentFlag", "lafName", "lpfName"],
    componentFlag: ["funcParamName", "funcParamValue", "lafName", "lpfName"],
    language: ["funcParamName", "funcParamValue", "lafName", "lpfName"],

    // Rule 4: INT_VAR, STR_VAR, RET, RET_ARRAY - only in funcParamName context (not value)
    funcVarKeyword: ["action", "actionKeyword", "patch", "patchKeyword", "prologue", "flag", "componentFlag", "when", "lafName", "lpfName", "funcParamValue"],

    // Rule 5: Value items not allowed in lafName/lpfName (only function names)
    // Rule 7: Value items not allowed in funcParamName (only parameter names)
    constants: ["lafName", "lpfName", "funcParamName"],
    vars: ["lafName", "lpfName", "funcParamName"],
    value: ["lafName", "lpfName", "funcParamName"],
    when: ["lafName", "lpfName", "funcParamName"],
    optGlob: ["lafName", "lpfName", "funcParamName"],
    optCase: ["lafName", "lpfName", "funcParamName"],
    optExact: ["lafName", "lpfName", "funcParamName"],
    arraySortType: ["lafName", "lpfName", "funcParamName"],

    // Rule 6: IElib/IESDP constants not allowed in lafName/lpfName
    // Rule 8: IElib/IESDP constants not allowed in funcParamName
    ielibInt: ["lafName", "lpfName", "funcParamName"],
    ielibResref: ["lafName", "lpfName", "funcParamName"],
    iesdpOther: ["lafName", "lpfName", "funcParamName"],
    iesdpStrref: ["lafName", "lpfName", "funcParamName"],
    iesdpResref: ["lafName", "lpfName", "funcParamName"],
    iesdpDword: ["lafName", "lpfName", "funcParamName"],
    iesdpWord: ["lafName", "lpfName", "funcParamName"],
    iesdpByte: ["lafName", "lpfName", "funcParamName"],
    iesdpChar: ["lafName", "lpfName", "funcParamName"],
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
    "funcParamName",
    "funcParamValue",
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
