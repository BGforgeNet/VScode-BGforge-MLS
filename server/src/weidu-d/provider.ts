/**
 * WeiDU D language provider.
 * Implements all D file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import type { CompletionItem, DocumentSymbol, Location, Position } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_D } from "../core/languages";
import type { IndexedSymbol } from "../core/symbol";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { stripCommentsWeidu } from "../shared/format-utils";
import { getFormatOptions } from "../shared/format-options";
import { resolveSymbolStatic, getStaticCompletions, formatWithValidation } from "../shared/provider-helpers";
import { getDefinition } from "./definition";
import { formatDocument as formatAst } from "./format-core";
import { initParser, parseWithCache, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { compile as weiduCompile } from "../weidu-compile";

class WeiduDProvider implements LanguageProvider {
    readonly id = LANG_WEIDU_D;
    private symbolStore: Symbols | undefined;
    private storedContext: ProviderContext | undefined;

    async init(context: ProviderContext): Promise<void> {
        this.storedContext = context;

        await initParser();

        this.symbolStore = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_D);
        this.symbolStore.loadStatic(staticSymbols);

        conlog(`WeiDU D provider initialized with ${staticSymbols.length} static symbols`);
    }

    // D files have state labels but no user-defined functions/macros.
    // Symbol lookup is static-only (YAML data: actions + triggers).
    resolveSymbol(name: string, _text: string, _uri: string): IndexedSymbol | undefined {
        return resolveSymbolStatic(name, this.symbolStore);
    }

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
    }

    symbols(text: string): DocumentSymbol[] {
        return getDocumentSymbols(text);
    }

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    }

    getCompletions(_uri: string): CompletionItem[] {
        return getStaticCompletions(this.symbolStore);
    }

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!this.storedContext) {
            conlog("WeiDU D provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, this.storedContext.settings.weidu, interactive, text);
    }
}

export const weiduDProvider: LanguageProvider = new WeiduDProvider();
