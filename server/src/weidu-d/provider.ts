/**
 * WeiDU D language provider.
 * Implements all D file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import type { CompletionItem, DocumentSymbol, Hover, Location, Position } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_D } from "../core/languages";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { stripCommentsWeidu } from "../shared/format-utils";
import { getFormatOptions } from "../shared/format-options";
import { resolveSymbolStatic, getVisibleSymbolsStatic, getStaticCompletions, getStaticHover, formatWithValidation } from "../shared/provider-helpers";
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

    resolveSymbol(name, _text, _uri) {
        return resolveSymbolStatic(name, symbols);
    },

    getVisibleSymbols(_text, _uri) {
        return getVisibleSymbolsStatic(symbols);
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
        return formatWithValidation({
            text,
            uri,
            languageName: "D",
            isInitialized,
            parse: parseWithCache,
            formatAst: (rootNode, options) => formatAst(rootNode, options),
            getFormatOptions,
            stripComments: stripCommentsWeidu,
        });
    },

    symbols(text: string): DocumentSymbol[] {
        return getDocumentSymbols(text);
    },

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    },

    getCompletions(_uri: string): CompletionItem[] {
        return getStaticCompletions(symbols);
    },

    getHover(_uri: string, symbolName: string): Hover | null {
        return getStaticHover(symbols, symbolName);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU D provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },
};
