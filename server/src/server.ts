'use strict';

import {
	createConnection,
	TextDocuments,
	Diagnostic,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentPositionParams,
	Hover,
	SignatureHelp,
	TextDocumentSyncKind,
	WorkspaceChange,
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri'
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import * as fallout_ssl from './fallout-ssl';
import * as weidu from './weidu';
import * as common from './common';
import { conlog, CompletionData, HoverData, CompletionDataEx, HoverDataEx  } from './common';
import { workspace } from 'vscode';


// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
export const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);


let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

// let static_completion = new Map<string, CompletionList>();
// let static_completion = new Map<string, CompletionList>();
let static_completion: CompletionData = new Map();
let dynamic_completion: CompletionDataEx = new Map();
// let static_hover = new Map<string, Map<string, any>>();
// let static_hover = new Map<string, HoverMap>();
// let static_hover = new Map<string, any>();
// let dynamic_hover = new Map<string, Map<string, HoverEx>>();
// let dynamic_hover = new Map<string, HoverMap>();
let static_hover: HoverData = new Map()
let dynamic_hover: HoverDataEx = new Map()

let signature_map = new Map<string, Array<any>>();

const completion_languages = ["weidu-tp2", "fallout-ssl"]
const hover_languages = ["weidu-tp2", "fallout-ssl"]


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
	["fallout-ssl-hover", "fallout-ssl"]
]);

const config_section = "bgforge";
const config_prefix = 'bgforge.';
const fallout_ssl_config = config_prefix + 'fallout-ssl';

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability =
		capabilities.workspace && !!capabilities.workspace.configuration;
	hasWorkspaceFolderCapability =
		capabilities.workspace && !!capabilities.workspace.workspaceFolders;
	hasDiagnosticRelatedInformationCapability =
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation;
	// yes this is unsafe, just doing something quick and dirty
	workspace_root = params.workspaceFolders[0].uri as string;
	conlog(workspace_root);
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true,
			},
			hoverProvider: true,
			signatureHelpProvider: {
				"triggerCharacters": ['(']
			}
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			conlog('Workspace folder change event received.');
		});
	}

	// load data
	load_static_completion();
	load_static_hover();
	load_dynamic_intellisense();
	generate_signatures();
});

function generate_signatures() {
	const fallout_ssl_signature_list = fallout_ssl.get_signature_list(static_completion);
	signature_map.set("fallout-ssl", fallout_ssl_signature_list);
}

// The settings
interface SSLsettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: SSLsettings = { maxNumberOfProblems: 10 };
let globalSettings: SSLsettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<SSLsettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <SSLsettings>(
			(change.settings.bgforge || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function get_data_lang(lang_id: string) {
	let data_lang = lang_data_map.get(lang_id);
	if (!data_lang) { data_lang = "c++" }
	return data_lang;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	if (!initialized) { // TODO: get rid of this, use proper async
		conlog("onDidChangeContent: not initialized yet");
		return;
	}
	validateTextDocument(change.document);
	const lang_id = documents.get(change.document.uri).languageId;
	switch (lang_id) {
		case 'fallout-ssl': {
			const rel_path = path.relative(workspace_root, change.document.uri);
			const completion = dynamic_completion.get('fallout-ssl');
			const hover = dynamic_hover.get('fallout-ssl');
			const new_data = fallout_ssl.reload_data(rel_path, change.document.getText(), completion, hover);	
			dynamic_hover.set('fallout-ssl', new_data.hover);
			dynamic_completion.set('fallout-ssl', new_data.completion);
			break;
		}
	}
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const diagnostics: Diagnostic[] = [];
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	conlog('We received an file change event');
});


// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		const lang_id = documents.get(_textDocumentPosition.textDocument.uri).languageId;
		const static_list = static_completion.get(lang_id);
		const dynamic_list = dynamic_completion.get(lang_id);
		const list = [...static_list, ...dynamic_list];
		return list;
	}
);

async function load_dynamic_intellisense() {
	const fallout_header_data = await fallout_ssl.load_data();
	dynamic_hover.set('fallout-ssl', fallout_header_data.hover);
	dynamic_completion.set('fallout-ssl', fallout_header_data.completion);
	initialized = true;
};


function load_static_completion() {
	const fs = require('fs');
	for (const lang_id of completion_languages) {
		try {
			const file_path = path.join(__dirname, `completion.${lang_id}.json`);
			const completion_list = JSON.parse(fs.readFileSync(file_path));
			static_completion.set(lang_id, completion_list);
		} catch (e) {
			conlog(e);
		}
	}
};

function load_static_hover() {
	const fs = require('fs');

	for (const lang_id of hover_languages) {
		try {
			const file_path = path.join(__dirname, `hover.${lang_id}.json`);
			conlog(typeof(file_path));
			const json_data = JSON.parse(fs.readFileSync(file_path));
			// const hover_data: Map<string, Hover> = JSON.parse(fs.readFileSync(file_path));
			const hover_data: Map<string, Hover> = new Map(Object.entries(json_data));
			static_hover.set(lang_id, hover_data);
		} catch (e) {
			conlog(e);
		}
	}
};


// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();


connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover => {
	const lang_id = documents.get(textDocumentPosition.textDocument.uri).languageId;
	const hover_lang_id = get_data_lang(lang_id);
	const static_map = static_hover.get(hover_lang_id);
	const dynamic_map = dynamic_hover.get(hover_lang_id);
	const map = new Map([...dynamic_map, ...static_map]);
	if (!map) { return; }

	const text = documents.get(textDocumentPosition.textDocument.uri).getText();
	const lines = text.split(/\r?\n/g);
	const position = textDocumentPosition.position;

	const str = lines[position.line];
	const pos = position.character;
	const word = common.get_word_at(str, pos);
	if (word) {
		const hover = map.get(word);
		if (hover) { return hover; }
	}
});

connection.onSignatureHelp((textDocumentPosition: TextDocumentPositionParams): SignatureHelp => {
	const text = documents.get(textDocumentPosition.textDocument.uri).getText();
	const lines = text.split(/\r?\n/g);
	const position = textDocumentPosition.position;
	const str = lines[position.line];
	const pos = position.character;
	const word = common.get_signature_word(str, pos);
	const lang_id = documents.get(textDocumentPosition.textDocument.uri).languageId;
	const signature_list = signature_map.get(lang_id);
	if (signature_list && word) {
		const present = signature_list.filter(function (el: any) {
			return (el.label == word);
		});
		if (present.length > 0) {
			const sig = present[0];
			return { signatures: [{ label: sig.label, documentation: sig.documentation, parameters: [] }], activeSignature: 0, activeParameter: null };
		}
	}
});

connection.onExecuteCommand((params, cancel_token) => {
	const command = params.command;
	const args = params.arguments;
	const text_document = args[0];
	const lang_id = text_document.languageId;

	const scheme = text_document.uri.scheme;
	if (scheme != "file") {
		conlog("Focus a valid file to compile.");
		connection.window.showInformationMessage("Focus a valid file to compile!");
	}

	switch (command) {
		case "extension.bgforge.compile": {
			switch (lang_id) {
				case "fallout-ssl": {
					fallout_ssl.sslcompile(params, cancel_token);
					break;
				}
				case "weidu-tp2":
				case "weidu-tp2-tpl":
				case "weidu-baf":
				case "weidu-baf-tpl":
				case "weidu-d":
				case "weidu-d-tpl": {
					weidu.wcompile(params, cancel_token);
					break;
				}
				default: {
					connection.window.showInformationMessage("Focus a valid file to compile!");
					break;
				}
			}
		}
	}

});
