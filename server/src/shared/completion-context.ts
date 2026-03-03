/**
 * Generic framework for context-aware completion filtering.
 *
 * Provides type-safe utilities for filtering completion items based on cursor context.
 * Language-specific implementations extend the base types and provide their own
 * context detection logic.
 *
 * Key concepts:
 * - CompletionContext: String union of valid contexts for a language
 * - CategoryContextMap: Maps category names to allowed contexts
 * - Context detection: Language-specific logic to determine cursor context
 * - Filtering: Generic logic to filter items based on category and context
 */

import { CompletionItem } from "vscode-languageserver/node";

/**
 * Valid completion item categories for WeiDU TP2.
 * Categories determine where completions should appear based on context.
 *
 * String values must match the category strings in generated JSON data files
 * (produced by scripts/generate_data.py from YAML).
 *
 * Category groups:
 * - Structural: Prologue, Flag, ComponentFlag, Language - File/component structure directives
 * - Commands: Action, Patch - Context-specific statements (value positions)
 * - Functions: ActionFunctions, PatchFunctions - User-defined functions
 * - Values: Constants, Vars, Value, When, OptGlob, OptCase, OptExact, Caching, ArraySortType
 * - Parameters: FuncVarKeyword - INT_VAR, STR_VAR, RET, RET_ARRAY keywords
 * - Documentation: Jsdoc - JSDoc tags and types
 *
 * @see CATEGORY_EXCLUSIONS in filter.ts for exclusion rules per category
 */
export enum CompletionCategory {
    // Structural directives
    Prologue = "prologue",
    Flag = "flag",
    ComponentFlag = "componentFlag",
    Language = "language",
    // Action context (value position)
    Action = "action",
    // Patch context (value position)
    Patch = "patch",
    // Value items (not commands)
    Constants = "constants",
    Vars = "vars",
    Value = "value",
    When = "when",
    OptGlob = "optGlob",
    OptCase = "optCase",
    OptExact = "optExact",
    Caching = "caching",
    ArraySortType = "arraySortType",
    // Function parameter keywords (INT_VAR, STR_VAR, RET, RET_ARRAY)
    FuncVarKeyword = "funcVarKeyword",
    // Function libraries
    ActionFunctions = "actionFunctions",
    PatchFunctions = "patchFunctions",
    DimorphicFunctions = "dimorphicFunctions",
    // Macro libraries
    ActionMacros = "actionMacros",
    PatchMacros = "patchMacros",
    // JSDoc tags and types
    Jsdoc = "jsdoc",
}

/**
 * Extended completion item with optional category metadata.
 * The category field is added by scripts/generate_data.py at build time.
 */
export interface CompletionItemWithCategory extends CompletionItem {
    /**
     * Category from YAML data file (e.g., "action", "patch", "flag").
     * Items without this field are shown in all contexts (e.g., local completions).
     */
    category?: CompletionCategory;
}

/**
 * Generic category-to-context mapping.
 * Maps category names to the contexts where they should appear.
 *
 * @template TContext - String union of valid context values
 *
 * Example:
 * ```
 * type MyContext = "global" | "local" | "function";
 * const mapping: CategoryContextMap<MyContext> = {
 *   "globalKeyword": ["global"],
 *   "localVar": ["local", "function"],
 * };
 * ```
 */
export type CategoryContextMap<TContext extends string> = Record<string, TContext[]>;

/**
 * Generic context-aware completion filter configuration.
 *
 * @template TContext - String union of valid context values
 */
export interface ContextFilterConfig<TContext extends string> {
    /**
     * Maps category names to allowed contexts.
     * Categories not in this map are allowed everywhere.
     */
    categoryMap: CategoryContextMap<TContext>;

    /**
     * Fallback context when detection fails.
     * Use a permissive context (e.g., "unknown") to show all items.
     */
    fallbackContext: TContext;

    /**
     * Item-specific overrides for special cases.
     * Called before checking categoryMap.
     * Return true to allow, false to deny, undefined to use default logic.
     *
     * Use sparingly - prefer fixing the grammar or YAML categories instead.
     */
    itemOverride?: (itemName: string, category: string | undefined, context: TContext) => boolean | undefined;
}

// ============================================
// UTF-8 Safe Position Utilities
// ============================================

/**
 * Convert line/character position to byte offset, handling UTF-8 properly.
 *
 * In LSP, positions use UTF-16 code units (JavaScript string indices).
 * Tree-sitter uses byte offsets in UTF-8.
 *
 * @param text - Document text
 * @param line - 0-based line number
 * @param character - 0-based UTF-16 code unit offset within line
 * @returns Byte offset in UTF-8 encoding
 */
export function getUtf8ByteOffset(text: string, line: number, character: number): number {
    let currentLine = 0;
    let lineStart = 0;

    // Find the start of the target line
    for (let i = 0; i < text.length; i++) {
        if (currentLine === line) {
            lineStart = i;
            break;
        }
        if (text[i] === "\n") {
            currentLine++;
        }
    }

    // Handle case where line is beyond end of document
    if (currentLine < line) {
        return Buffer.byteLength(text, "utf8");
    }

    // Find the character position within the line
    // character is in UTF-16 code units (JS string indices)
    let charCount = 0;
    for (let i = lineStart; i < text.length; i++) {
        if (charCount === character) {
            // Return byte offset up to this position
            return Buffer.byteLength(text.substring(0, i), "utf8");
        }
        if (text[i] === "\n") {
            // Reached end of line before reaching character position
            // Return byte offset of newline plus remaining characters
            const lineEndOffset = Buffer.byteLength(text.substring(0, i), "utf8");
            return lineEndOffset + (character - charCount);
        }
        charCount++;
    }

    // Character is beyond end of document
    // Return byte offset of document end plus remaining characters
    const docEndOffset = Buffer.byteLength(text, "utf8");
    return docEndOffset + (character - charCount);
}

