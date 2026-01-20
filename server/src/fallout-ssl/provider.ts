/**
 * Fallout SSL language provider.
 * Implements all Fallout SSL file features in one place.
 *
 * Internally delegates data features (completion, hover, signature, definition)
 * to a Language instance for now. This allows incremental migration while
 * providing a unified provider interface.
 */

import { CompletionItem, DocumentSymbol, Hover, Location, Position, SignatureHelp, WorkspaceEdit } from "vscode-languageserver/node";
import { conlog } from "../common";
import { EXT_FALLOUT_SSL_HEADERS, LANG_FALLOUT_SSL } from "../core/languages";
import { compile as falloutCompile } from "./compiler";
import { Language, Features } from "../data-loader";
import { FormatResult, LanguageProvider, ProviderContext } from "../language-provider";
import * as signature from "../shared/signature";
import { formatDocument, initFormatter } from "./format";
import { isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbols";
import { getLocalDefinition } from "./definition";
import { getLocalHover } from "./hover";
import { renameSymbol } from "./rename";
import { getLocalCompletions } from "./completion";
import { getLocalSignature } from "./signature";

const features: Features = {
    completion: true,
    definition: true,
    hover: true,
    udf: true,
    headers: true,
    externalHeaders: true,
    headerExtension: ".h",
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
    watchExtensions: [...EXT_FALLOUT_SSL_HEADERS],

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

    format(text: string, uri: string): FormatResult {
        if (!isInitialized()) {
            return { edits: [] };
        }
        return formatDocument(text, uri);
    },

    symbols(text: string): DocumentSymbol[] {
        if (!isInitialized()) {
            return [];
        }
        return getDocumentSymbols(text);
    },

    definition(text: string, position: Position, uri: string): Location | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalDefinition(text, uri, position);
    },

    hover(text: string, symbol: string, uri: string): Hover | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalHover(text, symbol, uri);
    },

    localCompletion(text: string): CompletionItem[] {
        if (!isInitialized()) {
            return [];
        }
        return getLocalCompletions(text);
    },

    localSignature(text: string, symbol: string, paramIndex: number): SignatureHelp | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalSignature(text, symbol, paramIndex);
    },

    rename(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        if (!isInitialized()) {
            return null;
        }
        return renameSymbol(text, position, newName, uri);
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
        // Only reload headers (.h), not .ssl files
        // .ssl files use tree-sitter based local completion/signature/hover/definition
        if (uri.endsWith(".h")) {
            language?.reloadFileData(uri, text);
        }
    },

    onWatchedFileDeleted(uri: string): void {
        language?.clearFileData(uri);
    },

    onDocumentClosed(uri: string): void {
        language?.clearSelfData(uri);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("Fallout SSL provider not initialized, cannot compile");
            return;
        }
        await falloutCompile(uri, storedContext.settings.falloutSSL, interactive, text);
    },
};
