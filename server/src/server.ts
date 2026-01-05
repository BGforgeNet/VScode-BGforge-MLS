/**
 * LSP server entry point.
 * Sets up the language server connection and routes all LSP requests
 * to the appropriate providers via ProviderRegistry.
 */

import { fileURLToPath } from "node:url";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
    CompletionItem,
    createConnection,
    DidChangeConfigurationNotification,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocumentPositionParams,
    TextDocuments,
    TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { conlog, getRelPath, isSubpath, symbolAtPosition, uriToPath } from "./common";
import { clearDiagnostics, COMMAND_compile, compile } from "./compile";
import { getRequest as getSignatureRequest } from "./signature";
import { parseDialog } from "./dialog";
import { falloutSslProvider } from "./fallout-ssl/provider";
import * as inlay from "./inlay";
import {
    getTraExt,
    isTraRef,
    languages as translationLanguages,
    translatableLanguages,
    Translation,
} from "./translation";
import {
    LANG_FALLOUT_SSL,
    LANG_WEIDU_BAF,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_SLB,
    LANG_WEIDU_SSL,
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TPL,
} from "./core/languages";
import { falloutWorldmapProvider } from "./fallout-worldmap/provider";
import { registry } from "./provider-registry";
import * as settings from "./settings";
import { defaultSettings, MLSsettings } from "./settings";
import { weiduBafProvider } from "./weidu-baf/provider";
import { weiduDProvider } from "./weidu-d/provider";
import { weiduTp2Provider } from "./weidu-tp2/provider";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
export const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

let workspaceRoot: string;
let projectSettings: settings.ProjectSettings;

// Initialized in onInitialized, undefined until then
let translation: Translation | undefined;

// =========================================================================
// Translation helpers
// =========================================================================

/** Reload translation data for a file if it's a translation file */
function reloadTranslation(uri: string, langId: string, text: string): void {
    if (!translation?.initialized) return;
    if (!translationLanguages.includes(langId)) return;

    const filePath = uriToPath(uri);
    if (!isSubpath(workspaceRoot, filePath)) return;

    const wsPath = getRelPath(workspaceRoot, filePath);
    translation.reloadFileLines(wsPath, text);
}

/** Get translation hover for a symbol if applicable */
function getTranslationHover(uri: string, langId: string, symbol: string, text: string) {
    if (!translation?.initialized) return null;
    if (!translatableLanguages.includes(langId)) return null;
    if (!isTraRef(symbol, langId)) return null;

    const filePath = uriToPath(uri);
    if (!isSubpath(workspaceRoot, filePath)) return null;

    const relPath = getRelPath(workspaceRoot, filePath);
    return translation.hover(symbol, text, relPath, langId);
}

/** Get translation-based inlay hints */
function getTranslationInlay(uri: string, langId: string, text: string, range: import("vscode-languageserver/node").Range) {
    if (!translation?.initialized) return [];

    const filePath = uriToPath(uri);
    const traFileKey = translation.traFileKey(filePath, text, langId);
    if (!traFileKey) return [];

    const traEntries = translation.entries(traFileKey);
    if (!traEntries) return [];

    const traExt = getTraExt(langId);
    if (!traExt) return [];

    return inlay.getHints(traFileKey, traEntries, traExt, text, range);
}

/** Get message texts for a fallout-ssl file (for dialog parsing) */
function getMessages(uri: string, text: string): Record<string, string> {
    const messages: Record<string, string> = {};
    if (!translation?.initialized) return messages;

    const filePath = uriToPath(uri);
    const traFileKey = translation.traFileKey(filePath, text, LANG_FALLOUT_SSL);
    if (!traFileKey) return messages;

    const traEntries = translation.entries(traFileKey);
    if (!traEntries) return messages;

    for (const [id, entry] of traEntries) {
        messages[id] = entry.source;
    }
    return messages;
}

connection.onInitialize((params: InitializeParams) => {
    conlog("onInitialize started");
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                completionItem: { labelDetailsSupport: true },
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ["("],
            },
            inlayHintProvider: true,
            definitionProvider: true,
            documentFormattingProvider: true,
            documentSymbolProvider: true,
            executeCommandProvider: {
                commands: ["bgforge.parseDialog"],
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }
    // yes this is unsafe, just doing something quick and dirty
    if (params.workspaceFolders && params.workspaceFolders[0]) {
        // this better exist or we don't know what to do
        workspaceRoot = fileURLToPath(params.workspaceFolders[0].uri);
        conlog(`workspace_root = ${workspaceRoot}`);
    }
    conlog("onInitialize completed");
    return result;
});

export let globalSettings: MLSsettings = defaultSettings;

connection.onInitialized(async () => {
    conlog("onInitialized started");
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        await connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    globalSettings = await connection.workspace.getConfiguration({ section: "bgforge" });
    // load data
    projectSettings = settings.project(workspaceRoot);

    // Initialize translation service
    const tra = new Translation(projectSettings.translation);
    await tra.init();
    translation = tra;

    // Reload translation files for open documents
    for (const document of documents.all()) {
        reloadTranslation(document.uri, document.languageId, document.getText());
    }
    // Register and initialize providers
    registry.register(falloutSslProvider);
    registry.register(falloutWorldmapProvider);
    registry.register(weiduBafProvider);
    registry.register(weiduDProvider);
    registry.register(weiduTp2Provider);

    // Register language aliases (languages that share data with parent providers)
    registry.registerAlias(LANG_WEIDU_D_TPL, LANG_WEIDU_D);
    registry.registerAlias(LANG_WEIDU_SLB, LANG_WEIDU_BAF);
    registry.registerAlias(LANG_WEIDU_SSL, LANG_WEIDU_BAF);
    registry.registerAlias(LANG_WEIDU_TP2_TPL, LANG_WEIDU_TP2);

    await registry.init({ workspaceRoot, settings: globalSettings });
    void connection.sendNotification("bgforge-mls/load-finished");
    conlog("onInitialized completed");
});

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<MLSsettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
    conlog("did change configuration");
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    } else {
        // change.settings is typed as any by vscode-languageserver
        const bgforge = change.settings?.bgforge as MLSsettings | undefined;
        globalSettings = bgforge ?? defaultSettings;
    }
});

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});

