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
 * Extended completion item with optional category metadata.
 * The category field is added by scripts/generate_data.py at build time.
 */
export interface CompletionItemWithCategory extends CompletionItem {
    /**
     * Category from YAML data file (e.g., "action", "patch", "flag").
     * Items without this field are shown in all contexts (e.g., local completions).
     */
    category?: string;
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

/**
 * Validate category-context mapping at runtime.
 * Checks for common mistakes and logs warnings.
 *
 * @param config - Filter configuration to validate
 * @param validContexts - Set of valid context values
 * @param languageId - Language identifier for logging
 */
export function validateCategoryContextMap<TContext extends string>(
    config: ContextFilterConfig<TContext>,
    validContexts: Set<TContext>,
    languageId: string
): void {
    for (const [category, contexts] of Object.entries(config.categoryMap)) {
        if (contexts.length === 0) {
            console.warn(`[${languageId}] Category "${category}" has no allowed contexts - will never appear`);
        }

        for (const context of contexts) {
            if (!validContexts.has(context)) {
                console.warn(
                    `[${languageId}] Category "${category}" references invalid context "${context}". ` +
                    `Valid contexts: ${Array.from(validContexts).join(", ")}`
                );
            }
        }
    }

    if (!validContexts.has(config.fallbackContext)) {
        console.warn(
            `[${languageId}] Fallback context "${config.fallbackContext}" is not in valid contexts. ` +
            `Valid contexts: ${Array.from(validContexts).join(", ")}`
        );
    }
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

