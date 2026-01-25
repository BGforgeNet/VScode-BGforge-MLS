/**
 * WeiDU TP2 language provider.
 * Implements all TP2 file features in one place.
 */

import { CompletionItem, CompletionItemKind, DocumentSymbol, Hover, Location, Position, WorkspaceEdit, InsertTextFormat, MarkupKind } from "vscode-languageserver/node";
import { extname } from "path";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { EXT_WEIDU_TP2, LANG_WEIDU_TP2 } from "../core/languages";
import { Language, Features } from "../data-loader";
import { FormatResult, LanguageProvider, ProviderContext } from "../language-provider";
import { getFormatOptions } from "../shared/format-options";
import { createFullDocumentEdit, validateFormatting, stripCommentsWeidu } from "../shared/format-utils";
import { compile as weiduCompile } from "../weidu-compile";
import { getContextAtPosition, getFuncParamsContext } from "./completion/context";
import { filterItemsByContext } from "./completion/filter";
import { getParamCompletions } from "./completion/parameter";
import { formatDocument as formatAst } from "./format/core";
import { initParser, getParser, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { getDefinition, isOnFunctionCallParamName } from "./definition";
import { updateFileIndex, clearFileFromIndex, updateVariableIndex, clearVariableFromIndex, lookupFunction, lookupVariable } from "./header-parser";
import { renameSymbol, prepareRenameSymbol } from "./rename";
import { buildFunctionCallSnippet } from "./snippets";
import { getFunctionParamHover, getVariableHover } from "./hover";
import { localCompletion, isInsideComment, isOnLoopVariableBinding } from "./ast-utils";

const features: Features = {
    completion: true,
    definition: true,
    hover: true,
    udf: true,
    headers: true,
    externalHeaders: false,
    headerExtension: ".tph",
    parse: true,
    parseRequiresGame: false,
    signature: false,
    staticCompletion: true,
    staticHover: true,
    staticSignature: false,
};

/** Internal Language instance for data features */
let language: Language | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

export const weiduTp2Provider: LanguageProvider = {
    id: LANG_WEIDU_TP2,
    watchExtensions: [...EXT_WEIDU_TP2],

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize tree-sitter parser for formatting
        await initParser();

        // Initialize Language instance for data features
        language = new Language(LANG_WEIDU_TP2, features, context.workspaceRoot);
        await language.init();

        conlog("WeiDU TP2 provider initialized");
    },

    getCompletions(uri: string): CompletionItem[] {
        const staticCompletions = language?.completion(uri) ?? [];
        return staticCompletions;
    },

    filterCompletions(items: CompletionItem[], text: string, position: Position, uri: string, triggerCharacter?: string): CompletionItem[] {
        const filePath = fileURLToPath(uri);
        const ext = extname(filePath).toLowerCase();
        const contexts = getContextAtPosition(text, position.line, position.character, ext);

        conlog(`[tp2] Completion contexts: [${contexts.join(", ")}] at ${position.line}:${position.character} in ${ext}`);

        // No code completions inside comments; JSDoc tags/types inside /** */
        if (contexts.includes("comment")) {
            return [];
        }
        if (contexts.includes("jsdoc")) {
            return getJsdocCompletions(triggerCharacter);
        }

        // @ trigger character is only for JSDoc - suppress in other contexts
        if (triggerCharacter === "@") {
            return [];
        }

        // Add local variable completions
        const localVars = localCompletion(text);

        // Enrich local vars with JSDoc info from header index (but without file path)
        for (const item of localVars) {
            if (item.kind === CompletionItemKind.Variable) {
                const varInfo = lookupVariable(item.label as string);
                if (varInfo) {
                    const type = varInfo.jsdoc?.type ?? varInfo.inferredType;
                    const signature = varInfo.value ? `${type} ${item.label} = ${varInfo.value}` : `${type} ${item.label}`;
                    const langId = "weidu-tp2-tooltip";
                    const docParts = [`\`\`\`${langId}`, signature, "```"];
                    if (varInfo.jsdoc?.desc) {
                        docParts.push("", varInfo.jsdoc.desc);
                    }
                    item.documentation = { kind: MarkupKind.Markdown, value: docParts.join("\n") };
                }
            }
        }

        // Deduplicate: remove header items that match local var names
        // Header items have labelDetails.description (file path), local vars don't
        const localVarNames = new Set(localVars.filter(v => v.kind === CompletionItemKind.Variable).map(v => v.label));
        const dedupedItems = items.filter(item =>
            !(item.kind === CompletionItemKind.Variable && item.labelDetails?.description && localVarNames.has(item.label as string))
        );

        let allItems = [...dedupedItems, ...localVars];

        // Check if we're in funcParamName context and can provide parameter completions
        // Note: Parameter completions (like "count = ") are only shown when typing parameter names,
        // not when typing values after =
        if (contexts.includes("funcParamName")) {
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
        const inLafLpfContext = contexts.includes("lafName") || contexts.includes("lpfName");
        const inPatchContext = contexts.includes("patch");
        const inActionContext = contexts.includes("action");

        if (inLafLpfContext || inPatchContext || inActionContext) {
            allItems = allItems.map((item) => {
                const funcInfo = lookupFunction(item.label);
                if (funcInfo) {
                    // Determine prefix based on context
                    let prefix: string | undefined;
                    if (inPatchContext && !inLafLpfContext) {
                        prefix = "LPF";
                    } else if (inActionContext && !inLafLpfContext) {
                        prefix = "LAF";
                    }
                    // inLafLpfContext means no prefix (user already typed it)

                    const snippet = buildFunctionCallSnippet(funcInfo, prefix);
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

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
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
            const tree = getParser().parse(text);
            if (tree) {
                const isParamName = isOnFunctionCallParamName(tree.rootNode, position);
                const isLoopVar = isOnLoopVariableBinding(tree.rootNode, position);
                if (isParamName || isLoopVar) {
                    return null;
                }
            }
        }

        // Variable hover for reference positions
        const varHover = getVariableHover(symbol);
        if (varHover) {
            return varHover;
        }

        return undefined;  // Not handled, fall through to data-driven hover
    },

    getSymbolDefinition(symbol: string): Location | null {
        return language?.definition(symbol) ?? null;
    },

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    },

    reloadFileData(uri: string, text: string): void {
        language?.reloadFileData(uri, text);
        // Only update global indices for header files (.tph).
        // Non-header variables/functions are local to their file.
        const filePath = fileURLToPath(uri);
        if (extname(filePath).toLowerCase() === ".tph") {
            updateFileIndex(uri, text);
            updateVariableIndex(uri, text);
        }
    },

    onWatchedFileDeleted(uri: string): void {
        language?.clearFileData(uri);
        clearFileFromIndex(uri);
        clearVariableFromIndex(uri);
    },

    onDocumentClosed(uri: string): void {
        language?.clearSelfData(uri);
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

        const tree = getParser().parse(text);
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
function getJsdocCompletions(triggerCharacter?: string): CompletionItem[] {
    const triggeredByAt = triggerCharacter === "@";
    const tags: CompletionItem[] = [
        { label: "@type", insertText: triggeredByAt ? "type" : "@type", filterText: triggeredByAt ? "type" : "@type", kind: CompletionItemKind.Keyword, detail: "Variable type" },
        { label: "@param", insertText: triggeredByAt ? "param" : "@param", filterText: triggeredByAt ? "param" : "@param", kind: CompletionItemKind.Keyword, detail: "Function parameter" },
        { label: "@return", insertText: triggeredByAt ? "return" : "@return", filterText: triggeredByAt ? "return" : "@return", kind: CompletionItemKind.Keyword, detail: "Return type" },
        { label: "@deprecated", insertText: triggeredByAt ? "deprecated" : "@deprecated", filterText: triggeredByAt ? "deprecated" : "@deprecated", kind: CompletionItemKind.Keyword, detail: "Mark as deprecated" },
    ];

    // Types matching KNOWN_TYPES from weidu.ts (ielib types)
    const types: CompletionItem[] = [
        { label: "array", kind: CompletionItemKind.TypeParameter, detail: "Array type" },
        { label: "bool", kind: CompletionItemKind.TypeParameter, detail: "Boolean type" },
        { label: "filename", kind: CompletionItemKind.TypeParameter, detail: "File name" },
        { label: "ids", kind: CompletionItemKind.TypeParameter, detail: "IDS reference" },
        { label: "int", kind: CompletionItemKind.TypeParameter, detail: "Integer type" },
        { label: "list", kind: CompletionItemKind.TypeParameter, detail: "List type" },
        { label: "map", kind: CompletionItemKind.TypeParameter, detail: "Map type" },
        { label: "resref", kind: CompletionItemKind.TypeParameter, detail: "Resource reference" },
        { label: "string", kind: CompletionItemKind.TypeParameter, detail: "String type" },
    ];

    return [...tags, ...types];
}










