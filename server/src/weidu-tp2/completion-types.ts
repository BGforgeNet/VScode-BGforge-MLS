/**
 * Shared types for WeiDU TP2 completion context detection and filtering.
 * Used by completion-context.ts and completion-filter.ts.
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
 * @see CATEGORY_EXCLUSIONS in completion-filter.ts for exclusion rules per category
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
