/**
 * WeiDU D language provider.
 * Implements all D file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import type { CompletionItem, DocumentSymbol, FoldingRange, Location, Position } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_D } from "../core/languages";
import type { IndexedSymbol } from "../core/symbol";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { stripCommentsWeidu } from "../shared/format-utils";
import { getFormatOptions } from "../shared/format-options";
import { resolveSymbolStatic, getStaticCompletions, formatWithValidation } from "../shared/provider-helpers";
import { isInsideComment } from "./ast-utils";
import { getDefinition } from "./definition";
import { getStateLabelHover } from "./hover";
import { prepareRenameSymbol, renameSymbol } from "./rename";
import { formatDocument as formatAst } from "./format-core";
import { initParser, parseWithCache, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { compile as weiduCompile } from "../weidu-compile";
import { createFoldingRangesProvider } from "../shared/folding-ranges";
import { SyntaxType } from "./tree-sitter.d";

/** D block-level node types for code folding. */
const D_FOLDABLE_TYPES = new Set([
    SyntaxType.BeginAction,
    SyntaxType.AppendAction,
    SyntaxType.ChainAction,
    SyntaxType.ExtendAction,
    SyntaxType.InterjectAction,
    SyntaxType.InterjectCopyTrans,
    SyntaxType.ReplaceAction,
    SyntaxType.State,
    SyntaxType.Transition,
]);

const dFoldingRanges = createFoldingRangesProvider(isInitialized, parseWithCache, D_FOLDABLE_TYPES);

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

    shouldProvideFeatures(text: string, position: Position): boolean {
        return !isInsideComment(text, position);
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

    foldingRanges(text: string): FoldingRange[] {
        return dFoldingRanges(text);
    }

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    }

    prepareRename(text: string, position: Position) {
        return prepareRenameSymbol(text, position);
    }

    rename(text: string, position: Position, newName: string, uri: string) {
        return renameSymbol(text, position, newName, uri);
    }

    hover(text: string, symbol: string, uri: string, position: Position) {
        return getStateLabelHover(text, symbol, uri, position);
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
