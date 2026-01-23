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
import { getEditorconfigSettings } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { buildParamInfoMap, type ParamDisplayInfo } from "../shared/jsdoc";
import { compile as weiduCompile } from "../weidu";
import { getContextAtPosition, getFuncParamsContext } from "./completion-context";
import { filterItemsByContext } from "./completion-filter";
import type { CompletionItemWithCategory } from "../shared/completion-context";
import type { FuncParamsContext } from "./completion-types";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { getDefinition } from "./definition";
import { updateFileIndex, clearFileFromIndex, updateVariableIndex, clearVariableFromIndex, lookupFunction, lookupVariable, FunctionInfo } from "./header-parser";
import { SyntaxType } from "./tree-sitter.d";
import { stripStringDelimiters, unwrapVariableRef } from "./tree-utils";
import { renameSymbol, prepareRenameSymbol } from "./rename";
import { VARIABLE_DECL_TYPES } from "./variable-symbols";

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

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
    },

    hover(text: string, symbol: string, _uri: string, position: Position): Hover | null {
        // Suppress hover inside comments
        if (isInsideComment(text, position)) {
            return null;
        }

        const paramHover = getFunctionParamHover(text, symbol, position);
        if (paramHover) return paramHover;

        return getVariableHover(symbol);
    },

    getSymbolDefinition(symbol: string): Location | null {
        return language?.definition(symbol) ?? null;
    },

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    },

    reloadFileData(uri: string, text: string): void {
        language?.reloadFileData(uri, text);
        // Update tree-sitter based function and variable indices
        updateFileIndex(uri, text);
        updateVariableIndex(uri, text);
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
        const result = formatAst(tree.rootNode, options);

        const validationError = validateFormatting(text, result.text);
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

const DEFAULT_INDENT = 4;
const DEFAULT_LINE_LIMIT = 120;

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const settings = getEditorconfigSettings(filePath);
        return {
            indentSize: settings.indentSize ?? DEFAULT_INDENT,
            lineLimit: settings.maxLineLength ?? DEFAULT_LINE_LIMIT,
        };
    } catch {
        return { indentSize: DEFAULT_INDENT, lineLimit: DEFAULT_LINE_LIMIT };
    }
}

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

/**
 * Extract all local variables from the current file for completion.
 * Parses the file with tree-sitter and collects all variable names from VARIABLE_DECL_TYPES nodes.
 */
function localCompletion(text: string): CompletionItem[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return [];
    }

    const variableNames = new Set<string>();

    function visit(node: import("web-tree-sitter").Node): void {
        // Check if this node declares a variable
        if (VARIABLE_DECL_TYPES.has(node.type as SyntaxType)) {
            // Extract variable name from various declaration types
            const varNode = node.childForFieldName("var");
            if (varNode) {
                variableNames.add(varNode.text);
            }

            // For READ_* patches that can have multiple vars
            const varNodes = node.childrenForFieldName("var");
            for (const vn of varNodes) {
                if (vn.type === SyntaxType.Identifier) {
                    variableNames.add(vn.text);
                }
            }

            // For DEFINE_ARRAY etc., field is "name"
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const exprNode = nameNode.child(0);
                if (exprNode) {
                    const identNode = unwrapVariableRef(exprNode);
                    if (identNode.type === SyntaxType.Identifier) {
                        variableNames.add(identNode.text);
                    }
                }
            }

            // For parameter declarations (INT_VAR, STR_VAR, RET, RET_ARRAY)
            const paramDeclTypes: ReadonlySet<SyntaxType> = new Set([
                SyntaxType.IntVarDecl,
                SyntaxType.StrVarDecl,
                SyntaxType.RetDecl,
                SyntaxType.RetArrayDecl,
            ]);
            if (paramDeclTypes.has(node.type as SyntaxType)) {
                for (const child of node.children) {
                    if (child.type === SyntaxType.Identifier) {
                        variableNames.add(child.text);
                    }
                }
            }

            // For loop variables (key_var, value_var)
            for (const fieldNode of [node.childForFieldName("key_var"), node.childForFieldName("value_var")]) {
                if (!fieldNode) continue;
                const identNode = unwrapVariableRef(fieldNode);
                if (identNode.type === SyntaxType.Identifier) {
                    variableNames.add(identNode.text);
                }
            }
        }

        // Recurse to children
        for (const child of node.children) {
            visit(child);
        }
    }

    visit(tree.rootNode);

    // Convert to CompletionItem[] with "vars" category for filtering
    return Array.from(variableNames).map((name): CompletionItemWithCategory => ({
        label: name,
        kind: CompletionItemKind.Variable,
        category: "vars",
    }));
}

/**
 * Generate parameter completions for a function call.
 * Looks up the function definition and returns completions for unused parameters.
 */
