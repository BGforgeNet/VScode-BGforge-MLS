/**
 * WeiDU TP2 language provider.
 * Implements all TP2 file features in one place.
 *
 * Uses unified Symbols storage for static completion and hover data.
 * User-defined functions and variables from .tph headers are handled by header-parser.
 */

import { type CompletionItem, CompletionItemKind, type DocumentSymbol, type FoldingRange, type Location, type Position, type SymbolInformation, type WorkspaceEdit, InsertTextFormat } from "vscode-languageserver/node";
import { extname } from "path";
import { fileURLToPath } from "url";
import { conlog, getLinePrefix } from "../common";
import { EXT_WEIDU_TP2, LANG_WEIDU_TP2 } from "../core/languages";
import { isHeaderFile } from "../core/location-utils";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, HoverResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { getFormatOptions } from "../shared/format-options";
import { stripCommentsWeidu } from "../shared/format-utils";
import { resolveSymbolWithLocal, formatWithValidation } from "../shared/provider-helpers";
import { compile as weiduCompile } from "../weidu-compile";
import { getContextAtPosition, getFuncParamsContext, isAtDeclarationSite } from "./completion/context";
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
import { buildFunctionCallSnippet, getKeywordSnippet } from "./snippets";
import { getFunctionParamHover } from "./hover";
import { localCompletion, isInsideComment, isOnLoopVariableBinding } from "./ast-utils";
import { getLocalSymbols as extractLocalSymbols, lookupLocalSymbol, clearLocalSymbolsCache } from "./local-symbols";
import { WEIDU_JSDOC_TYPES } from "../shared/weidu-types";
import { getJsdocCompletions as getSharedJsdocCompletions } from "../shared/jsdoc-completions";
import { getFoldingRanges } from "../shared/folding-ranges";
import { WorkspaceSymbolIndex } from "../shared/workspace-symbols";
import { SyntaxType } from "./tree-sitter.d";

/** TP2 block-level node types for code folding. */
const TP2_FOLDABLE_TYPES = new Set([
    SyntaxType.ActionDefineFunction,
    SyntaxType.ActionDefineMacro,
    SyntaxType.ActionDefinePatchFunction,
    SyntaxType.ActionDefinePatchMacro,
    SyntaxType.ActionIf,
    SyntaxType.ActionTry,
    SyntaxType.PatchBlock,
    SyntaxType.PatchFor,
    SyntaxType.PatchForEach,
    SyntaxType.PatchIf,
    SyntaxType.PatchWhile,
    SyntaxType.Component,
    SyntaxType.AlwaysBlock,
    SyntaxType.ActionCopy,
    SyntaxType.InnerAction,
    SyntaxType.InnerPatch,
    SyntaxType.InnerPatchFile,
    SyntaxType.InnerPatchSave,
]);

/**
 * Add parameter completions (INT_VAR, STR_VAR names) when in funcParamName context.
 * Returns the original items if not in funcParamName context or no params available.
 */
function addParamCompletions(items: Tp2CompletionItem[], contexts: CompletionContext[], symbolStore?: Symbols): Tp2CompletionItem[] {
    if (!contexts.includes(CompletionContext.FuncParamName)) {
        return items;
    }
    const funcContext = getFuncParamsContext();
    if (!funcContext) {
        return items;
    }
    const paramCompletions = getParamCompletions(funcContext, symbolStore);
    if (paramCompletions.length === 0) {
        return items;
    }
    return [...items, ...paramCompletions];
}

/**
 * Apply snippets for function/macro calls based on active contexts.
 * In name contexts (lafName/lpfName/lamName/lpmName), user already typed
 * the keyword -- snippet has no prefix, only required params + END.
 * In patch/action contexts, user hasn't typed the keyword -- snippet
 * includes LPF/LAF/LPM/LAM prefix + name + END.
 */
