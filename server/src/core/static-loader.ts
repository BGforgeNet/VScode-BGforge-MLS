/**
 * Static symbol loader - loads built-in symbols from generated JSON files.
 *
 * Converts static completion/hover JSON (generated from YAML by generate_data.py)
 * into Symbol[] for use with Symbols. This enables a single source of truth
 * for all LSP features from static data.
 *
 * The completion JSON already contains embedded hover documentation, so we only
 * need to load one file to get both completion and hover data.
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
    symbolKindToCompletionKind,
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
    // Add more mappings as needed for other languages
    functions: SymbolKind.Function,
    procedures: SymbolKind.Procedure,
    macros: SymbolKind.Macro,
    variables: SymbolKind.Variable,
    constants: SymbolKind.Constant,
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
 * Set of callable symbol kinds.
 */
const CALLABLE_KINDS = new Set([
    SymbolKind.Function,
    SymbolKind.Procedure,
    SymbolKind.Macro,
    SymbolKind.Action,
    SymbolKind.Trigger,
]);

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

    // Build completion item (re-use existing data, ensure correct kind)
    const completion: CompletionItemWithCategory = {
        label: name,
        kind: symbolKindToCompletionKind(kind),
        documentation: item.documentation,
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
        return {
            ...base,
            kind: kind as SymbolKind.Function | SymbolKind.Procedure | SymbolKind.Macro | SymbolKind.Action | SymbolKind.Trigger,
            callable: {
                // Static symbols don't have detailed parameter info in completion JSON
                // This could be enhanced by loading signature JSON separately
            },
        } as CallableSymbol;
    }

    if (kind === SymbolKind.Variable || kind === SymbolKind.Parameter || kind === SymbolKind.LoopVariable) {
        return {
            ...base,
            kind,
            variable: {
                type: "unknown",
            },
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
 * Extract hover content from completion item documentation.
 */
function extractHover(item: StaticCompletionItem): IndexedSymbol["hover"] {
    if (item.documentation !== undefined) {
        // Documentation can be string or MarkupContent
        if (typeof item.documentation === "string") {
            return {
                contents: {
                    kind: "markdown",
                    value: item.documentation,
                },
            };
        }
        // Already MarkupContent
        return {
            contents: item.documentation as MarkupContent,
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