function getParamCompletions(context: FuncParamsContext): CompletionItem[] {
    const { functionName, paramSection, usedParams } = context;

    // Look up function definition
    const funcInfo = lookupFunction(functionName);
    if (!funcInfo || !funcInfo.params) {
        // Function not found or has no params (it's a macro)
        return [];
    }

    const usedSet = new Set(usedParams);
    const completions: CompletionItem[] = [];
    const paramInfoMap = buildParamInfoMap(funcInfo.jsdoc);

    // Get the appropriate param list based on section
    switch (paramSection) {
        case "INT_VAR": {
            const params = funcInfo.params.intVar;
            for (const param of params) {
                if (!usedSet.has(param.name)) {
                    completions.push(createParamCompletion(param.name, "int", param.defaultValue, paramInfoMap.get(param.name)));
                }
            }
            break;
        }
        case "STR_VAR": {
            const params = funcInfo.params.strVar;
            for (const param of params) {
                if (!usedSet.has(param.name)) {
                    completions.push(createParamCompletion(param.name, "string", param.defaultValue, paramInfoMap.get(param.name)));
                }
            }
            break;
        }
        case "RET": {
            const params = funcInfo.params.ret;
            for (const param of params) {
                if (!usedSet.has(param)) {
                    completions.push(createParamCompletion(param, "any", undefined, paramInfoMap.get(param)));
                }
            }
            break;
        }
        case "RET_ARRAY": {
            const params = funcInfo.params.retArray;
            for (const param of params) {
                if (!usedSet.has(param)) {
                    completions.push(createParamCompletion(param, "array", undefined, paramInfoMap.get(param)));
                }
            }
            break;
        }
    }

    return completions;
}

/**
 * Create a parameter completion item with documentation.
 * Format: "type name = default" for optional params, "type name" for required.
 */
function createParamCompletion(name: string, type: string, defaultValue?: string, info?: ParamDisplayInfo): CompletionItem {
    // Build signature line - hide default value for required params
    const showDefault = defaultValue && !info?.required;
    const signature = showDefault ? `${type} ${name} = ${defaultValue}` : `${type} ${name}`;

    // Build markdown documentation
    const langId = "weidu-tp2-tooltip";
    const docParts = [`\`\`\`${langId}`, signature, "```"];

    if (info?.description) {
        docParts.push("", info.description);
    }

    const item: CompletionItem = {
        label: name,
        kind: CompletionItemKind.Field,
        insertText: `${name} = `,
        insertTextFormat: InsertTextFormat.PlainText,
        documentation: {
            kind: MarkupKind.Markdown,
            value: docParts.join("\n"),
        },
    };

    return item;
}

/**
 * Build a snippet for function call with required parameters.
 * Returns null if no required params exist.
 * Exported for testing.
 *
 * @param funcInfo - Function information from header
 * @param prefix - Optional prefix to add before function name (e.g., "LAF" or "LPF")
 */
export function buildFunctionCallSnippet(funcInfo: FunctionInfo, prefix?: string): string | null {
    if (!funcInfo.params) {
        return null;
    }

    const paramInfoMap = buildParamInfoMap(funcInfo.jsdoc);
    const requiredIntParams: string[] = [];
    const requiredStrParams: string[] = [];

    // Collect required INT_VAR params
    for (const param of funcInfo.params.intVar) {
        const info = paramInfoMap.get(param.name);
        if (info?.required) {
            requiredIntParams.push(param.name);
        }
    }

    // Collect required STR_VAR params
    for (const param of funcInfo.params.strVar) {
        const info = paramInfoMap.get(param.name);
        if (info?.required) {
            requiredStrParams.push(param.name);
        }
    }

    // If no required params, return null
    if (requiredIntParams.length === 0 && requiredStrParams.length === 0) {
        return null;
    }

    // Build snippet with tab stops
    const firstLine = prefix ? `${prefix} ${funcInfo.name}` : funcInfo.name;
    const lines: string[] = [firstLine];
    let tabStop = 1;

    // Add INT_VAR block if there are required int params
    if (requiredIntParams.length > 0) {
        lines.push("    INT_VAR");
        for (const paramName of requiredIntParams) {
            lines.push(`        ${paramName} = $${tabStop}`);
            tabStop++;
        }
    }

    // Add STR_VAR block if there are required str params
    if (requiredStrParams.length > 0) {
        lines.push("    STR_VAR");
        for (const paramName of requiredStrParams) {
            lines.push(`        ${paramName} = $${tabStop}`);
            tabStop++;
        }
    }

    // Add END with final tab stop
    lines.push("END$0");

    return lines.join("\n");
}

/**
 * Get hover info for a function parameter in a function call.
 * Parses text to find function calls and checks if symbol is a parameter name.
 */
