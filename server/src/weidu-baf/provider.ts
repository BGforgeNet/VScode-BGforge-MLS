/**
 * WeiDU BAF language provider.
 * Implements all BAF file features in one place.
 *
 * Internally delegates data features (completion, hover) to a Language instance.
 */

import { CompletionItem, Hover } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_BAF } from "../core/languages";
import { Language, Features } from "../data-loader";
import { FormatResult, LanguageProvider, ProviderContext } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { fileURLToPath } from "url";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";
import { compile as weiduCompile } from "../weidu";

const DEFAULT_INDENT = 4;

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
        return { indentSize: indentSize ?? DEFAULT_INDENT };
    } catch {
        return { indentSize: DEFAULT_INDENT };
    }
}

export const weiduBafProvider: LanguageProvider = {
    id: LANG_WEIDU_BAF,

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize formatter (tree-sitter parser)
        await initParser();

        // Initialize Language instance for data features
        language = new Language(LANG_WEIDU_BAF, features, context.workspaceRoot);
        await language.init();

        conlog("WeiDU BAF provider initialized");
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
            conlog(`BAF formatter validation failed: ${validationError}`);
            return {
                edits: [],
                warning: `BAF formatter validation failed: ${validationError}`,
            };
        }

        return { edits: createFullDocumentEdit(text, result.text) };
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
            conlog("WeiDU BAF provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },
};
