/**
 * Fallout SSL language provider.
 * Implements all Fallout SSL file features in one place.
 *
 * Uses unified Symbols storage for static completion and hover data.
 * Header-based symbols (procedures, macros from .h files) are handled by header-parser.
 * Local symbols (current file) are built with language-specific formatters
 * in local-symbols.ts, following the same pattern as TP2.
 */

import { type CompletionItem, type DocumentSymbol, type FoldingRange, type Location, type Position, type SignatureHelp, type WorkspaceEdit } from "vscode-languageserver/node";
import type { IndexedSymbol } from "../core/symbol";
import { conlog, getLinePrefix } from "../common";
import { EXT_FALLOUT_SSL_HEADERS, LANG_FALLOUT_SSL } from "../core/languages";
import { isHeaderFile } from "../core/location-utils";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { compile as falloutCompile } from "./compiler";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { resolveSymbolWithLocal } from "../shared/provider-helpers";
import { getJsdocCompletions } from "../shared/jsdoc-completions";
import { FALLOUT_JSDOC_TYPES } from "../shared/fallout-types";
import * as signature from "../shared/signature";
import { formatDocument, initParser } from "./format";
import { isInitialized, parseWithCache } from "./parser";
import { getFoldingRanges } from "../shared/folding-ranges";
import { getDocumentSymbols } from "./symbol";
import { getLocalDefinition } from "./definition";
import { renameSymbol, prepareRenameSymbol } from "./rename";
import { getLocalSignature } from "./signature";
import { parseHeaderToSymbols } from "./header-parser";
import { getLocalSymbols, lookupLocalSymbol, clearLocalSymbolsCache } from "./local-symbols";
import { getSslCompletionContext, SslCompletionContext, isSslDeclarationSite } from "./completion-context";

/** SSL block-level node types for code folding. */
const SSL_FOLDABLE_TYPES = new Set([
    "procedure",
    "if_stmt",
    "while_stmt",
    "for_stmt",
    "foreach_stmt",
    "switch_stmt",
    "block",
]);

class FalloutSslProvider implements LanguageProvider {
    readonly id = LANG_FALLOUT_SSL;
    readonly watchExtensions = [...EXT_FALLOUT_SSL_HEADERS];

    private symbolStore: Symbols | undefined;
    private staticSignatures: signature.SigMap | undefined;
    private storedContext: ProviderContext | undefined;

    async init(context: ProviderContext): Promise<void> {
        this.storedContext = context;

        await initParser();

        this.symbolStore = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_FALLOUT_SSL);
        this.symbolStore.loadStatic(staticSymbols);

        this.staticSignatures = signature.loadStatic(LANG_FALLOUT_SSL);

        conlog(`Fallout SSL provider initialized with ${staticSymbols.length} static symbols`);
    }

    resolveSymbol(name: string, text: string, uri: string): IndexedSymbol | undefined {
        return resolveSymbolWithLocal(name, text, uri, this.symbolStore, lookupLocalSymbol);
    }

    format(text: string, uri: string): FormatResult {
        if (!isInitialized()) {
            return { edits: [] };
        }
        return formatDocument(text, uri);
    }

    symbols(text: string): DocumentSymbol[] {
        if (!isInitialized()) {
            return [];
        }
        return getDocumentSymbols(text);
    }

    foldingRanges(text: string): FoldingRange[] {
        if (!isInitialized()) {
            return [];
        }
        const tree = parseWithCache(text);
        if (!tree) {
            return [];
        }
        return getFoldingRanges(tree.rootNode, SSL_FOLDABLE_TYPES);
    }

    definition(text: string, position: Position, uri: string): Location | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalDefinition(text, uri, position);
    }

    filterCompletions(items: CompletionItem[], text: string, position: Position, uri: string, triggerCharacter?: string): CompletionItem[] {
        const context = getSslCompletionContext(text, position);

        if (context === SslCompletionContext.Comment) {
            return [];
        }
        if (context === SslCompletionContext.Jsdoc) {
            return getJsdocCompletions(FALLOUT_JSDOC_TYPES, getLinePrefix(text, position));
        }

        if (triggerCharacter === "@") {
            return [];
        }

        // At declaration sites (e.g. procedure <name>, variable <name>, #define <name>),
        // the user is naming a new symbol — completions are not useful.
        if (isSslDeclarationSite(text, position)) {
            return [];
        }

        // Merge local symbols into completions (local takes precedence)
        const localSymbols = getLocalSymbols(text, uri);
        const localLabels = new Set(localSymbols.map(s => s.name));
        const filtered = items.filter(item => !localLabels.has(item.label as string));
        return [...localSymbols.map(s => s.completion), ...filtered];
    }

    shouldProvideFeatures(text: string, position: Position): boolean {
        const context = getSslCompletionContext(text, position);
        return context === SslCompletionContext.Code;
    }

    localSignature(text: string, symbol: string, paramIndex: number): SignatureHelp | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalSignature(text, symbol, paramIndex);
    }

    prepareRename(text: string, position: Position): { range: { start: Position; end: Position }; placeholder: string } | null {
        if (!isInitialized()) {
            return null;
        }
        return prepareRenameSymbol(text, position);
    }

    rename(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        if (!isInitialized()) {
            return null;
        }
        return renameSymbol(text, position, newName, uri);
    }

    getCompletions(_uri: string): CompletionItem[] {
        return this.symbolStore ? this.symbolStore.query({}).map((s: IndexedSymbol) => s.completion) : [];
    }

    getSignature(_uri: string, symbolName: string, paramIndex: number): SignatureHelp | null {
        if (this.staticSignatures) {
            const sig = this.staticSignatures.get(symbolName);
            if (sig) {
                return signature.getResponse(sig, paramIndex);
            }
        }
        const symbol = this.symbolStore?.lookup(symbolName);
        if (symbol?.signature) {
            return signature.getResponse(symbol.signature, paramIndex);
        }
        return null;
    }

    getSymbolDefinition(symbolName: string): Location | null {
        const symbol = this.symbolStore?.lookup(symbolName);
        return symbol?.location ?? null;
    }

    reloadFileData(uri: string, text: string): void {
        if (isHeaderFile(uri) && this.symbolStore) {
            const parsedSymbols = parseHeaderToSymbols(uri, text, this.storedContext?.workspaceRoot);
            this.symbolStore.updateFile(uri, parsedSymbols);
        }
    }

    onWatchedFileDeleted(uri: string): void {
        this.symbolStore?.clearFile(uri);
    }

    onDocumentClosed(uri: string): void {
        clearLocalSymbolsCache(uri);
    }

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!this.storedContext) {
            conlog("Fallout SSL provider not initialized, cannot compile");
            return;
        }
        await falloutCompile(uri, this.storedContext.settings.falloutSSL, interactive, text);
    }
}

export const falloutSslProvider: LanguageProvider = new FalloutSslProvider();
