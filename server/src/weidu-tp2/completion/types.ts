/**
 * Shared types for WeiDU TP2 completion context detection and filtering.
 * Used by context.ts and filter.ts.
 */

/**
 * Enriched context for function parameter completion.
 * Contains function name, parameter section, and already-used params.
 */
export interface FuncParamsContext {
    functionName: string;
    paramSection: "INT_VAR" | "STR_VAR" | "RET" | "RET_ARRAY";
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
    | "funcParamName"   // Function parameter name (left of = or no =)
    | "funcParamValue"  // Function parameter value (right of =)
    | "unknown"         // Fallback - return everything
    | "comment"         // Inside a comment - no code completions
    | "jsdoc";          // Inside a JSDoc comment - offer tags and types

// Re-export CompletionCategory from shared for convenience
export { CompletionCategory } from "../../shared/completion-context";

import type { CompletionItemWithCategory } from "../../shared/completion-context";
import { CompletionCategory } from "../../shared/completion-context";

/** TP2 completion item with mandatory category for context filtering. */
export type Tp2CompletionItem = CompletionItemWithCategory & { category: CompletionCategory };
