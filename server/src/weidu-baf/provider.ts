/**
 * WeiDU BAF language provider.
 * Implements all BAF file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import type { CompletionItem, Hover } from "vscode-languageserver/node";
import type { IndexedSymbol } from "../core/symbol";
import { conlog } from "../common";
import { LANG_WEIDU_BAF } from "../core/languages";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting, stripCommentsWeidu } from "../shared/format-utils";
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

    /**
     * Resolve a single symbol by name.
     * BAF only has static symbols (no local definitions).
     */
    resolveSymbol(name: string, _text: string, _uri: string): IndexedSymbol | undefined {
        return symbols?.lookup(name);
    },

    /**
     * Get all visible symbols for completion.
     * BAF only has static symbols.
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
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_BAF);
        symbols.loadStatic(staticSymbols);

        conlog(`WeiDU BAF provider initialized with ${staticSymbols.length} static symbols`);
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
            conlog(`BAF formatter error: ${msg}`);
            return { edits: [], warning: `BAF formatter error: ${msg}` };
        }

        const validationError = validateFormatting(text, result.text, stripCommentsWeidu);
        if (validationError) {
            conlog(`BAF formatter validation failed: ${validationError}`);
            return {
                edits: [],
                warning: `BAF formatter validation failed: ${validationError}`,
            };
        }

        return { edits: createFullDocumentEdit(text, result.text) };
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

    reloadFileData(_uri: string, _text: string): void {
        // BAF has no user-defined functions - nothing to reload
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU BAF provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },
};
