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
import { createFullDocumentEdit, validateFormatting, stripCommentsWeidu } from "../shared/format-utils";
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

    /**
     * Resolve a single symbol by name.
     * This is the UNIFIED entry point - handles local + indexed merge internally.
     *
     * Resolution order:
     * 1. Local symbols (fresh buffer) - always checked first
     * 2. Indexed symbols (headers + static), EXCLUDING current file
     *
     * This prevents stale index data from overriding fresh buffer content.
     */
    resolveSymbol(name: string, text: string, uri: string): IndexedSymbol | undefined {
        // 1. Check local symbols first (fresh buffer takes priority)
        const local = lookupLocalSymbol(name, text, uri);
        if (local) {
            return local;
        }

        // 2. Fall back to indexed symbols, excluding current file
        // This prevents returning stale data if the file is indexed but modified
        if (symbols) {
            const indexed = symbols.lookup(name);
            // Only return if it's NOT from the current file
            if (indexed && indexed.source.uri !== uri) {
                return indexed;
            }
            // Also return static symbols (uri is null)
            if (indexed && indexed.source.uri === null) {
                return indexed;
            }
        }

        return undefined;
    },

    /**
     * Get all visible symbols for completion.
     * Merges local + indexed, with local taking precedence.
     */
    getVisibleSymbols(text: string, uri: string): IndexedSymbol[] {
        // Get local symbols (fresh buffer)
        const localSymbols = extractLocalSymbols(text, uri);
        const localNames = new Set(localSymbols.map(s => s.name));

        // Get indexed symbols, excluding current file and duplicates
        const indexedSymbols = symbols
            ? symbols.query({ excludeUri: uri })
            : [];

        // Filter out indexed symbols that have local overrides
        const filteredIndexed = indexedSymbols.filter((s: IndexedSymbol) => !localNames.has(s.name));

        return [...localSymbols, ...filteredIndexed];
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

        // Add local variable completions (current file symbols)
        // No deduplication needed - getCompletions() excludes current file via excludeUri
        const localVars = localCompletion(text);

        // items come from getCompletions() which returns Tp2CompletionItem[] (static + header symbols all have category)
        // localVars come from localCompletion() which returns Tp2CompletionItem[]
        let allItems: Tp2CompletionItem[] = [...items as Tp2CompletionItem[], ...localVars];

        // Check if we're in funcParamName context and can provide parameter completions
        // Note: Parameter completions (like "count = ") are only shown when typing parameter names,
        // not when typing values after =
        if (contexts.includes(CompletionContext.FuncParamName)) {
            const funcContext = getFuncParamsContext();
            if (funcContext) {
                const paramCompletions = getParamCompletions(funcContext);
                if (paramCompletions.length > 0) {
                    // Add param completions to the list
                    allItems = [...allItems, ...paramCompletions];
                }
            }
        }

        // Apply snippets for function calls with required parameters
        // When context is lafName/lpfName, user already typed the prefix - don't add it again
        // When context is patch/action, user hasn't typed the prefix - include LPF/LAF in snippet
        const inLafLpfContext = contexts.includes(CompletionContext.LafName) || contexts.includes(CompletionContext.LpfName);
        const inPatchContext = contexts.includes(CompletionContext.Patch);
        const inActionContext = contexts.includes(CompletionContext.Action);

        if (inLafLpfContext || inPatchContext || inActionContext) {
            allItems = allItems.map((item) => {
                // CompletionItem.label is always a string (LSP spec)
                const funcName = item.label as string;
                const symbol = symbols?.lookup(funcName);
                if (symbol && isCallableSymbol(symbol)) {
                    // Determine prefix based on context
                    let prefix: string | undefined;
                    if (inPatchContext && !inLafLpfContext) {
                        prefix = "LPF";
                    } else if (inActionContext && !inLafLpfContext) {
                        prefix = "LAF";
                    }
                    // inLafLpfContext means no prefix (user already typed it)

                    const snippet = buildFunctionCallSnippet(symbol.callable, funcName, prefix);
                    if (snippet) {
                        return {
                            ...item,
                            insertText: snippet,
                            insertTextFormat: InsertTextFormat.Snippet,
                        };
                    }
                }
                // No snippet needed - ensure insertText is set to label if not present
                return {
                    ...item,
                    insertText: item.insertText ?? item.label,
                };
            });
        }

        return filterItemsByContext(allItems, contexts);
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
            conlog(`TP2 formatter error: ${msg}`);
            return { edits: [], warning: `TP2 formatter error: ${msg}` };
        }

        const validationError = validateFormatting(text, result.text, stripCommentsWeidu);
        if (validationError) {
            conlog(`TP2 formatter validation failed: ${validationError}`);
            return {
                edits: [],
                warning: `TP2 formatter validation failed: ${validationError}`,
            };
        }

        return { edits: createFullDocumentEdit(text, result.text) };
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
