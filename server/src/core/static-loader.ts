/**
 * Static symbol loader - loads built-in symbols from generated JSON files.
 *
 * Converts static completion/hover JSON (generated from YAML by generate_data.py)
 * into Symbol[] for use with Symbols. This enables a single source of truth
 * for all LSP features from static data.
 *
 * The completion JSON already contains embedded hover documentation, so we only
 * need to load one file to get both completion and hover data.
 *
 * Symbol-building pattern: Universal factory for all languages.
 * Uses a generic `convertToSymbol()` factory that maps JSON completion items
 * to the IndexedSymbol discriminated union. Language-agnostic — hover/completion
 * content comes pre-formatted from the YAML→JSON pipeline (generate-data.ts).
 * This pattern cannot be merged with the language-specific builders because those
 * need AST/regex parsing and language-specific tooltip formatting.
 */

import { readFileSync } from "fs";
import * as path from "path";
import {
    type CompletionItem,
    CompletionItemKind,
    type MarkupContent,
} from "vscode-languageserver/node";
import type { CompletionItemWithCategory, CompletionCategory } from "../shared/completion-context";
import { conlog } from "../common";
import { LANG_WEIDU_TP2_TOOLTIP } from "./languages";
import {
    type IndexedSymbol,
    type CallableSymbol,
    type VariableSymbol,
    type ConstantSymbol,
    type StateSymbol,
    type ComponentSymbol,
    SymbolKind,
    ScopeLevel,
    SourceType,
    CallableContext,
    CallableDefType,
    symbolKindToCompletionKind,
    CALLABLE_KINDS,
} from "./symbol";

// =============================================================================
// Types
// =============================================================================

/**
 * Raw completion item from generated JSON.
 * Extends CompletionItem with category metadata from YAML source.
 */
interface StaticCompletionItem extends CompletionItem {
    /** Category from YAML file (e.g., "actions", "triggers", "keywords") */
    category?: string;
    /** Source identifier (always "builtin" for static data) */
    source?: string;
}

/**
 * Mapping from YAML category names to SymbolKind.
 */
const CATEGORY_TO_KIND: Record<string, SymbolKind> = {
    actions: SymbolKind.Action,
    triggers: SymbolKind.Trigger,
    keywords: SymbolKind.Constant, // Keywords like IF/THEN/END
    functions: SymbolKind.Function,
    procedures: SymbolKind.Procedure,
    macros: SymbolKind.Macro,
    variables: SymbolKind.Variable,
    constants: SymbolKind.Constant,
    // Note: `action` and `patch` categories are NOT mapped here because they
    // are shared between TP2 (CompletionItemKind.Function) and worldmap
    // (CompletionItemKind.Keyword). Those use the CompletionItemKind fallback.
    // TP2 typed function/macro categories
    actionFunctions: SymbolKind.Function,
    patchFunctions: SymbolKind.Function,
    dimorphicFunctions: SymbolKind.Function,
    actionMacros: SymbolKind.Macro,
    patchMacros: SymbolKind.Macro,
};

/**
 * Callable metadata per TP2 category.
 * Maps category names to their CallableContext and CallableDefType.
 * Only applies to items with CompletionItemKind.Function (not keywords/snippets).
 */
const CALLABLE_CATEGORY_META: Record<string, { context: CallableContext; dtype: CallableDefType }> = {
    // Note: `action` and `patch` are intentionally excluded. They contain commands
    // (LAF, COPY, WRITE_BYTE, etc.) which are not user-defined callables and should
    // not get "action function" / "patch function" prefix in tooltips.
    actionFunctions: { context: CallableContext.Action, dtype: CallableDefType.Function },
    patchFunctions: { context: CallableContext.Patch, dtype: CallableDefType.Function },
    // Dimorphic functions work in both action and patch contexts, so they get their
    // own context to display "dimorphic function" in hover instead of "action function".
    dimorphicFunctions: { context: CallableContext.Dimorphic, dtype: CallableDefType.Function },
    actionMacros: { context: CallableContext.Action, dtype: CallableDefType.Macro },
    patchMacros: { context: CallableContext.Patch, dtype: CallableDefType.Macro },
};

/**
 * Fallback mapping from CompletionItemKind to SymbolKind.
 * Used when category is not available or not recognized.
 */
function completionKindToSymbolKind(kind: CompletionItemKind): SymbolKind {
    switch (kind) {
        case CompletionItemKind.Function:
        case CompletionItemKind.Method:
            return SymbolKind.Function;
        case CompletionItemKind.Variable:
            return SymbolKind.Variable;
        case CompletionItemKind.Constant:
            return SymbolKind.Constant;
        case CompletionItemKind.Keyword:
            return SymbolKind.Constant;
        case CompletionItemKind.Snippet:
            return SymbolKind.Macro;
        default:
            return SymbolKind.Variable;
    }
}

// =============================================================================
// Loader
// =============================================================================

/**
 * Load static symbols for a language from generated JSON.
 *
 * @param langId Language ID (e.g., "weidu-baf", "fallout-ssl")
 * @returns Array of IndexedSymbol objects ready for Symbols.loadStatic()
 */
export function loadStaticSymbols(langId: string): IndexedSymbol[] {
    const items = loadCompletionJson(langId);
    if (!items || items.length === 0) {
        return [];
    }

    return items.map(item => convertToSymbol(item));
}

/**
 * Load raw completion items from JSON file.
 */
function loadCompletionJson(langId: string): StaticCompletionItem[] | undefined {
    try {
        // __dirname in bundled code points to server/out/
        const filePath = path.join(__dirname, `completion.${langId}.json`);
        return JSON.parse(readFileSync(filePath, "utf-8")) as StaticCompletionItem[];
    } catch (e) {
        conlog(`Failed to load static completion data for ${langId}: ${e}`);
        return undefined;
    }
}


