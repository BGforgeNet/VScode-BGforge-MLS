/**
 * Fallout SSL language provider.
 * Implements all Fallout SSL file features in one place.
 *
 * Internally delegates data features (completion, hover, signature, definition)
 * to a Language instance for now. This allows incremental migration while
 * providing a unified provider interface.
 */

import { CompletionItem, Hover, Location, SignatureHelp, TextEdit } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_FALLOUT_SSL } from "../core/languages";
import { compile as falloutCompile } from "./fallout";
import { Language, Features } from "../data-loader";
import { LanguageProvider, ProviderContext } from "../language-provider";
import * as signature from "../shared/signature";
import { formatDocument, initFormatter } from "./format";
import { isInitialized } from "./parser";

const features: Features = {
    completion: true,
    definition: true,
    hover: true,
    udf: true,
    headers: true,
    externalHeaders: true,
    parse: true,
    parseRequiresGame: false,
    signature: true,
    staticCompletion: true,
    staticHover: true,
    staticSignature: true,
};

/** Internal Language instance for data features */
let language: Language | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

export const falloutSslProvider: LanguageProvider = {
    id: LANG_FALLOUT_SSL,

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize formatter (tree-sitter parser)
        await initFormatter();

        // Initialize Language instance for data features
        const extHeadersDir = context.settings.falloutSSL.headersDirectory;
        language = new Language(LANG_FALLOUT_SSL, features, context.workspaceRoot, extHeadersDir);
        await language.init();

        conlog("Fallout SSL provider initialized");
    },

    format(text: string, uri: string): TextEdit[] {
        if (!isInitialized()) {
            return [];
        }
        return formatDocument(text, uri);
    },

    getCompletions(uri: string): CompletionItem[] {
        return language?.completion(uri) ?? [];
    },

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
    },

    getSignature(uri: string, symbol: string, paramIndex: number): SignatureHelp | null {
        if (!language) return null;
        const request: signature.Request = { symbol, parameter: paramIndex };
        return language.signature(uri, request) ?? null;
    },

    getSymbolDefinition(symbol: string): Location | null {
        return language?.definition(symbol) ?? null;
    },

    reloadFileData(uri: string, text: string): void {
        language?.reloadFileData(uri, text);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("Fallout SSL provider not initialized, cannot compile");
            return;
        }
        await falloutCompile(uri, storedContext.settings.falloutSSL, interactive, text);
    },
};
