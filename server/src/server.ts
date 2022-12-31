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
} from "vscode-languageserver/node";
import { fileURLToPath } from "node:url";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as path from "path";
import * as fallout_ssl from "./fallout-ssl";
import * as weidu from "./weidu";
import * as common from "./common";
import { conlog, is_header } from "./common";
import { MLSsettings, defaultSettings } from "./settings";
import {
    dynamic_completion,
    load_static_completion,
    self_completion,
    static_completion,
} from "./completion";
import { dynamic_hover, HoverEx, load_static_hover, self_hover, static_hover } from "./hover";
import {
    find_label_for_signature,
    load_static_signatures,
    sig_response,
    static_signatures,
} from "./signature";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
export const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

/** Only these languages can be compiled */
const compile_languages = [
    "weidu-tp2",
    "weidu-tp2-tpl",
    "weidu-d",
    "weidu-d-tpl",
    "weidu-baf",
    "weidu-baf-tpl",
    "fallout-ssl",
];
/** These languages require game path to compile */
const compile_languages_with_game = ["weidu-d", "weidu-d-tpl", "weidu-baf", "weidu-baf-tpl"];

let workspace_root: string;
let initialized = false;

// for language KEY, hovers and completions are searched in VALUE map
const lang_data_map = new Map([
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
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ["("],
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
    workspace_root = fileURLToPath(params.workspaceFolders[0].uri);
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
    load_static_completion();
    load_static_hover();
    load_static_signatures();
    fallout_ssl.load_external_headers(workspace_root, globalSettings.falloutSSL.headersDirectory);
    load_dynamic_intellisense();
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

function get_data_lang(lang_id: string) {
    let data_lang = lang_data_map.get(lang_id);
    if (!data_lang) {
        data_lang = "c++";
    }
    return data_lang;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    if (!initialized) {
        // TODO: get rid of this, use proper async
        conlog("onDidChangeContent: not initialized yet");
        return;
    }
    reload_self_data(change.document);
});
function getDocumentSettings(resource: string): Thenable<MLSsettings> {
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

async function reload_self_data(txtDoc: TextDocument) {
    const lang_id = documents.get(txtDoc.uri).languageId;

    switch (lang_id) {
        case "fallout-ssl": {
            const rel_path = path.relative(workspace_root, txtDoc.uri);
            if (is_header(rel_path, lang_id)) {
                const completion = dynamic_completion.get(lang_id);
                const hover = dynamic_hover.get(lang_id);
                const new_data = fallout_ssl.reload_data(
                    rel_path,
                    txtDoc.getText(),
                    completion,
                    hover
                );
                dynamic_hover.set(lang_id, new_data.hover);
                dynamic_completion.set(lang_id, new_data.completion);
            } else {
                const completion = self_completion.get(rel_path);
                const hover = self_hover.get(rel_path);
                const new_data = fallout_ssl.reload_data(
                    rel_path,
                    txtDoc.getText(),
                    completion,
                    hover
                );
                self_hover.set(rel_path, new_data.hover);
                self_completion.set(rel_path, new_data.completion);
            }
            break;
        }
    }
}

documents.onDidOpen((event) => {
    reload_self_data(event.document);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const lang_id = documents.get(_textDocumentPosition.textDocument.uri).languageId;
    const rel_path = path.relative(workspace_root, _textDocumentPosition.textDocument.uri);
    const self_list = self_completion.get(rel_path) || [];
    const static_list = static_completion.get(lang_id);
    const dynamic_list = dynamic_completion.get(lang_id) || [];
    const list = [...self_list, ...static_list, ...dynamic_list];
    return list;
});

/** loads headers from workspace */
async function load_dynamic_intellisense() {
    const fallout_header_data = await fallout_ssl.load_data("");
    dynamic_hover.set("fallout-ssl", fallout_header_data.hover);
    dynamic_completion.set("fallout-ssl", fallout_header_data.completion);
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
    const lang_id = documents.get(textDocumentPosition.textDocument.uri).languageId;
    const rel_path = path.relative(workspace_root, textDocumentPosition.textDocument.uri);
    const hover_lang_id = get_data_lang(lang_id);
    const static_map = static_hover.get(hover_lang_id);
    const dynamic_map = dynamic_hover.get(hover_lang_id);
    const self_map = self_hover.get(rel_path);

    if (!static_map && !dynamic_map && !self_map) {
        return;
    }

    const text = documents.get(textDocumentPosition.textDocument.uri).getText();
    const lines = text.split(/\r?\n/g);
    const position = textDocumentPosition.position;

    const str = lines[position.line];
    const pos = position.character;
    const word = common.get_word_at(str, pos);
    conlog(word);
    // faster to check each map than join them
    if (word) {
        let hover: Hover | HoverEx;
        if (self_map) {
            hover = self_map.get(word);
            if (hover) {
                return hover;
            }
        }
        if (static_map) {
            hover = static_map.get(word);
            if (hover) {
                return hover;
            }
        }
        if (dynamic_map) {
            hover = dynamic_map.get(word);
            if (hover) {
                return hover;
            }
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

async function compile(uri: string, interactive = false) {
    const settings = await getDocumentSettings(uri);
    const document: TextDocument = documents.get(uri);
    const lang_id = document.languageId;

    // Clear old diagnostics. For some reason not working in common.send_parse_result.
    // Probably due to async?
    connection.sendDiagnostics({ uri: uri, diagnostics: [] });

    switch (lang_id) {
        case "fallout-ssl": {
            fallout_ssl.compile(uri, settings.falloutSSL, interactive);
            break;
        }
        case "weidu-tp2":
        case "weidu-tp2-tpl":
        case "weidu-baf":
        case "weidu-baf-tpl":
        case "weidu-d":
        case "weidu-d-tpl": {
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
    const position = params.position;

    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    const text = document.getText();
    const lines = text.split(/\r?\n/g);
    const str = lines[position.line];
    const pos = position.character;
    const sig_request = find_label_for_signature(str, pos);
    if (!sig_request) {
        return;
    }

    const lang_id = document.languageId;
    const static_map = static_signatures.get(lang_id);

    let sig: SignatureInformation;
    if (static_map) {
        sig = static_map.get(sig_request.label);
        if (sig) {
            return sig_response(sig, sig_request.parameter);
        }
    }
});

async function can_compile(document: TextDocument) {
    const lang_id = document.languageId;
    if (!compile_languages.includes(lang_id)) {
        return false;
    }
    const settings = await getDocumentSettings(document.uri);
    if (compile_languages_with_game.includes(lang_id) && settings.weidu.gamePath == "") {
        return false;
    }
    return true;
}

documents.onDidSave(async (change) => {
    const uri = change.document.uri;
    if (!can_compile(change.document)) {
        return;
    }
    const settings = await getDocumentSettings(uri);
    if (settings.validateOnSave || settings.validateOnChange) {
        compile(uri);
    }
});
