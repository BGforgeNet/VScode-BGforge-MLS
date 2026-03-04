/**
 * WeiDU BAF language provider.
 * Implements all BAF file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import type { CompletionItem, FoldingRange } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_BAF } from "../core/languages";
import type { IndexedSymbol } from "../core/symbol";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { stripCommentsWeidu } from "../shared/format-utils";
import { resolveSymbolStatic, getStaticCompletions, formatWithValidation } from "../shared/provider-helpers";
import { fileURLToPath } from "url";
import { formatDocument as formatAst, type FormatOptions } from "./format-core";
import { initParser, parseWithCache, isInitialized } from "./parser";
import { compile as weiduCompile } from "../weidu-compile";
import { getFoldingRanges } from "../shared/folding-ranges";
import { SyntaxType } from "./tree-sitter.d";

const DEFAULT_INDENT = 4;

/** BAF block-level node types for code folding. */
const BAF_FOLDABLE_TYPES = new Set([
    SyntaxType.Block,
    SyntaxType.Response,
]);

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? DEFAULT_INDENT };
    } catch {
        return { indentSize: DEFAULT_INDENT };
    }
}

class WeiduBafProvider implements LanguageProvider {
    readonly id = LANG_WEIDU_BAF;
    private symbolStore: Symbols | undefined;
    private storedContext: ProviderContext | undefined;

    async init(context: ProviderContext): Promise<void> {
        this.storedContext = context;

        await initParser();

        this.symbolStore = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_BAF);
        this.symbolStore.loadStatic(staticSymbols);

        conlog(`WeiDU BAF provider initialized with ${staticSymbols.length} static symbols`);
    }

    // BAF has no user-defined constructs (no functions/macros/variables),
    // so symbol lookup is static-only (YAML data: actions + triggers).
    resolveSymbol(name: string, _text: string, _uri: string): IndexedSymbol | undefined {
        return resolveSymbolStatic(name, this.symbolStore);
    }

    foldingRanges(text: string): FoldingRange[] {
        if (!isInitialized()) {
            return [];
        }
        const tree = parseWithCache(text);
        if (!tree) {
            return [];
        }
        return getFoldingRanges(tree.rootNode, BAF_FOLDABLE_TYPES);
    }

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
    }

    getCompletions(_uri: string): CompletionItem[] {
        return getStaticCompletions(this.symbolStore);
    }

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!this.storedContext) {
            conlog("WeiDU BAF provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, this.storedContext.settings.weidu, interactive, text);
    }
}

export const weiduBafProvider: LanguageProvider = new WeiduBafProvider();