function getFunctionParamHover(text: string, symbol: string, position: Position): Hover | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return null;
    }

    // Find function calls and check if symbol is a parameter name
    const result = findParamInFunctionCalls(tree.rootNode, symbol, position);
    if (!result) {
        return null;
    }

    const { paramType, defaultValue, description, required } = result;

    // Build hover content - hide default value for required params
    const showDefault = defaultValue && !required;
    const signature = showDefault ? `${paramType} ${symbol} = ${defaultValue}` : `${paramType} ${symbol}`;

    // Build markdown documentation
    const langId = "weidu-tp2-tooltip";
    const docParts = [`\`\`\`${langId}`, signature, "```"];

    if (description) {
        docParts.push("", description);
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: docParts.join("\n"),
        },
    };
}

/**
 * Find a parameter in function calls within the AST.
 * Returns param info if found, null otherwise.
 * Only returns a match if the position is within the function call node's range.
 */
function findParamInFunctionCalls(
    node: import("web-tree-sitter").Node,
    symbol: string,
    position: Position
): { paramType: string; defaultValue?: string; description?: string; required?: boolean } | null {
    const type = node.type;

    // Check if this is a function call (LAF or LPF)
    if (type === SyntaxType.ActionLaunchFunction || type === SyntaxType.PatchLaunchFunction) {
        // Check if the cursor position is within this function call node's range
        const startPos = node.startPosition;
        const endPos = node.endPosition;

        const isWithinRange =
            position.line >= startPos.row &&
            position.line <= endPos.row &&
            (position.line > startPos.row || position.character >= startPos.column) &&
            (position.line < endPos.row || position.character <= endPos.column);

        if (isWithinRange) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const funcName = stripStringDelimiters(nameNode.text);
                const funcInfo = lookupFunction(funcName);

                if (funcInfo?.params) {
                    // Check each parameter section for the symbol
                    const result = findParamInFuncInfo(funcInfo, symbol);
                    if (result) {
                        return result;
                    }
                }
            }
        }
    }

    // Recurse to children
    for (const child of node.children) {
        const result = findParamInFunctionCalls(child, symbol, position);
        if (result) {
            return result;
        }
    }

    return null;
}

/**
 * Find a parameter by name in function info.
 * Returns type and default value if found.
 */
function findParamInFuncInfo(
    funcInfo: FunctionInfo,
    symbol: string
): { paramType: string; defaultValue?: string; description?: string; required?: boolean } | null {
    if (!funcInfo.params) {
        return null;
    }

    const paramInfoMap = buildParamInfoMap(funcInfo.jsdoc);
    const info = paramInfoMap.get(symbol);

    // Check INT_VAR
    for (const param of funcInfo.params.intVar) {
        if (param.name === symbol) {
            return { paramType: "int", defaultValue: param.defaultValue, description: info?.description, required: info?.required };
        }
    }

    // Check STR_VAR
    for (const param of funcInfo.params.strVar) {
        if (param.name === symbol) {
            return { paramType: "string", defaultValue: param.defaultValue, description: info?.description, required: info?.required };
        }
    }

    // Check RET
    for (const param of funcInfo.params.ret) {
        if (param === symbol) {
            return { paramType: "any", description: info?.description, required: info?.required };
        }
    }

    // Check RET_ARRAY
    for (const param of funcInfo.params.retArray) {
        if (param === symbol) {
            return { paramType: "array", description: info?.description, required: info?.required };
        }
    }

    return null;
}

/**
 * Check if the given position is inside a comment node using tree-sitter.
 */
function isInsideComment(text: string, position: Position): boolean {
    if (!isInitialized()) {
        return false;
    }
    const tree = getParser().parse(text);
    if (!tree) {
        return false;
    }
    const node = tree.rootNode.descendantForPosition({ row: position.line, column: position.character });
    return node !== null && (node.type === SyntaxType.Comment || node.type === SyntaxType.LineComment);
}

/**
 * Get hover info for a variable from the variable index.
 * Shows type, value, and JSDoc description if available.
 */
function getVariableHover(symbol: string): Hover | null {
    const varInfo = lookupVariable(symbol);
    if (!varInfo) {
        return null;
    }

    // Use JSDoc @type if available, otherwise inferred type
    const type = varInfo.jsdoc?.type ?? varInfo.inferredType;
    const signature = varInfo.value ? `${type} ${symbol} = ${varInfo.value}` : `${type} ${symbol}`;

    const langId = "weidu-tp2-tooltip";
    const docParts = [`\`\`\`${langId}`, signature, "```"];

    if (varInfo.jsdoc?.desc) {
        docParts.push("", varInfo.jsdoc.desc);
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: docParts.join("\n"),
        },
    };
}
