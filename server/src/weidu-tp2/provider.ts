/**
 * WeiDU TP2 language provider.
 * Implements all TP2 file features in one place.
 */

import { CompletionItem, CompletionItemKind, DocumentSymbol, Hover, Location, Position, WorkspaceEdit } from "vscode-languageserver/node";
import { extname } from "path";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { EXT_WEIDU_TP2, LANG_WEIDU_TP2 } from "../core/languages";
import { Language, Features } from "../data-loader";
import { FormatResult, LanguageProvider, ProviderContext } from "../language-provider";
import { getEditorconfigSettings } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { compile as weiduCompile } from "../weidu";
import { getContextAtPosition, filterItemsByContext } from "./completion-context";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { getDefinition } from "./definition";
import { updateFileIndex, clearFileFromIndex, updateVariableIndex, clearVariableFromIndex } from "./header-parser";
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

    filterCompletions(items: CompletionItem[], text: string, position: Position, uri: string): CompletionItem[] {
        const filePath = fileURLToPath(uri);
        const ext = extname(filePath).toLowerCase();
        const contexts = getContextAtPosition(text, position.line, position.character, ext);

        conlog(`[tp2] Completion contexts: [${contexts.join(", ")}] at ${position.line}:${position.character} in ${ext}`);

        // Add local variable completions
        const localVars = localCompletion(text);
        const allItems = [...items, ...localVars];

        return filterItemsByContext(allItems, contexts);
    },

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
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
        if (VARIABLE_DECL_TYPES.has(node.type as import("./tree-sitter.d").SyntaxType)) {
            // Extract variable name from various declaration types
            const varNode = node.childForFieldName("var");
            if (varNode) {
                variableNames.add(varNode.text);
            }

            // For READ_* patches that can have multiple vars
            const varNodes = node.childrenForFieldName("var");
            for (const vn of varNodes) {
                if (vn.type === "identifier") {
                    variableNames.add(vn.text);
                }
            }

            // For DEFINE_ARRAY etc., field is "name"
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                let exprNode = nameNode.child(0);
                if (exprNode && exprNode.type === "variable_ref") {
                    exprNode = exprNode.child(0);
                }
                if (exprNode && exprNode.type === "identifier") {
                    variableNames.add(exprNode.text);
                }
            }

            // For parameter declarations (INT_VAR, STR_VAR, RET, RET_ARRAY)
            const paramTypes = ["int_var_decl", "str_var_decl", "ret_decl", "ret_array_decl"];
            if (paramTypes.includes(node.type)) {
                for (const child of node.children) {
                    if (child.type === "identifier") {
                        variableNames.add(child.text);
                    }
                }
            }

            // For loop variables (key_var, value_var, var)
            const keyVarNode = node.childForFieldName("key_var");
            if (keyVarNode) {
                let identNode: import("web-tree-sitter").Node | null = keyVarNode;
                if (keyVarNode.type === "variable_ref") {
                    identNode = keyVarNode.child(0);
                }
                if (identNode && identNode.type === "identifier") {
                    variableNames.add(identNode.text);
                }
            }

            const valueVarNode = node.childForFieldName("value_var");
            if (valueVarNode) {
                let identNode: import("web-tree-sitter").Node | null = valueVarNode;
                if (valueVarNode.type === "variable_ref") {
                    identNode = valueVarNode.child(0);
                }
                if (identNode && identNode.type === "identifier") {
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

    // Convert to CompletionItem[]
    return Array.from(variableNames).map((name) => ({
        label: name,
        kind: CompletionItemKind.Variable,
    }));
}
