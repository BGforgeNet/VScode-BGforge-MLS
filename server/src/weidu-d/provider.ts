/**
 * WeiDU D language provider.
 * Implements all D file features in one place.
 *
 * Internally delegates data features (completion, hover) to a Language instance.
 */

import { CompletionItem, DocumentSymbol, Hover, Location, Position } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_D } from "../core/languages";
import { Language, Features } from "../data-loader";
import { FormatResult, LanguageProvider, ProviderContext } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { fileURLToPath } from "url";
import { getDefinition } from "./definition";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { compile as weiduCompile } from "../weidu";

const DEFAULT_INDENT = 4;

const DEFAULT_LINE_LIMIT = 120;

const features: Features = {
    completion: true,
    definition: false,
    hover: true,
    udf: false,
    headers: false,
    externalHeaders: false,
    parse: true,
    parseRequiresGame: true,
    signature: false,
    staticCompletion: true,
    staticHover: true,
    staticSignature: false,
};

/** Internal Language instance for data features */
let language: Language | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? DEFAULT_INDENT, lineLimit: DEFAULT_LINE_LIMIT };
    } catch {
        return { indentSize: DEFAULT_INDENT, lineLimit: DEFAULT_LINE_LIMIT };
    }
}

export const weiduDProvider: LanguageProvider = {
    id: LANG_WEIDU_D,

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize formatter (tree-sitter parser)
        await initParser();

        // Initialize Language instance for data features
        language = new Language(LANG_WEIDU_D, features, context.workspaceRoot);
        await language.init();

        conlog("WeiDU D provider initialized");
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
            conlog(`D formatter validation failed: ${validationError}`);
            return {
                edits: [],
                warning: `D formatter validation failed: ${validationError}`,
            };
        }

        return { edits: createFullDocumentEdit(text, result.text) };
    },

    symbols(text: string): DocumentSymbol[] {
        return getDocumentSymbols(text);
    },

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    },

    getCompletions(uri: string): CompletionItem[] {
        return language?.completion(uri) ?? [];
    },

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
    },

    reloadFileData(uri: string, text: string): void {
        language?.reloadFileData(uri, text);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU D provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },
};
