/**
 * Fallout SSL language provider.
 * Implements all Fallout SSL file features in one place.
 *
 * Uses unified Symbols storage for static completion and hover data.
 * Header-based symbols (procedures, macros from .h files) are handled by header-parser.
 */

import { type CompletionItem, type DocumentSymbol, type Hover, type Location, type Position, type SignatureHelp, type WorkspaceEdit } from "vscode-languageserver/node";
import type { IndexedSymbol } from "../core/symbol";
import { conlog, getLinePrefix } from "../common";
import { EXT_FALLOUT_SSL_HEADERS, LANG_FALLOUT_SSL } from "../core/languages";
import { isHeaderFile } from "../core/location-utils";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { compile as falloutCompile } from "./compiler";
import { type FormatResult, HoverResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { resolveSymbolWithLocal, getVisibleSymbolsWithLocal } from "../shared/provider-helpers";
import { getJsdocCompletions } from "../shared/jsdoc-completions";
import { FALLOUT_JSDOC_TYPES } from "../shared/fallout-types";
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
import { getSslCompletionContext, SslCompletionContext } from "./completion-context";

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

    getVisibleSymbols(text: string, uri: string): IndexedSymbol[] {
        return getVisibleSymbolsWithLocal(text, uri, this.symbolStore, getLocalSymbols);
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

    definition(text: string, position: Position, uri: string): Location | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalDefinition(text, uri, position);
    }

    hover(text: string, symbol: string, uri: string, _position: Position): HoverResult {
        if (!isInitialized()) {
            return HoverResult.notHandled();
        }
        const localHover = getLocalHover(text, symbol, uri);
        if (localHover) {
            return HoverResult.found(localHover);
        }
        return HoverResult.notHandled();
    }

    localCompletion(text: string): CompletionItem[] {
        if (!isInitialized()) {
            return [];
        }
        return getLocalCompletions(text);
    }

    filterCompletions(items: CompletionItem[], text: string, position: Position, _uri: string, triggerCharacter?: string): CompletionItem[] {
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

        return items;
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

    getHover(_uri: string, symbolName: string): Hover | null {
        const symbol = this.symbolStore?.lookup(symbolName);
        return symbol?.hover ?? null;
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
