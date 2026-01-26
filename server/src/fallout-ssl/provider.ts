/**
 * Fallout SSL language provider.
 * Implements all Fallout SSL file features in one place.
 *
 * Uses unified Symbols storage for static completion and hover data.
 * Header-based symbols (procedures, macros from .h files) are handled by header-parser.
 */

import { type CompletionItem, type DocumentSymbol, type Hover, type Location, type Position, type SignatureHelp, type WorkspaceEdit } from "vscode-languageserver/node";
import type { IndexedSymbol } from "../core/symbol";
import { conlog } from "../common";
import { EXT_FALLOUT_SSL_HEADERS, LANG_FALLOUT_SSL } from "../core/languages";
import { isHeaderFile } from "../core/location-utils";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { compile as falloutCompile } from "./compiler";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import * as signature from "../shared/signature";
import { formatDocument, initParser } from "./format";
import { isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { getLocalDefinition } from "./definition";
import { getLocalHover } from "./hover";
import { renameSymbol, prepareRenameSymbol } from "./rename";
import { getLocalCompletions } from "./completion";
import { getLocalSignature } from "./signature";
import { parseHeaderToSymbols } from "./header-parser";
import { getLocalSymbols, lookupLocalSymbol, clearLocalSymbolsCache } from "./local-symbols";

/** Unified symbol storage for static completion and hover */
let symbols: Symbols | undefined;
/** Static signature map (loaded separately from completion) */
let staticSignatures: signature.SigMap | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

export const falloutSslProvider: LanguageProvider = {
    id: LANG_FALLOUT_SSL,
    watchExtensions: [...EXT_FALLOUT_SSL_HEADERS],

    /**
     * Resolve a single symbol by name.
     * This is the UNIFIED entry point - handles local + indexed merge internally.
     *
     * Resolution order:
     * 1. Local symbols (fresh buffer) - always checked first
     * 2. Indexed symbols (headers + static), EXCLUDING current file
     */
    resolveSymbol(name: string, text: string, uri: string): IndexedSymbol | undefined {
        // 1. Check local symbols first (fresh buffer takes priority)
        const local = lookupLocalSymbol(name, text, uri);
        if (local) {
            return local;
        }

        // 2. Fall back to indexed symbols (static + headers)
        if (symbols) {
            const indexed = symbols.lookup(name);
            // Return if NOT from the current file (static symbols have null uri)
            if (indexed && indexed.source.uri !== uri) {
                return indexed;
            }
            // Also return static symbols (uri is null)
            if (indexed && indexed.source.uri === null) {
                return indexed;
            }
        }

        return undefined;
    },

    /**
     * Get all visible symbols for completion.
     * Merges local + indexed, with local taking precedence.
     */
    getVisibleSymbols(text: string, uri: string): IndexedSymbol[] {
        // Get local symbols (fresh buffer)
        const localSymbols = getLocalSymbols(text, uri);
        const localNames = new Set(localSymbols.map(s => s.name));

        // Get indexed symbols, excluding current file and duplicates
        const indexedSymbols = symbols
            ? symbols.query({ excludeUri: uri })
            : [];

        // Filter out indexed symbols that have local overrides
        const filteredIndexed = indexedSymbols.filter((s: IndexedSymbol) => !localNames.has(s.name));

        return [...localSymbols, ...filteredIndexed];
    },

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize formatter (tree-sitter parser)
        await initParser();

        // Initialize symbol storage with static data
        symbols = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_FALLOUT_SSL);
        symbols.loadStatic(staticSymbols);

        // Load static signatures separately (not included in completion JSON)
        staticSignatures = signature.loadStatic(LANG_FALLOUT_SSL);

        conlog(`Fallout SSL provider initialized with ${staticSymbols.length} static symbols`);
    },

    format(text: string, uri: string): FormatResult {
        if (!isInitialized()) {
            return { edits: [] };
        }
        return formatDocument(text, uri);
    },

    symbols(text: string): DocumentSymbol[] {
        if (!isInitialized()) {
            return [];
        }
        return getDocumentSymbols(text);
    },

    definition(text: string, position: Position, uri: string): Location | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalDefinition(text, uri, position);
    },

    hover(text: string, symbol: string, uri: string, _position: Position): Hover | null | undefined {
        if (!isInitialized()) {
            return undefined;  // Parser not ready, fall through to data-driven hover
        }
        const localHover = getLocalHover(text, symbol, uri);
        if (localHover) {
            return localHover;  // Found local symbol
        }
        return undefined;  // Not found locally, fall through to data-driven hover
    },

    localCompletion(text: string): CompletionItem[] {
        if (!isInitialized()) {
            return [];
        }
        return getLocalCompletions(text);
    },

    localSignature(text: string, symbol: string, paramIndex: number): SignatureHelp | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalSignature(text, symbol, paramIndex);
    },

    prepareRename(text: string, position: Position): { range: { start: Position; end: Position }; placeholder: string } | null {
        if (!isInitialized()) {
            return null;
        }
        return prepareRenameSymbol(text, position);
    },

    rename(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        if (!isInitialized()) {
            return null;
        }
        return renameSymbol(text, position, newName, uri);
    },

    getCompletions(_uri: string): CompletionItem[] {
        // All symbols (static + headers) are in unified storage
        return symbols ? symbols.query({}).map((s: IndexedSymbol) => s.completion) : [];
    },

    getHover(_uri: string, symbolName: string): Hover | null {
        // All symbols (static + headers) are in unified storage
        const symbol = symbols?.lookup(symbolName);
        return symbol?.hover ?? null;
    },

    getSignature(_uri: string, symbolName: string, paramIndex: number): SignatureHelp | null {
        // Check static signatures first (not in unified storage)
        if (staticSignatures) {
            const sig = staticSignatures.get(symbolName);
            if (sig) {
                return signature.getResponse(sig, paramIndex);
            }
        }
        // Check unified storage (headers have signature in symbol)
        const symbol = symbols?.lookup(symbolName);
        if (symbol?.signature) {
            return signature.getResponse(symbol.signature, paramIndex);
        }
        return null;
    },

    getSymbolDefinition(symbolName: string): Location | null {
        // All symbols (static + headers) are in unified storage
        const symbol = symbols?.lookup(symbolName);
        return symbol?.location ?? null;
    },

    reloadFileData(uri: string, text: string): void {
        // Only reload headers (.h), not .ssl files
        // .ssl files use tree-sitter based local completion/signature/hover/definition
        if (isHeaderFile(uri) && symbols) {
            const parsedSymbols = parseHeaderToSymbols(uri, text, storedContext?.workspaceRoot);
            symbols.updateFile(uri, parsedSymbols);
        }
    },

    onWatchedFileDeleted(uri: string): void {
        symbols?.clearFile(uri);
    },

    onDocumentClosed(uri: string): void {
        // Clear local symbols cache for this document
        clearLocalSymbolsCache(uri);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("Fallout SSL provider not initialized, cannot compile");
            return;
        }
        await falloutCompile(uri, storedContext.settings.falloutSSL, interactive, text);
    },
};
