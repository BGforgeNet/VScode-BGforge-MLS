/**
 * Fallout Worldmap TXT language provider.
 * Simple provider for worldmap.txt files with static completion and hover only.
 *
 * Uses unified Symbols storage (same as other providers).
 */

import type { CompletionItem, Hover } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_FALLOUT_WORLDMAP_TXT } from "../core/languages";
import type { IndexedSymbol } from "../core/symbol";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import type { LanguageProvider, ProviderContext } from "../language-provider";
import { resolveSymbolStatic, getVisibleSymbolsStatic, getStaticCompletions, getStaticHover } from "../shared/provider-helpers";

class FalloutWorldmapProvider implements LanguageProvider {
    readonly id = LANG_FALLOUT_WORLDMAP_TXT;
    private symbolStore: Symbols | undefined;

    async init(_context: ProviderContext): Promise<void> {
        this.symbolStore = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_FALLOUT_WORLDMAP_TXT);
        this.symbolStore.loadStatic(staticSymbols);

        conlog(`Fallout Worldmap provider initialized with ${staticSymbols.length} static symbols`);
    }

    resolveSymbol(name: string, _text: string, _uri: string): IndexedSymbol | undefined {
        return resolveSymbolStatic(name, this.symbolStore);
    }

    getVisibleSymbols(_text: string, _uri: string): IndexedSymbol[] {
        return getVisibleSymbolsStatic(this.symbolStore);
    }

    getCompletions(_uri: string): CompletionItem[] {
        return getStaticCompletions(this.symbolStore);
    }

    getHover(_uri: string, symbolName: string): Hover | null {
        return getStaticHover(this.symbolStore, symbolName);
    }
}

export const falloutWorldmapProvider: LanguageProvider = new FalloutWorldmapProvider();