/**
 * Convert a static completion item to an IndexedSymbol.
 * Returns the appropriate discriminated union type based on kind.
 */
function convertToSymbol(item: StaticCompletionItem): IndexedSymbol {
    const name = item.label;
    const kind = determineSymbolKind(item);

    // Static symbols have no source file - location is null
    const location = null;

    // Extract hover content from completion documentation
    const hover = extractHover(item);

    // Build completion item — derive documentation from hover (single source of truth).
    // This ensures any transformations (e.g., callable prefix injection) are consistent.
    const completion: CompletionItemWithCategory = {
        label: name,
        kind: symbolKindToCompletionKind(kind),
        documentation: hover.contents,
        category: item.category as CompletionCategory | undefined,
    };

    // Copy detail if present
    if (item.detail) {
        completion.detail = item.detail;
    }

    // Copy tags (e.g., deprecated) if present
    if (item.tags) {
        completion.tags = item.tags;
    }

    const base = {
        name,
        location,
        scope: { level: ScopeLevel.Global },
        source: { type: SourceType.Static, uri: null },
        completion,
        hover,
        // Static symbols don't have signature pre-computed in completion JSON
        // Signature is in a separate file - could be added later if needed
        signature: undefined,
    };

    // Return appropriate discriminated union type based on kind
    if (CALLABLE_KINDS.has(kind)) {
        // Populate callable metadata from category when available.
        // Only apply to items with Function CompletionItemKind (not keywords/snippets),
        // to avoid false positives on worldmap or other non-TP2 stanzas that reuse
        // category names like "action" with different CompletionItemKind values.
        const meta = item.category ? CALLABLE_CATEGORY_META[item.category] : undefined;
        const callable = (meta && item.kind === CompletionItemKind.Function)
            ? { context: meta.context, dtype: meta.dtype }
            : {};

        return {
            ...base,
            kind: kind as SymbolKind.Function | SymbolKind.Procedure | SymbolKind.Macro | SymbolKind.Action | SymbolKind.Trigger,
            callable,
        } as CallableSymbol;
    }

    if (kind === SymbolKind.Variable || kind === SymbolKind.Parameter || kind === SymbolKind.LoopVariable) {
        return {
            ...base,
            kind,
            variable: {},
        } as VariableSymbol;
    }

    if (kind === SymbolKind.State) {
        return {
            ...base,
            kind,
        } as StateSymbol;
    }

    if (kind === SymbolKind.Component) {
        return {
            ...base,
            kind,
        } as ComponentSymbol;
    }

    // Default: treat as constant
    return {
        ...base,
        kind: SymbolKind.Constant,
        constant: {
            value: "",
        },
    } as ConstantSymbol;
}

/**
 * Determine SymbolKind from category or CompletionItemKind.
 */
function determineSymbolKind(item: StaticCompletionItem): SymbolKind {
    // Prefer category-based mapping (more accurate)
    if (item.category) {
        const categoryKind = CATEGORY_TO_KIND[item.category];
        if (categoryKind !== undefined) {
            return categoryKind;
        }
    }

    // Fallback to CompletionItemKind mapping
    if (item.kind !== undefined) {
        return completionKindToSymbolKind(item.kind);
    }

    return SymbolKind.Variable;
}

/**
 * Inject "{context} {dtype} " prefix into weidu-tp2-tooltip code fences.
 * For example, transforms:
 *   ```weidu-tp2-tooltip\nCOPY ~source~ ~dest~\n```
 * into:
 *   ```weidu-tp2-tooltip\naction function COPY ~source~ ~dest~\n```
 *
 * Only affects weidu-tp2-tooltip fences; other fences (e.g., weidu-baf-tooltip)
 * are left untouched. Does not inject if the prefix is already present.
 */
function injectCallablePrefix(value: string, meta: { context: CallableContext; dtype: CallableDefType }): string {
    const fenceTag = `\`\`\`${LANG_WEIDU_TP2_TOOLTIP}\n`;
    const fenceIdx = value.indexOf(fenceTag);
    if (fenceIdx === -1) {
        return value;
    }

    const prefix = `${meta.context} ${meta.dtype} `;
    const insertAt = fenceIdx + fenceTag.length;

    // Guard: don't inject if prefix already present
    if (value.startsWith(prefix, insertAt)) {
        return value;
    }

    return value.slice(0, insertAt) + prefix + value.slice(insertAt);
}

/**
 * Extract hover content from completion item documentation.
 * Injects callable prefix for TP2 items with callable metadata.
 */
function extractHover(item: StaticCompletionItem): { contents: MarkupContent } {
    const meta = (item.category && item.kind === CompletionItemKind.Function)
        ? CALLABLE_CATEGORY_META[item.category]
        : undefined;

    if (item.documentation !== undefined) {
        // Documentation can be string or MarkupContent
        if (typeof item.documentation === "string") {
            const value = meta ? injectCallablePrefix(item.documentation, meta) : item.documentation;
            return {
                contents: {
                    kind: "markdown",
                    value,
                },
            };
        }
        // Already MarkupContent - inject prefix if applicable
        const markup = item.documentation as MarkupContent;
        if (meta && markup.kind === "markdown") {
            return {
                contents: {
                    kind: "markdown",
                    value: injectCallablePrefix(markup.value, meta),
                },
            };
        }
        return {
            contents: markup,
        };
    }

    // No documentation - create minimal hover from name
    return {
        contents: {
            kind: "markdown",
            value: item.label,
        },
    };
}
