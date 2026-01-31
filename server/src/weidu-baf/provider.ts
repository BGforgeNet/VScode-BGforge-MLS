/**
 * WeiDU BAF language provider.
 * Implements all BAF file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import type { CompletionItem, Hover } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_BAF } from "../core/languages";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { stripCommentsWeidu } from "../shared/format-utils";
import { resolveSymbolStatic, getVisibleSymbolsStatic, getStaticCompletions, getStaticHover, formatWithValidation } from "../shared/provider-helpers";
import { fileURLToPath } from "url";
import { formatDocument as formatAst, type FormatOptions } from "./format-core";
import { initParser, parseWithCache, isInitialized } from "./parser";
import { compile as weiduCompile } from "../weidu-compile";

const DEFAULT_INDENT = 4;

/** Unified symbol storage for completion and hover */
let symbols: Symbols | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? DEFAULT_INDENT };
    } catch {
        return { indentSize: DEFAULT_INDENT };
    }
}

export const weiduBafProvider: LanguageProvider = {
    id: LANG_WEIDU_BAF,

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
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_BAF);
        symbols.loadStatic(staticSymbols);

        conlog(`WeiDU BAF provider initialized with ${staticSymbols.length} static symbols`);
    },

    format(text: string, uri: string): FormatResult {
        return formatWithValidation({
            text,
            uri,
            languageName: "BAF",
            isInitialized,
            parse: parseWithCache,
            formatAst: (rootNode, options) => formatAst(rootNode, options),
            getFormatOptions,
            stripComments: stripCommentsWeidu,
        });
    },

    getCompletions(_uri: string): CompletionItem[] {
        return getStaticCompletions(symbols);
    },

    getHover(_uri: string, symbolName: string): Hover | null {
        return getStaticHover(symbols, symbolName);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU BAF provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },
};
