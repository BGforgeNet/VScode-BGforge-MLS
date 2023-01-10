import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    TextDocumentPositionParams,
    Hover,
    TextDocumentSyncKind,
    InitializeResult,
    SignatureHelp,
    SignatureInformation,
    InlayHintRequest,
    InlayHintParams,
} from "vscode-languageserver/node";
import { fileURLToPath } from "node:url";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fallout from "./fallout-ssl";
import * as weidu from "./weidu";
import { compileable } from "./compile";
import { conlog, uriToPath, isDirectory, isHeader, isSubpath, getRelPath } from "./common";
import { MLSsettings, defaultSettings } from "./settings";
import * as settings from "./settings";
import * as hover from "./hover";
import * as completion from "./completion";
import * as signature from "./signature";
import * as inlay from "./inlay";
import * as translation from "./translation";
import * as definition from "./definition";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
export const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

let workspaceRoot: string;
let initialized = false;
let projectSettings: settings.ProjectSettings;

// for language KEY, hovers and completions are searched in VALUE map
const langDataMap = new Map([
    ["weidu-tp2", "weidu-tp2"],
    ["weidu-tp2-tpl", "weidu-tp2"],

    ["weidu-d", "weidu-d"],
    ["weidu-d-tpl", "weidu-d"],

    ["weidu-baf", "weidu-baf"],
    ["weidu-baf-tpl", "weidu-baf"],
    ["weidu-ssl", "weidu-baf"],
    ["weidu-slb", "weidu-baf"],

    ["fallout-ssl", "fallout-ssl"],
    ["fallout-ssl-hover", "fallout-ssl"],
]);

connection.onInitialize((params: InitializeParams) => {
    conlog("initialize");
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
    workspaceRoot = fileURLToPath(params.workspaceFolders[0].uri);
    conlog(`workspace_root = ${workspaceRoot}`);
    return result;
});

export let globalSettings: MLSsettings = defaultSettings;

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    globalSettings = await connection.workspace.getConfiguration({ section: "bgforge" });
    // load data
    projectSettings = await settings.project(workspaceRoot);
    conlog(projectSettings);
    loadStaticIntellisense();
    loadDynamicIntellisense();
    conlog("initialized");
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

function loadStaticIntellisense() {
    completion.loadStatic();
    hover.loadStatic();
    translation.loadTranslation(projectSettings.translation);
    signature.loadStatic();
    fallout.loadExternalHeaders(workspaceRoot, globalSettings.falloutSSL.headersDirectory);
}

