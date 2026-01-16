/**
 * WeiDU TP2 language provider.
 * Implements all TP2 file features in one place.
 */

import { CompletionItem, Hover, Location, TextEdit } from "vscode-languageserver/node";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { LANG_WEIDU_TP2 } from "../core/languages";
import { Language, Features } from "../data-loader";
import { LanguageProvider, ProviderContext } from "../language-provider";
import { getEditorconfigSettings } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { compile as weiduCompile } from "../weidu";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";

const features: Features = {
    completion: true,
    definition: true,
    hover: true,
    udf: true,
    headers: true,
    externalHeaders: false,
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
        return language?.completion(uri) ?? [];
    },

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
    },

    getSymbolDefinition(symbol: string): Location | null {
        return language?.definition(symbol) ?? null;
    },

    reloadFileData(uri: string, text: string): void {
        language?.reloadFileData(uri, text);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU TP2 provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },

    format(text: string, uri: string): TextEdit[] {
        if (!isInitialized()) {
            return [];
        }

        const tree = getParser().parse(text);
        if (!tree) {
            return [];
        }

        const options = getFormatOptions(uri);
        const result = formatAst(tree.rootNode, options);

        const validationError = validateFormatting(text, result.text);
        if (validationError) {
            conlog(`TP2 formatter validation failed: ${validationError}`);
            return [];
        }

        return createFullDocumentEdit(text, result.text);
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
