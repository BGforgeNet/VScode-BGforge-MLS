/**
 * WeiDU D language provider.
 * Implements all D file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import type { CompletionItem, DocumentSymbol, Hover, Location, Position } from "vscode-languageserver/node";
import type { IndexedSymbol } from "../core/symbol";
import { conlog } from "../common";
import { LANG_WEIDU_D } from "../core/languages";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { createFullDocumentEdit, validateFormatting, stripCommentsWeidu } from "../shared/format-utils";
import { getFormatOptions } from "../shared/format-options";
import { getDefinition } from "./definition";
import { formatDocument as formatAst } from "./format-core";
import { initParser, parseWithCache, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { compile as weiduCompile } from "../weidu-compile";

/** Unified symbol storage for completion and hover */
let symbols: Symbols | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

export const weiduDProvider: LanguageProvider = {
    id: LANG_WEIDU_D,

    /**
     * Resolve a single symbol by name.
     * D only has static symbols (no local definitions).
     */
    resolveSymbol(name: string, _text: string, _uri: string): IndexedSymbol | undefined {
        return symbols?.lookup(name);
    },

    /**
     * Get all visible symbols for completion.
     * D only has static symbols.
     */
    getVisibleSymbols(_text: string, _uri: string): IndexedSymbol[] {
        return [...(symbols?.query({}) ?? [])];
    },

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize formatter (tree-sitter parser)
        await initParser();

        // Initialize symbol storage with static data
        symbols = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_D);
        symbols.loadStatic(staticSymbols);

        conlog(`WeiDU D provider initialized with ${staticSymbols.length} static symbols`);
    },

    format(text: string, uri: string): FormatResult {
        if (!isInitialized()) {
            return { edits: [] };
        }

        const tree = parseWithCache(text);
        if (!tree) {
            return { edits: [] };
        }

        const options = getFormatOptions(uri);

        let result;
        try {
            result = formatAst(tree.rootNode, options);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            conlog(`D formatter error: ${msg}`);
            return { edits: [], warning: `D formatter error: ${msg}` };
        }

        const validationError = validateFormatting(text, result.text, stripCommentsWeidu);
        if (validationError) {
            conlog(`D formatter validation failed: ${validationError}`);
            return {
                edits: [],
                warning: `D formatter validation failed: ${validationError}`,
            };
        }

        return { edits: createFullDocumentEdit(text, result.text) };
    },

    symbols(text: string): DocumentSymbol[] {
        return getDocumentSymbols(text);
    },

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    },

    getCompletions(_uri: string): CompletionItem[] {
        if (!symbols) {
            return [];
        }
        // Return all static symbols as completion items
        const allSymbols = symbols.query({});
        return allSymbols.map((s: IndexedSymbol) => s.completion);
    },

    getHover(_uri: string, symbolName: string): Hover | null {
        if (!symbols) {
            return null;
        }
        const symbol = symbols.lookup(symbolName);
        return symbol?.hover ?? null;
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU D provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },
};
