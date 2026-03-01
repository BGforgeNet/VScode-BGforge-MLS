/**
 * Shared types for WeiDU TP2 completion context detection and filtering.
 * Used by context.ts and filter.ts.
 */

/**
 * Parameter section types for WeiDU function calls.
 */
export enum ParamSection {
    IntVar = "INT_VAR",
    StrVar = "STR_VAR",
    Ret = "RET",
    RetArray = "RET_ARRAY",
}

/**
 * Enriched context for function parameter completion.
 * Contains function name, parameter section, and already-used params.
 */
export interface FuncParamsContext {
    functionName: string;
    paramSection: ParamSection;
    usedParams: string[];
}

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
 * **Note on lafName/lpfName:**
 * These contexts only allow corresponding function names:
 * - lafName: only actionFunctions (LAF calls action functions)
 * - lpfName: only patchFunctions (LPF calls patch functions)
 *
 * **Note on funcParamName/funcParamValue:**
 * These contexts distinguish left and right sides of = in function parameters:
 * - funcParamName: parameter name position (left of = or no =)
 * - funcParamValue: parameter value position (right of =)
 * When uncertain, prefer funcParamName.
 */
export enum CompletionContext {
    Prologue = "prologue",
    Flag = "flag",
    ComponentFlag = "componentFlag",
    Action = "action",
    ActionKeyword = "actionKeyword",
    Patch = "patch",
    PatchKeyword = "patchKeyword",
    When = "when",
    LafName = "lafName",
    LpfName = "lpfName",
    LamName = "lamName",
    LpmName = "lpmName",
    FuncParamName = "funcParamName",
    FuncParamValue = "funcParamValue",
    Unknown = "unknown",
    Comment = "comment",
    Jsdoc = "jsdoc",
}

// Re-export CompletionCategory from shared for convenience
export { CompletionCategory } from "../../shared/completion-context";

import type { CompletionItemWithCategory } from "../../shared/completion-context";

/**
 * TP2 completion item with optional category for context filtering.
 * Items from YAML data and AST extraction have category set.
 * Items from external sources (local symbols, registry) may not.
 * The filter treats missing category as "show in all contexts".
 */
export type Tp2CompletionItem = CompletionItemWithCategory;