export function getDocumentSettings(resource: string): Thenable<MLSsettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: "bgforge",
        });
        documentSettings.set(resource, result);
    }
    return result;
}

documents.onDidOpen((event) => {
    // TODO: this doesn't work for the first open doc, since the server is not initalized yet
    // need to do proper async here
    const uri = event.document.uri;
    const langId = event.document.languageId;
    const text = event.document.getText();

    // Reload provider data
    registry.reloadFileData(langId, uri, text);

    // Reload translation data if it's a translation file
    reloadTranslation(uri, langId, text);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams) => {
    const uri = _textDocumentPosition.textDocument.uri;
    const textDoc = documents.get(uri);
    if (!textDoc) {
        return [];
    }
    const langId = textDoc.languageId;
    return registry.completion(langId, uri);
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

connection.onHover((textDocumentPosition: TextDocumentPositionParams) => {
    const uri = textDocumentPosition.textDocument.uri;
    const textDoc = documents.get(uri);
    if (!textDoc) {
        return;
    }
    const langId = textDoc.languageId;
    const text = textDoc.getText();
    const symbol = symbolAtPosition(text, textDocumentPosition.position);

    if (!symbol) {
        return;
    }

    // Check translation hover first (for @123 or NOption(123) references)
    const translationHover = getTranslationHover(uri, langId, symbol, text);
    if (translationHover) {
        return translationHover;
    }

    // Then try provider
    return registry.hover(langId, uri, symbol);
});

connection.onExecuteCommand(async (params) => {
    const command = params.command;
    const COMMAND_parseDialog = "bgforge.parseDialog";

    if (!params.arguments) {
        return;
    }
    const args = params.arguments[0];

    // Handle parseDialog command
    if (command === COMMAND_parseDialog) {
        const textDoc = documents.get(args.uri);
        if (!textDoc) {
            return null;
        }
        if (textDoc.languageId !== LANG_FALLOUT_SSL) {
            return null;
        }
        try {
            const dialogData = await parseDialog(textDoc.getText());
            const messages = getMessages(args.uri, textDoc.getText());
            return { ...dialogData, messages };
        } catch (e) {
            conlog("parseDialog error: " + e);
            if (e instanceof Error) {
                conlog("stack: " + e.stack);
            }
            return null;
        }
    }

    if (command != COMMAND_compile) {
        return;
    }

    if (args.scheme != "file") {
        conlog("Compile: scheme is not 'file'");
        connection.window.showInformationMessage("Focus a valid file to run commands!");
        return;
    }

    const textDoc = documents.get(args.uri);
    if (!textDoc) {
        return;
    }
    const langId = textDoc.languageId;
    const text = textDoc.getText();

    void compile(args.uri, langId, true, text);
    return undefined;
});

connection.onSignatureHelp((params) => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    if (!document) {
        return null;
    }
    const text = document.getText();
    const langId = document.languageId;

    // Parse signature request from text/position
    const request = getSignatureRequest(text, params.position);
    if (!request) {
        return null;
    }

    return registry.signature(langId, uri, request.symbol, request.parameter);
});

documents.onDidSave(async (change) => {
    const uri = change.document.uri;
    const langId = change.document.languageId;
    const text = change.document.getText();

    // Reload provider data
    registry.reloadFileData(langId, uri, text);

    // Reload translation data if it's a translation file
    reloadTranslation(uri, langId, text);

    const validateOnSave = (await getDocumentSettings(uri)).validateOnSave;
    if (validateOnSave) {
        void compile(uri, langId, false, text);
    }
});

documents.onDidChangeContent(async (event) => {
    const uri = event.document.uri;
    clearDiagnostics(uri);

    const validateOnChange = (await getDocumentSettings(uri)).validateOnChange;
    if (validateOnChange) {
        const text = event.document.getText();
        void compile(uri, event.document.languageId, false, text);
    }
});

connection.languages.inlayHint.on((params) => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    if (!document) {
        return;
    }
    const text = document.getText();
    const langId = document.languageId;

    // Try provider first (for AST-based inlay hints)
    const providerResult = registry.inlayHints(langId, text, uri, params.range);
    if (providerResult.length > 0) {
        return providerResult;
    }

    // Fall back to translation-based inlay hints
    return getTranslationInlay(uri, langId, text, params.range);
});

connection.onDefinition((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return;
    }
    const uri = params.textDocument.uri;
    const langId = textDoc.languageId;
    const text = textDoc.getText();

    // Try provider first (AST-based definition, e.g. state labels in D files)
    const providerResult = registry.definition(langId, text, params.position, uri);
    if (providerResult) {
        return providerResult;
    }

    // Try provider symbol definition (data-driven, from headers)
    const symbol = symbolAtPosition(text, params.position);
    if (symbol) {
        return registry.symbolDefinition(langId, symbol);
    }

    return null;
});

connection.onDocumentFormatting((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return [];
    }
    const uri = params.textDocument.uri;
    const langId = textDoc.languageId;
    const text = textDoc.getText();

    return registry.format(langId, text, uri);
});

connection.onDocumentSymbol((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return [];
    }
    return registry.symbols(textDoc.languageId, textDoc.getText());
});

