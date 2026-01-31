/**
 * WeiDU TP2 language provider.
 * Implements all TP2 file features in one place.
 *
 * Uses unified Symbols storage for static completion and hover data.
 * User-defined functions and variables from .tph headers are handled by header-parser.
 */

import { type CompletionItem, CompletionItemKind, type DocumentSymbol, type Hover, type Location, type Position, type WorkspaceEdit, InsertTextFormat } from "vscode-languageserver/node";
import { extname } from "path";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { EXT_WEIDU_TP2, LANG_WEIDU_TP2 } from "../core/languages";
import { isHeaderFile } from "../core/location-utils";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { getFormatOptions } from "../shared/format-options";
import { stripCommentsWeidu } from "../shared/format-utils";
import { resolveSymbolWithLocal, getVisibleSymbolsWithLocal, formatWithValidation } from "../shared/provider-helpers";
import { compile as weiduCompile } from "../weidu-compile";
import { getContextAtPosition, getFuncParamsContext } from "./completion/context";
import { filterItemsByContext } from "./completion/filter";
import { getParamCompletions } from "./completion/parameter";
import { CompletionCategory, CompletionContext, type Tp2CompletionItem } from "./completion/types";
import { formatDocument as formatAst } from "./format/core";
import { initParser, parseWithCache, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { getDefinition, isOnFunctionCallParamName } from "./definition";
import { parseHeaderToSymbols } from "./header-parser";
import { isCallableSymbol, type IndexedSymbol } from "../core/symbol";
import { renameSymbol, prepareRenameSymbol } from "./rename";
import { buildFunctionCallSnippet } from "./snippets";
import { getFunctionParamHover } from "./hover";
import { localCompletion, isInsideComment, isOnLoopVariableBinding } from "./ast-utils";
import { getLocalSymbols as extractLocalSymbols, lookupLocalSymbol, clearLocalSymbolsCache } from "./local-symbols";

/** Unified symbol storage for static completion and hover */
let symbols: Symbols | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

/**
 * Get the unified symbol storage for the TP2 provider.
 * Used by other modules (definition, completion, hover) to access symbols.
 */
export function getSymbols(): Symbols | undefined {
    return symbols;
}

/**
 * Add parameter completions (INT_VAR, STR_VAR names) when in funcParamName context.
 * Returns the original items if not in funcParamName context or no params available.
 */
function addParamCompletions(items: Tp2CompletionItem[], contexts: CompletionContext[]): Tp2CompletionItem[] {
    if (!contexts.includes(CompletionContext.FuncParamName)) {
        return items;
    }
    const funcContext = getFuncParamsContext();
    if (!funcContext) {
        return items;
    }
    const paramCompletions = getParamCompletions(funcContext);
    if (paramCompletions.length === 0) {
        return items;
    }
    return [...items, ...paramCompletions];
}

/**
 * Apply snippets for function/macro calls based on active contexts.
 * In name contexts (lafName/lpfName/lamName/lpmName), user already typed
 * the keyword — snippet has no prefix, only required params + END.
 * In patch/action contexts, user hasn't typed the keyword — snippet
 * includes LPF/LAF/LPM/LAM prefix + name + END.
 */
function applySnippets(
    items: Tp2CompletionItem[],
    contexts: CompletionContext[],
    text: string,
    uri: string
): Tp2CompletionItem[] {
    const inNameContext = contexts.includes(CompletionContext.LafName)
        || contexts.includes(CompletionContext.LpfName)
        || contexts.includes(CompletionContext.LamName)
        || contexts.includes(CompletionContext.LpmName);
    const inPatchContext = contexts.includes(CompletionContext.Patch) || contexts.includes(CompletionContext.PatchKeyword);
    const inActionContext = contexts.includes(CompletionContext.Action) || contexts.includes(CompletionContext.ActionKeyword);

    if (!inNameContext && !inPatchContext && !inActionContext) {
        return items;
    }

    return items.map((item) => {
        // Skip action/patch command keywords (LPF, LAF, COPY, etc.) —
        // these are not user-defined callables, just commands.
        const cat = item.category;
        if (cat === CompletionCategory.Action || cat === CompletionCategory.Patch) {
            return item;
        }

        const funcName = item.label as string;
        // Look up in both indexed and local symbols
        const symbol = symbols?.lookup(funcName) ?? lookupLocalSymbol(funcName, text, uri);
        if (!symbol || !isCallableSymbol(symbol)) {
            return item;
        }

        // Determine prefix based on context.
        // In name contexts, user already typed the keyword — no prefix.
        // In patch/action contexts, choose keyword based on callable dtype.
        const prefix = inNameContext
            ? undefined
            : getSnippetPrefix(symbol.callable.dtype, inPatchContext, inActionContext);

        const snippet = buildFunctionCallSnippet(symbol.callable, funcName, prefix);
        if (snippet) {
            return {
                ...item,
                insertText: snippet,
                insertTextFormat: InsertTextFormat.Snippet,
            };
        }
        return item;
    });
}

/**
 * Determine the keyword prefix for a function/macro snippet based on context.
 */
function getSnippetPrefix(
    dtype: string | undefined,
    inPatchContext: boolean,
    inActionContext: boolean
): string | undefined {
    const isMacro = dtype === "macro";
    if (inPatchContext) {
        return isMacro ? "LPM" : "LPF";
    }
    if (inActionContext) {
        return isMacro ? "LAM" : "LAF";
    }
    return undefined;
}

export const weiduTp2Provider: LanguageProvider = {
    id: LANG_WEIDU_TP2,
    watchExtensions: [...EXT_WEIDU_TP2],

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize tree-sitter parser for formatting
        await initParser();

        // Initialize symbol storage with static data
        symbols = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_TP2);
        symbols.loadStatic(staticSymbols);

        conlog(`WeiDU TP2 provider initialized with ${staticSymbols.length} static symbols`);
    },

    resolveSymbol(name: string, text: string, uri: string): IndexedSymbol | undefined {
        return resolveSymbolWithLocal(name, text, uri, symbols, lookupLocalSymbol);
    },

    getVisibleSymbols(text: string, uri: string): IndexedSymbol[] {
        return getVisibleSymbolsWithLocal(text, uri, symbols, extractLocalSymbols);
    },

    getCompletions(uri: string): CompletionItem[] {
        if (!symbols) {
            return [];
        }
        // Return symbols, excluding current file (local completion handles that)
        // Static and header symbols always have category set (see static-loader.ts, header-parser.ts)
        const allSymbols = symbols.query({ excludeUri: uri });
        return allSymbols.map((s: IndexedSymbol) => s.completion as Tp2CompletionItem);
    },

    filterCompletions(items: CompletionItem[], text: string, position: Position, uri: string, triggerCharacter?: string): CompletionItem[] {
        const filePath = fileURLToPath(uri);
        const ext = extname(filePath).toLowerCase();
        const contexts = getContextAtPosition(text, position.line, position.character, ext);

        conlog(`[tp2] Completion contexts: [${contexts.join(", ")}] at ${position.line}:${position.character} in ${ext}`);

        // No code completions inside comments; JSDoc tags/types inside /** */
        if (contexts.includes(CompletionContext.Comment)) {
            return [];
        }
        if (contexts.includes(CompletionContext.Jsdoc)) {
            return getJsdocCompletions(triggerCharacter);
        }

        // @ trigger character is only for JSDoc - suppress in other contexts
        if (triggerCharacter === "@") {
            return [];
        }

        // Add local completions from current file:
        // - localCompletion() returns variables (all local variable names)
        // - extractLocalSymbols() returns functions/macros defined in this file
        // No deduplication needed - getCompletions() excludes current file via excludeUri
        const localVars = localCompletion(text);
        const localFuncSymbols = extractLocalSymbols(text, uri)
            .filter(s => isCallableSymbol(s))
            .map(s => s.completion as Tp2CompletionItem);

        // items come from getCompletions() which returns Tp2CompletionItem[] (static + header symbols all have category)
        // localVars come from localCompletion() which returns Tp2CompletionItem[]
        // localFuncSymbols come from extractLocalSymbols() → header-parser (functions/macros in same file)
        const baseItems: Tp2CompletionItem[] = [...items as Tp2CompletionItem[], ...localVars, ...localFuncSymbols];
        const withParams = addParamCompletions(baseItems, contexts);
        const withSnippets = applySnippets(withParams, contexts, text, uri);

        return filterItemsByContext(withSnippets, contexts);
    },

    shouldProvideFeatures(text: string, position: Position): boolean {
        return !isInsideComment(text, position);
    },

    getHover(_uri: string, symbolName: string): Hover | null {
        // All symbols (static + header) are in the unified symbol storage
        if (symbols) {
            const symbol = symbols.lookup(symbolName);
            if (symbol?.hover) {
                return symbol.hover;
            }
        }
        return null;
    },

    hover(text: string, symbol: string, _uri: string, position: Position): Hover | null | undefined {
        // Function param hover takes priority
        const paramHover = getFunctionParamHover(text, symbol, position);
        if (paramHover) {
            return paramHover;
        }

        // Block fallthrough for variable-binding positions (param names, loop variables).
        // These define local variables and should not show unrelated indexed data.
        if (isInitialized()) {
            const tree = parseWithCache(text);
            if (tree) {
                const isParamName = isOnFunctionCallParamName(tree.rootNode, position);
                const isLoopVar = isOnLoopVariableBinding(tree.rootNode, position);
                if (isParamName || isLoopVar) {
                    return null;
                }
            }
        }

        // Variable hover from unified symbol storage (pre-computed)
        if (symbols) {
            const sym = symbols.lookup(symbol);
            if (sym?.hover) {
                return sym.hover;
            }
        }

        return undefined;  // Not handled, fall through to data-driven hover
    },

    getSymbolDefinition(symbolName: string): Location | null {
        // Static symbols have null locations (they're built-in).
        // Definition for user-defined symbols is handled by definition() via tree-sitter.
        return symbols?.lookupDefinition(symbolName) ?? null;
    },

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    },

    reloadFileData(uri: string, text: string): void {
        // Only update global indices for header files (.tph).
        // Non-header variables/functions are local to their file.
        if (isHeaderFile(uri)) {
            // Update unified symbol storage - ensures ALL provider methods see header symbols
            // This is the single source of truth for all LSP features
            if (symbols) {
                const parsedSymbols = parseHeaderToSymbols(uri, text, storedContext?.workspaceRoot);
                symbols.updateFile(uri, parsedSymbols);
            }
        }
    },

    onWatchedFileDeleted(uri: string): void {
        // Clear from unified index
        if (symbols) {
            symbols.clearFile(uri);
        }
    },

    onDocumentClosed(uri: string): void {
        // Clear local symbols cache for this document
        clearLocalSymbolsCache(uri);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU TP2 provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },

    format(text: string, uri: string): FormatResult {
        return formatWithValidation({
            text,
            uri,
            languageName: "TP2",
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

    rename(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        return renameSymbol(text, position, newName, uri);
    },

    prepareRename(text: string, position: Position): { range: { start: Position; end: Position }; placeholder: string } | null {
        return prepareRenameSymbol(text, position);
    },
};


/** JSDoc completion items. When triggered by @, insertText omits the @ prefix to avoid duplication. */
function getJsdocCompletions(triggerCharacter?: string): Tp2CompletionItem[] {
    const triggeredByAt = triggerCharacter === "@";
    const tags: Tp2CompletionItem[] = [
        { label: "@type", insertText: triggeredByAt ? "type" : "@type", filterText: triggeredByAt ? "type" : "@type", kind: CompletionItemKind.Keyword, detail: "Variable type", category: CompletionCategory.Jsdoc },
        { label: "@param", insertText: triggeredByAt ? "param" : "@param", filterText: triggeredByAt ? "param" : "@param", kind: CompletionItemKind.Keyword, detail: "Function parameter", category: CompletionCategory.Jsdoc },
        { label: "@return", insertText: triggeredByAt ? "return" : "@return", filterText: triggeredByAt ? "return" : "@return", kind: CompletionItemKind.Keyword, detail: "Return type", category: CompletionCategory.Jsdoc },
        { label: "@deprecated", insertText: triggeredByAt ? "deprecated" : "@deprecated", filterText: triggeredByAt ? "deprecated" : "@deprecated", kind: CompletionItemKind.Keyword, detail: "Mark as deprecated", category: CompletionCategory.Jsdoc },
    ];

    // Types matching KNOWN_TYPES from weidu.ts (ielib types)
    const types: Tp2CompletionItem[] = [
        { label: "array", kind: CompletionItemKind.TypeParameter, detail: "Array type", category: CompletionCategory.Jsdoc },
        { label: "bool", kind: CompletionItemKind.TypeParameter, detail: "Boolean type", category: CompletionCategory.Jsdoc },
        { label: "filename", kind: CompletionItemKind.TypeParameter, detail: "File name", category: CompletionCategory.Jsdoc },
        { label: "ids", kind: CompletionItemKind.TypeParameter, detail: "IDS reference", category: CompletionCategory.Jsdoc },
        { label: "int", kind: CompletionItemKind.TypeParameter, detail: "Integer type", category: CompletionCategory.Jsdoc },
        { label: "list", kind: CompletionItemKind.TypeParameter, detail: "List type", category: CompletionCategory.Jsdoc },
        { label: "map", kind: CompletionItemKind.TypeParameter, detail: "Map type", category: CompletionCategory.Jsdoc },
        { label: "resref", kind: CompletionItemKind.TypeParameter, detail: "Resource reference", category: CompletionCategory.Jsdoc },
        { label: "string", kind: CompletionItemKind.TypeParameter, detail: "String type", category: CompletionCategory.Jsdoc },
    ];

    return [...tags, ...types];
}
