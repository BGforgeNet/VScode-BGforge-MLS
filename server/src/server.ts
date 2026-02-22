/**
 * LSP server entry point.
 * Sets up the language server connection and routes all LSP requests
 * to the appropriate providers via ProviderRegistry.
 */

import { fileURLToPath } from "node:url";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
    CompletionItem,
    CompletionParams,
    createConnection,
    DidChangeConfigurationNotification,
    DidChangeWatchedFilesNotification,
    InitializeParams,
    InitializeResult,
    MessageType,
    ProposedFeatures,
    TextDocumentPositionParams,
    TextDocuments,
    TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { conlog, symbolAtPosition } from "./common";
import { clearDiagnostics, COMMAND_compile, compile } from "./compile";
import { getRequest as getSignatureRequest } from "./shared/signature";
import { parseDialog } from "./dialog";
import { parseDDialog } from "./weidu-d/dialog";
import { falloutSslProvider } from "./fallout-ssl/provider";
import { Translation } from "./translation";
import {
    LANG_FALLOUT_SSL,
    LANG_WEIDU_BAF,
    LANG_WEIDU_D,
    LANG_WEIDU_SLB,
    LANG_WEIDU_SSL,
} from "./core/languages";
import { falloutWorldmapProvider } from "./fallout-worldmap/provider";
import { registry } from "./provider-registry";
import * as settings from "./settings";
import { defaultSettings, MLSsettings } from "./settings";
import { weiduBafProvider } from "./weidu-baf/provider";
import { weiduDProvider } from "./weidu-d/provider";
import { weiduTp2Provider } from "./weidu-tp2/provider";
import { initLspConnection } from "./lsp-connection";
import { initSettingsService } from "./settings-service";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Initialize the LSP connection holder for modules that need it
initLspConnection(connection, documents);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasFileWatchingCapability = false;

let workspaceRoot: string | undefined;
let projectSettings: settings.ProjectSettings;

// Initialized in onInitialized, undefined until then
let translation: Translation | undefined;

