/**
 * Fallout Worldmap TXT language provider.
 * Simple provider for worldmap.txt files with static completion and hover only.
 *
 * Uses unified Symbols storage (same as other providers).
 */

import type { CompletionItem, Hover } from "vscode-languageserver/node";
import type { IndexedSymbol } from "../core/symbol";
import { conlog } from "../common";
import { LANG_FALLOUT_WORLDMAP_TXT } from "../core/languages";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import type { LanguageProvider, ProviderContext } from "../language-provider";

/** Unified symbol storage for static completion and hover */
let symbols: Symbols | undefined;

export const falloutWorldmapProvider: LanguageProvider = {
    id: LANG_FALLOUT_WORLDMAP_TXT,

    /**
     * Resolve a single symbol by name.
     * Worldmap only has static symbols (no local definitions).
     */
    resolveSymbol(name: string, _text: string, _uri: string): IndexedSymbol | undefined {
        return symbols?.lookup(name);
    },

    /**
     * Get all visible symbols for completion.
     * Worldmap only has static symbols.
     */
    getVisibleSymbols(_text: string, _uri: string): IndexedSymbol[] {
        return [...(symbols?.query({}) ?? [])];
    },

    async init(_context: ProviderContext): Promise<void> {
        // Initialize symbol storage with static data
        symbols = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_FALLOUT_WORLDMAP_TXT);
        symbols.loadStatic(staticSymbols);

        conlog(`Fallout Worldmap provider initialized with ${staticSymbols.length} static symbols`);
    },

    getCompletions(_uri: string): CompletionItem[] {
        if (!symbols) {
            return [];
        }
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
};
