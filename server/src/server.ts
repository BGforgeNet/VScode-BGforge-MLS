'use strict';

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	Hover,
	MarkupKind,
	SignatureHelp,
	SignatureInformation,
	ParameterInformation,
	SignatureHelpRegistrationOptions,
} from 'vscode-languageserver';
import { connect } from 'tls';
import { ExecSyncOptionsWithStringEncoding } from 'child_process';
import { URI } from 'vscode-uri';
import * as path from 'path';
import { ClientRequest } from 'http';
import * as fallout_ssl from './fallout-ssl';
import * as weidu from './weidu';
import * as common from './common';
import { conlog } from './common';


// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
export let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

let completion_map = new Map<string, Array<any>>();
let signature_map = new Map<string, Array<any>>();
let hover_lang_map = new Map([
	[ "weidu", "weidu" ],
	[ "fallout-ssl", "fallout-ssl-codeblock" ]
]);
let config_section = "bgforge";
let config_prefix = 'bgforge.';
let fallout_ssl_config = config_prefix + 'fallout-ssl';
let weidu_config = config_prefix + 'weidu';

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

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
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

	//load completion
	completion_map = load_completion();
	generate_signatures();
});

function generate_signatures() {
	let fallout_ssl_signature_list = fallout_ssl.get_signature_list(completion_map);
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

function getDocumentSettings(resource: string): Thenable<SSLsettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: config_section
		});
		documentSettings.set(resource, result);
	}
	return result;
}

function get_hover_lang(lang_id: string) {
	let hover_lang = hover_lang_map.get(lang_id);
	if (!hover_lang) { hover_lang = "c++" }
	return hover_lang;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);

	let lang_id = documents.get(change.document.uri).languageId;
	switch (lang_id) {
		case 'fallout-ssl': {
			fallout_ssl.reload_defines(completion_map, signature_map, URI.parse(change.document.uri).fsPath, change.document.getText());
			break;
		}
	}
	// /reload_defines(Uri.parse(change.document.uri).fsPath, change.document.getText());
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let diagnostics: Diagnostic[] = [];
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
		let lang_id = documents.get(_textDocumentPosition.textDocument.uri).languageId;	
		let current_list: any;
		if (lang_id == "fallout-ssl") {
			current_list = fallout_ssl.filter_completion(completion_map.get(lang_id), _textDocumentPosition.textDocument.uri);
		} else {
			current_list = completion_map.get(lang_id);
		}
		return current_list;
	}
);

function load_completion() {
	const yaml = require('js-yaml');
	const fs = require('fs');

	let yml_list = fs.readdirSync(__dirname).filter(function (el: any) {
		return (path.extname(el) == ".yml");
	});
	for (let el of yml_list) {
		let lang_id = path.basename(el).split('.')[0];
		let completion_list: Array<any>;
		try {
			const completion_yaml = yaml.safeLoad(fs.readFileSync(path.join(__dirname, el), 'utf8'));
			let item: any;
			completion_list = [];

			for (item in completion_yaml) {
				let kind = parseInt(completion_yaml[item]['type']);
				let element: any;
				let detail: string;
				let doc: string;
				for (element of completion_yaml[item]['items']) {

					// copy name to detail if it's empty
					detail = element['detail'] || element['name'];

					//strip () from the end of the string (not necessary in Fallout SSL)
					if (lang_id == "fallout-ssl" && detail.substr(-2) == "()") {
						detail = detail.substr(0, detail.length-2);
					}

					doc = element['doc'] || ''; // allow empty doc, too
					completion_list.push({ label: element['name'], kind: kind, documentation: doc, detail: detail, source: "builtin" });
				}
			}
			completion_map.set(lang_id, completion_list);
		} catch (e) {
			conlog(e);
		}

		//Fallout SSL: add completion from headers
		connection.workspace.getConfiguration(fallout_ssl_config).then(function (conf: any) {
			if (conf.headers_directory != "NONE") {
				try {
					var procdef_list = fallout_ssl.get_defines(conf.headers_directory);
					fallout_ssl.load_defines(completion_map, signature_map, procdef_list);
				} catch (e) {
					conlog(e);
				}
			}
		});

	}
	return completion_map;
};

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		//let connection = createConnection(process.stdin, process.stdout);
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();


connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover => {
	let text = documents.get(textDocumentPosition.textDocument.uri).getText();
	let lang_id = documents.get(textDocumentPosition.textDocument.uri).languageId;
	let completion_list = completion_map.get(lang_id);
	let lines = text.split(/\r?\n/g);
	let position = textDocumentPosition.position;
	var filename = common.fname(textDocumentPosition.textDocument.uri);

	let str = lines[position.line];
	let pos = position.character;
	let word = common.get_word_at(str, pos);

	if (completion_list && word) {

		let hover_lang = get_hover_lang(lang_id);
		let current_list: any[];
		if (lang_id == "fallout-ssl") {
			current_list = fallout_ssl.filter_completion(completion_list, filename);
		} else {
			current_list = completion_list;
		}

		let present = current_list.filter(function (el: any) {
			return (el.label == word);
		});
		if (present.length > 0) {
			let item = present[0];
			if (item.detail || item.documentation) {
				var markdown;
				if (item.fulltext) { //full text for defines
					markdown = {
						kind: MarkupKind.Markdown,
						value: [
							'```' + `${hover_lang}`,
							item.fulltext,
							'```',
							item.documentation
						].join('\n')
					};
				} else {
					markdown = {
						kind: MarkupKind.Markdown,
						value: [
							'```' + `${hover_lang}`,
							item.detail,
							'```',
							item.documentation
						].join('\n')
					};
				}
				let hover = { contents: markdown };
				return hover;
			}
		}
	}
});

connection.onSignatureHelp((textDocumentPosition: TextDocumentPositionParams): SignatureHelp => {
	let text = documents.get(textDocumentPosition.textDocument.uri).getText();
	let lines = text.split(/\r?\n/g);
	let position = textDocumentPosition.position;
	let str = lines[position.line];
	let pos = position.character;
	let word = common.get_signature_word(str, pos);
	let lang_id = documents.get(textDocumentPosition.textDocument.uri).languageId;
	let signature_list = signature_map.get(lang_id);
	if (signature_list && word) {
		var present = signature_list.filter(function (el: any) {
			return (el.label == word);
		});
		if (present.length > 0) {
			let sig = present[0];
			return { signatures: [{ label: sig.label, documentation: sig.documentation, parameters: [] }], activeSignature: 0, activeParameter: null };
		}
	}
});

connection.onExecuteCommand((params, cancel_token) => {
	let command = params.command;
	let args = params.arguments;
	let text_document = args[1];
	let lang_id = text_document.languageId;

	let scheme = text_document.uri.scheme;
	if (scheme != "file") {
		conlog("Please focus a valid file to compile.");
		connection.window.showWarningMessage("Please focus a valid file to compile!");
	}

	switch (command) {
		case "extension.bgforge.compile": {
			switch (lang_id) {
				case "fallout-ssl": {
					fallout_ssl.sslcompile(params, cancel_token);
					break;
				}
				case "weidu": {
					weidu.wcompile(params, cancel_token);
					break;
				}
			}
		}
	}

});
