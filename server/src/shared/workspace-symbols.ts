/**
 * Workspace symbol index for cross-file symbol navigation (Ctrl+T).
 *
 * Stores SymbolInformation per file, built from DocumentSymbol arrays.
 * Separate from the Symbols store (core/symbol-index.ts) used for
 * completion/hover/definition — that store only indexes header files
 * to control symbol visibility. This index covers ALL workspace files
 * since workspace symbols are a navigation feature (find any symbol
 * anywhere), not a visibility/scoping feature.
 *
 * Only top-level DocumentSymbols are indexed (no recursive children).
 * SSL and TP2 getDocumentSymbols() populate DocumentSymbol.children
 * with local variables for the outline view, but workspace symbol search
 * only needs global-scope symbols (procedures, macros, functions).
 *
 * Populated at startup:
 * - SSL: in buildIncludeGraph() which already reads all .ssl/.h files
 * - TP2: in scanWorkspaceHeaders() via reloadFileData()
 *
 * Updated at runtime:
 * - Open documents: onDidChangeContent -> reloadFileData (all languages)
 * - External file changes: file watcher -> reloadFileData (watched extensions only)
 */

import {
    DocumentSymbol,
    Location,
    SymbolInformation,
} from "vscode-languageserver/node";

/**
 * Index of workspace symbols for cross-file search.
 * Stores SymbolInformation per URI for fast updates and queries.
 */
export class WorkspaceSymbolIndex {
    private readonly files: Map<string, readonly SymbolInformation[]> = new Map();

    /**
     * Update symbols for a file from its DocumentSymbol array.
     * Replaces any existing symbols for the URI.
     */
    updateFile(uri: string, symbols: readonly DocumentSymbol[]): void {
        const infos = symbols.map(s => documentSymbolToSymbolInfo(s, uri));
        this.files.set(uri, infos);
    }

    /**
     * Remove all symbols for a file.
     */
    removeFile(uri: string): void {
        this.files.delete(uri);
    }

    /**
     * Search symbols by case-insensitive substring match.
     * Empty query returns all symbols (capped at maxResults).
     * LSP clients perform their own fuzzy filtering on top of these results.
     */
    search(query: string, maxResults = 500): SymbolInformation[] {
        const lowerQuery = query.toLowerCase();
        const allSymbols = [...this.files.values()].flat();

        const filtered = lowerQuery === ""
            ? allSymbols
            : allSymbols.filter(s => s.name.toLowerCase().includes(lowerQuery));

        return filtered.slice(0, maxResults);
    }
}

/**
 * Convert a DocumentSymbol (no URI) to a SymbolInformation (with URI location).
 * Uses selectionRange for the location (points to the name, not the full body).
 */
function documentSymbolToSymbolInfo(symbol: DocumentSymbol, uri: string): SymbolInformation {
    return {
        name: symbol.name,
        kind: symbol.kind,
        location: Location.create(uri, symbol.selectionRange),
    };
}
