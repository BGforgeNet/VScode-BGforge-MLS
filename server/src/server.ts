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
import { conlog, symbolAtPosition } from "./common";
import { clearDiagnostics, COMMAND_compile, compile } from "./compile";
import { Galactus } from "./galactus";
import { preview } from "./preview";
import * as settings from "./settings";
import { defaultSettings, MLSsettings } from "./settings";
import { findSymbolAtPosition as findTransitionAtPosition } from "./d";

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

let gala: Galactus;

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
    if (params.workspaceFolders) {
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
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    globalSettings = await connection.workspace.getConfiguration({ section: "bgforge" });
    // load data
    projectSettings = settings.project(workspaceRoot);
    const myGala = new Galactus();
    await myGala.init(workspaceRoot, globalSettings, projectSettings.translation);
    gala = myGala;
    for (const document of documents.all()) {
        gala.reloadFileData(document.uri, document.languageId, document.getText());
    }
    connection.sendNotification("bgforge-mls/load-finished");
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
        globalSettings = <MLSsettings>(change.settings.bgforge || defaultSettings);
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
    gala?.reloadFileData(uri, langId, text);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams) => {
    const uri = _textDocumentPosition.textDocument.uri;
    // @ts-expect-error: ts2532 because we get uri from a hook, which implies it exists
    const langId = documents.get(uri).languageId;
    const result = gala?.completion(langId, uri);
    return result;
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
    return gala?.hover(langId, uri, symbol, text);
});

connection.onExecuteCommand(async (params) => {
    const command = params.command;
    const COMMAND_preview = "extension.bgforge.preview";
    if (command != COMMAND_compile && command != COMMAND_preview) {
        return;
    }

    if (!params.arguments) {
        return;
    }
    const args = params.arguments[0];

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

    if (command == COMMAND_compile) {
        compile(args.uri, langId, true, text);
    }

    if (command == COMMAND_preview) {
        const willPreview = preview(text, langId, args.previewSrcDir);
        if (willPreview) {
            connection.sendNotification("bgforge-mls/start-preview");
        }
    }
});

connection.onSignatureHelp((params) => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    if (!document) {
        return null;
    }
    const text = document.getText();
    const langId = document.languageId;
    return gala?.signature(langId, text, params.position, uri);
});

documents.onDidSave(async (change) => {
    const uri = change.document.uri;
    const langId = change.document.languageId;
    const text = change.document.getText();
    gala?.reloadFileData(uri, langId, text);

    const validateOnSave = (await getDocumentSettings(uri)).validateOnSave;
    if (validateOnSave) {
        compile(uri, langId, false, text);
    }
});

documents.onDidChangeContent(async (event) => {
    const uri = event.document.uri;
    clearDiagnostics(uri);

    const validateOnChange = (await getDocumentSettings(uri)).validateOnChange;
    if (validateOnChange) {
        const text = event.document.getText();
        compile(uri, event.document.languageId, false, text);
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
    return gala?.inlay(uri, langId, text, params.range);
});

connection.onDefinition((params) => {
    const textDocId = params.textDocument;
    const uri = textDocId.uri;
    const textDoc = documents.get(uri);
    if (!textDoc) {
        return;
    }
    const langId = textDoc.languageId;
    const text = textDoc.getText();
    let symbol = symbolAtPosition(text, params.position);
    if (langId == "weidu-d") {
        symbol = findTransitionAtPosition(text, params.position);
    }
    return gala?.definition(langId, symbol);
});