function getDataLangId(langId: string) {
    const dataLangId = langDataMap.get(langId);
    if (!dataLangId) {
        return langId;
    }
    return dataLangId;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
documents.onDidChangeContent(async (change) => {
    if (!initialized) {
        // TODO: get rid of this, use proper async
        conlog("onDidChangeContent: not initialized yet");
        return;
    }
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

async function reloadSelfData(txtDoc: TextDocument) {
    const langId = documents.get(txtDoc.uri).languageId;
    const docPath = uriToPath(txtDoc.uri);

    switch (langId) {
        case "fallout-ssl": {
            const relPath = getRelPath(workspaceRoot, docPath);
            if (isHeader(relPath, langId)) {
                conlog("is header");
                const oldCompletion = completion.dynamicData.get(langId);
                const oldHover = hover.dynamicData.get(langId);
                const oldDefinition = definition.dynamicData.get(langId);
                const newData = fallout.reloadData(
                    relPath,
                    txtDoc.getText(),
                    oldCompletion,
                    oldHover,
                    oldDefinition
                );
                hover.dynamicData.set(langId, newData.hover);
                completion.dynamicData.set(langId, newData.completion);
                definition.dynamicData.set(langId, newData.definition);
            } else {
                conlog("not header");
                const oldCompletion = completion.selfData.get(relPath);
                const oldHover = hover.selfData.get(relPath);
                const oldDefinition = definition.selfData.get(txtDoc.uri);
                const newData = fallout.reloadData(
                    relPath,
                    txtDoc.getText(),
                    oldCompletion,
                    oldHover,
                    oldDefinition
                );
                hover.selfData.set(relPath, newData.hover);
                completion.selfData.set(relPath, newData.completion);
                definition.selfData.set(txtDoc.uri, newData.definition);
            }
            break;
        }
        case "weidu-tp2": {
            const relPath = getRelPath(workspaceRoot, docPath);
            const oldCompletion = completion.dynamicData.get(langId);
            const oldHover = hover.dynamicData.get(langId);
            const newData = weidu.reloadData(relPath, txtDoc.getText(), oldCompletion, oldHover);
            hover.dynamicData.set(langId, newData.hover);
            completion.dynamicData.set(langId, newData.completion);
            break;
        }
        default: {
            return;
        }
    }
}

documents.onDidOpen((event) => {
    // TODO: this doesn't work for the first open doc, since the server is not initalized yet
    // need to do proper async here
    reloadSelfData(event.document);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const uri = _textDocumentPosition.textDocument.uri;
    let langId = documents.get(uri).languageId;
    langId = getDataLangId(langId);
    const filePath = uriToPath(uri);
    const relPath = getRelPath(workspaceRoot, filePath);
    const selfList = completion.selfData.get(relPath) || [];
    const staticList = completion.staticData.get(langId);
    const dynamicList = completion.dynamicData.get(langId) || [];
    const list = [...selfList, ...staticList, ...dynamicList];
    return list;
});

/** loads headers from workspace */
async function loadDynamicIntellisense() {
    const falloutHeaderData = await fallout.loadData("");
    hover.dynamicData.set("fallout-ssl", falloutHeaderData.hover);
    completion.dynamicData.set("fallout-ssl", falloutHeaderData.completion);
    definition.dynamicData.set("fallout-ssl", falloutHeaderData.definition);

    const weiduHeaderData = await weidu.loadData("");
    hover.dynamicData.set("weidu-tp2", weiduHeaderData.hover);
    completion.dynamicData.set("weidu-tp2", weiduHeaderData.completion);

    initialized = true;
}

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

connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover => {
    const uri = textDocumentPosition.textDocument.uri;
    let langId = documents.get(uri).languageId;
    langId = getDataLangId(langId);
    const filePath = uriToPath(uri);
    const relPath = getRelPath(workspaceRoot, filePath);
    const staticMap = hover.staticData.get(langId);
    const dynamicMap = hover.dynamicData.get(langId);
    const selfMap = hover.selfData.get(relPath);

    if (!staticMap && !dynamicMap && !selfMap) {
        return;
    }

    const text = documents.get(uri).getText();
    const word = hover.symbolAtPosition(text, textDocumentPosition.position);

    if (!word) {
        return;
    }
    conlog(word);

    if (translation.isTraRef(word, langId)) {
        const result = translation.getHover(
            word,
            text,
            projectSettings.translation,
            relPath,
            langId
        );
        if (result) {
            return result;
        } else {
            return;
        }
    }

    // faster to check each map than join them
    let result: Hover | hover.HoverEx;
    if (selfMap) {
        result = selfMap.get(word);
        if (result) {
            return result;
        }
    }
    if (staticMap) {
        result = staticMap.get(word);
        if (result) {
            return result;
        }
    }
    if (dynamicMap) {
        result = dynamicMap.get(word);
        if (hover) {
            return result;
        }
    }
});

connection.onExecuteCommand(async (params) => {
    const command = params.command;
    if (command != "extension.bgforge.compile") {
        return;
    }

    const args = params.arguments[0];

    if (args.scheme != "file") {
        conlog("Compile: scheme is not 'file'");
        connection.window.showInformationMessage("Focus a valid file to compile!");
        return;
    }
    const uri = args.uri;
    compile(uri, true);
});

function clearDiagnostics(uri: string) {
    // Clear old diagnostics. For some reason not working in common.send_parse_result.
    // Probably due to async?
    connection.sendDiagnostics({ uri: uri, diagnostics: [] });
}

async function compile(uri: string, interactive = false) {
    const settings = await getDocumentSettings(uri);
    const document: TextDocument = documents.get(uri);
    const langId = document.languageId;

    switch (langId) {
        case "fallout-ssl": {
            clearDiagnostics(uri);
            fallout.compile(uri, settings.falloutSSL, interactive);
            break;
        }
        case "weidu-tp2":
        case "weidu-tp2-tpl":
        case "weidu-baf":
        case "weidu-baf-tpl":
        case "weidu-d":
        case "weidu-d-tpl": {
            clearDiagnostics(uri);
            weidu.compile(uri, settings.weidu, interactive);
            break;
        }
        default: {
            conlog("Compile called on a wrong language.");
            if (interactive) {
                connection.window.showInformationMessage(`Can't compile ${uri}.`);
            }
            break;
        }
    }
}

connection.onSignatureHelp((params: TextDocumentPositionParams): SignatureHelp => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    const text = document.getText();
    const sigRequest = signature.getLabel(text, params.position);
    if (!sigRequest) {
        return;
    }

    let langId = documents.get(uri).languageId;
    langId = getDataLangId(langId);
    const staticMap = signature.staticData.get(langId);

    let sig: SignatureInformation;
    if (staticMap) {
        sig = staticMap.get(sigRequest.label);
        if (sig) {
            return signature.getResponse(sig, sigRequest.parameter);
        }
    }
});

documents.onDidSave(async (change) => {
    reloadSelfData(change.document);

    const uri = change.document.uri;

    // try and parse document if possible
    if (compileable(change.document)) {
        const docSettings = await getDocumentSettings(uri);
        if (docSettings.validateOnSave || docSettings.validateOnChange) {
            compile(uri);
        }
    }

    // reload translation settings
    const realPath = uriToPath(uri);
    const relPath = getRelPath(workspaceRoot, realPath);
    if (relPath == ".bgforge.yml") {
        projectSettings = await settings.project(workspaceRoot);
    }

    // reload translation
    const traDir = projectSettings.translation.directory;
    if (isDirectory(traDir)) {
        if (isSubpath(traDir, relPath)) {
            // relative to tra dir
            const relPath2 = getRelPath(traDir, relPath);
            translation.reloadTraFile(traDir, relPath2);
        }
    }
});

connection.onRequest((method, params: InlayHintParams) => {
    if (method == InlayHintRequest.method) {
        const uri = params.textDocument.uri;
        const filePath = uriToPath(uri);
        const relPath = getRelPath(workspaceRoot, filePath);
        const document = documents.get(uri);
        const text = document.getText();
        const langId = document.languageId;
        const hints = inlay.getHints(
            text,
            projectSettings.translation,
            relPath,
            langId,
            params.range
        );
        return hints;
    }
});

connection.onDefinition((params) => {
    conlog("definition request:");
    conlog(params);
    const textDocId = params.textDocument;
    const uri = textDocId.uri;
    const textDoc = documents.get(uri);
    const langId = textDoc.languageId;
    const text = textDoc.getText();
    const symbol = hover.symbolAtPosition(text, params.position);
    const result = definition.getLocation(langId, uri, symbol);
    conlog("definition response:");
    conlog(result);
    return result;
});