function applySnippets(
    items: Tp2CompletionItem[],
    contexts: CompletionContext[],
    text: string,
    uri: string,
    symbolStore: Symbols | undefined
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
        // Skip action/patch command keywords (LPF, LAF, COPY, etc.)
        const cat = item.category;
        if (cat === CompletionCategory.Action || cat === CompletionCategory.Patch) {
            const kwSnippet = getKeywordSnippet(item.label as string);
            if (kwSnippet) {
                return { ...item, insertText: kwSnippet, insertTextFormat: InsertTextFormat.Snippet };
            }
            return item;
        }

        const funcName = item.label as string;
        const symbol = symbolStore?.lookup(funcName) ?? lookupLocalSymbol(funcName, text, uri);
        if (!symbol || !isCallableSymbol(symbol)) {
            return item;
        }

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

/** Determine the keyword prefix for a function/macro snippet based on context. */
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

/**
 * Collect local variable/symbol completions from both file-scope and deep-scope sources.
 * Deduplicates by name (first occurrence wins, preserving rich hover from file-scope).
 *
 * @param variablesOnly When true, only include Variable-kind items from file-scope symbols
 *   (excludes functions/macros). Deep-scope items are always variables.
 * @param excludeWord Word to exclude from results (prevents self-referencing completion
 *   when tree-sitter parses an incomplete declaration).
 */
function collectLocalCompletions(
    text: string,
    uri: string,
    options?: { variablesOnly?: boolean; excludeWord?: string }
): Tp2CompletionItem[] {
    const { variablesOnly = false, excludeWord } = options ?? {};
    const seen = new Set<string>();
    const result: Tp2CompletionItem[] = [];

    for (const s of extractLocalSymbols(text, uri)) {
        if (seen.has(s.name)) continue;
        if (excludeWord && s.name === excludeWord) continue;
        if (variablesOnly && s.completion.kind !== CompletionItemKind.Variable) continue;
        seen.add(s.name);
        result.push(s.completion);
    }

    // Deep-scoped variables (inside function bodies, loops) not covered by file-scope
    for (const v of localCompletion(text)) {
        const label = v.label as string;
        if (seen.has(label)) continue;
        if (excludeWord && label === excludeWord) continue;
        seen.add(label);
        result.push(v);
    }

    return result;
}

/** JSDoc completion items with TP2 category metadata. */
function getJsdocCompletions(linePrefix: string): Tp2CompletionItem[] {
    return getSharedJsdocCompletions(WEIDU_JSDOC_TYPES, linePrefix)
        .map((item) => ({ ...item, category: CompletionCategory.Jsdoc }));
}

class WeiduTp2Provider implements LanguageProvider {
    readonly id = LANG_WEIDU_TP2;
    readonly watchExtensions = [...EXT_WEIDU_TP2];

    private symbolStore: Symbols | undefined;
    private storedContext: ProviderContext | undefined;
    private wsSymbolIndex: WorkspaceSymbolIndex | undefined;

    async init(context: ProviderContext): Promise<void> {
        this.storedContext = context;

        await initParser();

        this.symbolStore = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_TP2);
        this.symbolStore.loadStatic(staticSymbols);

        this.wsSymbolIndex = new WorkspaceSymbolIndex();

        conlog(`WeiDU TP2 provider initialized with ${staticSymbols.length} static symbols`);
    }

    resolveSymbol(name: string, text: string, uri: string): IndexedSymbol | undefined {
        return resolveSymbolWithLocal(name, text, uri, this.symbolStore, lookupLocalSymbol);
    }

    getCompletions(uri: string): CompletionItem[] {
        if (!this.symbolStore) {
            return [];
        }
        const allSymbols = this.symbolStore.query({ excludeUri: uri });
        return allSymbols.map((s: IndexedSymbol) => s.completion);
    }

    filterCompletions(items: CompletionItem[], text: string, position: Position, uri: string, triggerCharacter?: string): CompletionItem[] {
        const filePath = fileURLToPath(uri);
        const ext = extname(filePath).toLowerCase();
        const contexts = getContextAtPosition(text, position.line, position.character, ext);

        conlog(`[tp2] Completion contexts: [${contexts.join(", ")}] at ${position.line}:${position.character} in ${ext}`);

        if (contexts.includes(CompletionContext.Comment)) {
            return [];
        }
        if (contexts.includes(CompletionContext.Jsdoc)) {
            return getJsdocCompletions(getLinePrefix(text, position));
        }

        if (triggerCharacter === "@") {
            return [];
        }

        // At declaration sites, the user is naming a new symbol.
        // "definition" (function/macro/array/loop): suppress all completions.
        // "assignment" (SET/SPRINT): show only local variable completions
        // (user may be reassigning an existing variable).
        // TODO: Filter by DeclarationKind - show only integer vars after SET, string vars after SPRINT.
        const declSite = isAtDeclarationSite(text, position);
        if (declSite === "definition") {
            return [];
        }
        if (declSite === "assignment") {
            // Exclude the word currently being typed to prevent self-referencing
            // completion (e.g. typing `SET fo` would otherwise offer `fo` because
            // tree-sitter parses the incomplete declaration and extracts the partial name).
            const currentWord = getLinePrefix(text, position).match(/(\S+)$/)?.[1] ?? "";
            return collectLocalCompletions(text, uri, { variablesOnly: true, excludeWord: currentWord });
        }

        const localCompletions = collectLocalCompletions(text, uri);

        const baseItems: Tp2CompletionItem[] = [...items, ...localCompletions];
        const withParams = addParamCompletions(baseItems, contexts, this.symbolStore);
        const withSnippets = applySnippets(withParams, contexts, text, uri, this.symbolStore);

        return filterItemsByContext(withSnippets, contexts);
    }

    shouldProvideFeatures(text: string, position: Position): boolean {
        return !isInsideComment(text, position);
    }

    hover(text: string, symbol: string, _uri: string, position: Position): HoverResult {
        const paramHover = getFunctionParamHover(text, symbol, position, this.symbolStore);
        if (paramHover) {
            return HoverResult.found(paramHover);
        }

        if (isInitialized()) {
            const tree = parseWithCache(text);
            if (tree) {
                const isParamName = isOnFunctionCallParamName(tree.rootNode, position);
                const isLoopVar = isOnLoopVariableBinding(tree.rootNode, position);
                if (isParamName || isLoopVar) {
                    return HoverResult.empty();
                }
            }
        }

        // Regular symbol hover is handled by resolveSymbol() via the registry.
        // No need to duplicate the lookup here.
        return HoverResult.notHandled();
    }

    getSymbolDefinition(symbolName: string): Location | null {
        return this.symbolStore?.lookupDefinition(symbolName) ?? null;
    }

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position, this.symbolStore);
    }

    reloadFileData(uri: string, text: string): void {
        if (isHeaderFile(uri)) {
            if (this.symbolStore) {
                const parsedSymbols = parseHeaderToSymbols(uri, text, this.storedContext?.workspaceRoot);
                this.symbolStore.updateFile(uri, parsedSymbols);
            }
        }

        // Update workspace symbol index for all files
        if (this.wsSymbolIndex && isInitialized()) {
            this.wsSymbolIndex.updateFile(uri, getDocumentSymbols(text));
        }
    }

    onWatchedFileDeleted(uri: string): void {
        if (this.symbolStore) {
            this.symbolStore.clearFile(uri);
        }
        this.wsSymbolIndex?.removeFile(uri);
    }

    workspaceSymbols(query: string): SymbolInformation[] {
        return this.wsSymbolIndex?.search(query) ?? [];
    }

    onDocumentClosed(uri: string): void {
        clearLocalSymbolsCache(uri);
    }

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!this.storedContext) {
            conlog("WeiDU TP2 provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, this.storedContext.settings.weidu, interactive, text);
    }

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
    }

    symbols(text: string): DocumentSymbol[] {
        return getDocumentSymbols(text);
    }

    foldingRanges(text: string): FoldingRange[] {
        if (!isInitialized()) {
            return [];
        }
        const tree = parseWithCache(text);
        if (!tree) {
            return [];
        }
        return getFoldingRanges(tree.rootNode, TP2_FOLDABLE_TYPES);
    }

    rename(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        return renameSymbol(text, position, newName, uri);
    }

    prepareRename(text: string, position: Position): { range: { start: Position; end: Position }; placeholder: string } | null {
        return prepareRenameSymbol(text, position);
    }
}

export const weiduTp2Provider: LanguageProvider = new WeiduTp2Provider();
