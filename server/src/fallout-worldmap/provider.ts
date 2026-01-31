/**
 * Fallout Worldmap TXT language provider.
 * Simple provider for worldmap.txt files with static completion and hover only.
 *
 * Uses unified Symbols storage (same as other providers).
 */

import type { CompletionItem, Hover } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_FALLOUT_WORLDMAP_TXT } from "../core/languages";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import type { LanguageProvider, ProviderContext } from "../language-provider";
import { resolveSymbolStatic, getVisibleSymbolsStatic, getStaticCompletions, getStaticHover } from "../shared/provider-helpers";

/** Unified symbol storage for static completion and hover */
let symbols: Symbols | undefined;

export const falloutWorldmapProvider: LanguageProvider = {
    id: LANG_FALLOUT_WORLDMAP_TXT,

    resolveSymbol(name, _text, _uri) {
        return resolveSymbolStatic(name, symbols);
    },

    getVisibleSymbols(_text, _uri) {
        return getVisibleSymbolsStatic(symbols);
    },

    async init(_context: ProviderContext): Promise<void> {
        // Initialize symbol storage with static data
        symbols = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_FALLOUT_WORLDMAP_TXT);
        symbols.loadStatic(staticSymbols);

        conlog(`Fallout Worldmap provider initialized with ${staticSymbols.length} static symbols`);
    },

    getCompletions(_uri: string): CompletionItem[] {
        return getStaticCompletions(symbols);
    },

    getHover(_uri: string, symbolName: string): Hover | null {
        return getStaticHover(symbols, symbolName);
    },
};