// Debouncing for file data reloads on content changes
const pendingReloads = new Map<string, NodeJS.Timeout>();
const RELOAD_DEBOUNCE_MS = 300;

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
    hasFileWatchingCapability = !!(
        capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                completionItem: { labelDetailsSupport: true },
                triggerCharacters: ["@"],
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ["("],
            },
            inlayHintProvider: true,
            definitionProvider: true,
            renameProvider: { prepareProvider: true },
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
    if (params.workspaceFolders?.[0]) {
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
    translation = new Translation(projectSettings.translation, workspaceRoot);
    await translation.init();

    // Reload translation files for open documents
    for (const document of documents.all()) {
        translation.reloadFile(document.uri, document.languageId, document.getText());
    }
    // Register and initialize providers
    registry.register(falloutSslProvider);
    registry.register(falloutWorldmapProvider);
    registry.register(weiduBafProvider);
    registry.register(weiduDProvider);
    registry.register(weiduTp2Provider);

    // Register language aliases (languages that share data with parent providers)
    registry.registerAlias(LANG_WEIDU_SLB, LANG_WEIDU_BAF);
    registry.registerAlias(LANG_WEIDU_SSL, LANG_WEIDU_BAF);

    await registry.init({ workspaceRoot, settings: globalSettings });

    // Register file watchers for header files
    // NOTE: For standalone LSP usage (e.g., Claude Code) where client may not support
    // file watching, consider adding chokidar-based fallback in the future.
    if (hasFileWatchingCapability) {
        const watchPatterns = registry.getWatchPatterns();
        if (watchPatterns.length > 0) {
            await connection.client.register(DidChangeWatchedFilesNotification.type, {
                watchers: watchPatterns,
            });
            conlog(`Registered file watchers for ${watchPatterns.length} patterns`);
        }
    }

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

// Handle file system changes for watched files (headers)
connection.onDidChangeWatchedFiles((params) => {
    for (const event of params.changes) {
        registry.handleWatchedFileChange(event.uri, event.type);
    }
});

// Clean up on document close
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
    registry.handleDocumentClosed(e.document.languageId, e.document.uri);
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

// Initialize the settings service holder so compile.ts can access settings without importing server.ts
initSettingsService(getDocumentSettings);

documents.onDidOpen((event) => {
    // TODO: this doesn't work for the first open doc, since the server is not initalized yet
    // need to do proper async here
    const uri = event.document.uri;
    const langId = event.document.languageId;
    const text = event.document.getText();

    // Reload provider data
    registry.reloadFileData(langId, uri, text);

    // Reload translation data if it's a translation file
    translation?.reloadFile(uri, langId, text);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((params: CompletionParams) => {
    const uri = params.textDocument.uri;
    const textDoc = documents.get(uri);
    if (!textDoc) {
        return [];
    }
    const langId = textDoc.languageId;
    const text = textDoc.getText();
    return registry.completion(langId, text, uri, params.position, params.context?.triggerCharacter);
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

    // Suppress all features in comment zones
    if (!registry.shouldProvideFeatures(langId, text, textDocumentPosition.position)) {
        return;
    }

    // Check translation hover first (for @123 or NOption(123) references)
    const translationHover = translation?.getHover(uri, langId, symbol, text);
    if (translationHover) {
        return translationHover;
    }

    // Try local hover (AST-based, for symbols defined in current file)
    const localHover = registry.localHover(langId, text, symbol, uri, textDocumentPosition.position);
    if (localHover.handled) {
        return localHover.hover;
    }

    // Fall back to data-driven hover (from headers/static data)
    // Pass text to enable unified symbol resolution (Approach C)
    const dataHover = registry.hover(langId, uri, symbol, text);
    return dataHover;
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
        try {
            const langId = textDoc.languageId;
            const text = textDoc.getText();
            if (langId === LANG_FALLOUT_SSL) {
                const dialogData = await parseDialog(text);
                const messages = translation?.getMessages(args.uri, text, langId) ?? {};
                return { ...dialogData, messages };
            }
            if (langId === LANG_WEIDU_D) {
                const dialogData = parseDDialog(text);
                const messages = translation?.getMessages(args.uri, text, langId) ?? {};
                return { ...dialogData, messages };
            }
            return null;
        } catch (e) {
            conlog("parseDialog error: " + e);
            if (e instanceof Error) {
                conlog("stack: " + e.stack);
            }
            return null;
        }
    }

    if (command !== COMMAND_compile) {
        return;
    }

    if (args.scheme !== "file") {
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

    return registry.signature(langId, text, uri, request.symbol, request.parameter);
});

documents.onDidSave(async (change) => {
    const uri = change.document.uri;
    const langId = change.document.languageId;
    const text = change.document.getText();

    // Reload provider data
    registry.reloadFileData(langId, uri, text);

    // Reload translation data if it's a translation file
    translation?.reloadFile(uri, langId, text);

    const validateOnSave = (await getDocumentSettings(uri)).validateOnSave;
    if (validateOnSave) {
        void compile(uri, langId, false, text);
    }
});

documents.onDidChangeContent(async (event) => {
    const uri = event.document.uri;
    const langId = event.document.languageId;
    const text = event.document.getText();

    clearDiagnostics(uri);

    // Keep provider data (function index, etc.) and translation data up to date as content changes.
    // This ensures hover/definition work immediately after edits like rename.
    // Debounced to avoid excessive reloads during rapid typing.
    const existing = pendingReloads.get(uri);
    if (existing) {
        clearTimeout(existing);
    }
    pendingReloads.set(
        uri,
        setTimeout(() => {
            pendingReloads.delete(uri);
            registry.reloadFileData(langId, uri, text);
            translation?.reloadFile(uri, langId, text);
        }, RELOAD_DEBOUNCE_MS),
    );

    const validateOnChange = (await getDocumentSettings(uri)).validateOnChange;
    if (validateOnChange) {
        void compile(uri, langId, false, text);
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
    return translation?.getInlayHints(uri, langId, text, params.range) ?? [];
});

connection.onDefinition((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return;
    }
    const uri = params.textDocument.uri;
    const langId = textDoc.languageId;
    const text = textDoc.getText();

    // Suppress features in comment/param-name zones
    if (!registry.shouldProvideFeatures(langId, text, params.position)) {
        return;
    }

    // Try provider first (AST-based definition, e.g. state labels in D files)
    const providerResult = registry.definition(langId, text, params.position, uri);
    if (providerResult) {
        return providerResult;
    }

    const symbol = symbolAtPosition(text, params.position);

    // Try translation definition (mstr/tra/@123 references -> .msg/.tra files)
    if (symbol) {
        const traResult = translation?.getDefinition(uri, langId, symbol, text);
        if (traResult) {
            return traResult;
        }
    }

    // Try provider symbol definition (data-driven, from headers)
    if (symbol) {
        return registry.symbolDefinition(langId, symbol);
    }

    return null;
});

connection.onPrepareRename((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return null;
    }
    const langId = textDoc.languageId;
    const text = textDoc.getText();

    return registry.prepareRename(langId, text, params.position);
});

connection.onRenameRequest((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return null;
    }
    const uri = params.textDocument.uri;
    const langId = textDoc.languageId;
    const text = textDoc.getText();

    return registry.rename(langId, text, params.position, params.newName, uri);
});

connection.onDocumentFormatting((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return [];
    }
    const uri = params.textDocument.uri;
    const langId = textDoc.languageId;
    const text = textDoc.getText();

    const result = registry.format(langId, text, uri);
    if (result.warning) {
        void connection.sendNotification("window/showMessage", {
            type: MessageType.Warning,
            message: result.warning,
        });
    }
    return result.edits;
});

connection.onDocumentSymbol((params) => {
    const textDoc = documents.get(params.textDocument.uri);
    if (!textDoc) {
        return [];
    }
    return registry.symbols(textDoc.languageId, textDoc.getText());
});

