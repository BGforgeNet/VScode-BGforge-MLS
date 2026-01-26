/**
 * Document symbol conversion - IndexedSymbol[] to DocumentSymbol[].
 *
 * DocumentSymbol is used for the outline view (Ctrl+Shift+O) and breadcrumbs.
 * It has a hierarchical structure with children, but we currently return a flat
 * list (no hierarchy) for simplicity.
 *
 * This is computed on request from IndexedSymbol[] rather than pre-stored because:
 * - DocumentSymbol has a hierarchical structure that doesn't fit flat storage
 * - It's rarely requested compared to completion/hover
 * - The conversion is simple (O(n) filtering and mapping)
 */

import { type DocumentSymbol } from "vscode-languageserver/node";
import {
    type IndexedSymbol,
    type SymbolLocation,
    ScopeLevel,
    symbolKindToVscodeKind,
} from "./symbol";

/**
 * Convert IndexedSymbol[] to DocumentSymbol[] for outline view.
 *
 * Filters out function-scoped and loop-scoped symbols since they're not
 * useful in the document outline (too granular).
 *
 * Returns a flat list (no hierarchy). Hierarchy could be added later by
 * grouping symbols by containerId, but that's not currently needed.
 */
export function getDocumentSymbols(symbols: readonly IndexedSymbol[]): DocumentSymbol[] {
    const results: DocumentSymbol[] = [];

    for (const symbol of symbols) {
        // Skip symbols without locations (static/built-in symbols have no source file)
        if (!symbol.location) {
            continue;
        }

        // Skip function/loop-scoped symbols - they're too granular for outline
        if (symbol.scope.level === ScopeLevel.Function ||
            symbol.scope.level === ScopeLevel.Loop) {
            continue;
        }

        results.push(convertSymbol(symbol, symbol.location));
    }

    return results;
}

/**
 * Convert a single IndexedSymbol to DocumentSymbol.
 * Caller must ensure symbol has a valid location.
 */
function convertSymbol(symbol: IndexedSymbol, location: SymbolLocation): DocumentSymbol {
    const docSymbol: DocumentSymbol = {
        name: symbol.name,
        kind: symbolKindToVscodeKind(symbol.kind),
        range: location.range,
        selectionRange: location.range,
    };

    // Add detail from pre-computed completion item
    if (symbol.completion.detail) {
        docSymbol.detail = symbol.completion.detail;
    }

    return docSymbol;
}
