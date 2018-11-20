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
	TextDocumentPositionParams
} from 'vscode-languageserver';
import { connect } from 'tls';
import { ExecSyncOptionsWithStringEncoding } from 'child_process';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

let completion_item_list: Array<any>;
let header_file_list: Array<any>;

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
				resolveProvider: true
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
			connlog('Workspace folder change event received.');
		});
	}

	completion_item_list = load_completion();
	connection.workspace.getWorkspaceFolders().then(function (workspacefolders) {
		connection.workspace.getConfiguration('ssl').then(function (conf: any) {
			var def_list = get_defines(workspacefolders[0].uri.replace('file:\/\/', '') + '/' + (conf.headers_directory || 'headers'));
				for (let item of def_list){
					completion_item_list.push(item);
				}
		});

	});
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.SSLlanguageServer || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'SSLlanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	let pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnosic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnosic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnosic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnosic);
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connlog('We received an file change event');
});


// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		return completion_item_list;
	}
);

function load_completion() {
	const yaml = require('js-yaml');
	const fs = require('fs');
	try {
		const completion_map = yaml.safeLoad(fs.readFileSync(__dirname + '/completion.yml', 'utf8'));
		let item: any;
		let completion_item_list = []

		for (item in completion_map) {
			let kind = parseInt(completion_map[item]['type']);
			let element: any;

			for (element of completion_map[item]['items']) {
				completion_item_list.push({ label: element['name'], kind: kind, documentation: element['doc'], detail: element['detail'] });
			}
		}
		return completion_item_list;
	} catch (e) {
		connlog(e);
	}
};

function get_defines(headers_dir: string) {
	const { readdirSync, statSync, stat } = require('fs')
	const path = require('path');
	var walkDirSync = function (directoryName: string) {
		var files = readdirSync(directoryName);
		var result: string[] = [];
		files.forEach(function (file: string) {
			let subfile = statSync(directoryName + path.sep + file);
			if (subfile.isDirectory()) {
				for (var subfileName of walkDirSync(directoryName + path.sep + file)) {
					if (path.extname(subfileName) == '.h') {
						result.push(file + path.sep + subfileName);
					}
				}
			} else {
				if (path.extname(file) == '.h') {
					result.push(file);
				}
			}

		})
		return result;
	}

	connlog(headers_dir);

	var full_def_list: Array<any> =[];
	var file;
	for (file of walkDirSync(headers_dir)) {
		connlog(file);
		var def_list = defines_from_file(path.join(headers_dir, file));
		for (let item of def_list)
			full_def_list.push(item);
	}
	return full_def_list;
}


function defines_from_file(file_path: string) {
	const fs = require('fs');
	var def_list: Array<any>;
	var proc_list: Array<any>;
	var combined_list: Array<any>;

	var code = fs.readFileSync(file_path, 'utf8');

	var line: string;
	var proc_name: string;
	var proc_detail: string;
	var proc_doc: "";
	var proc_kind: 3; //function
	var proc_regex = /procedure\\b[[:blank:]]+(\\w+)(\\(.+\\))?[[:blank:]]+begin/;

	var def_name: string;
	var def_detail: string;
	var def_doc: "";
	var def_kind: 6; //variable
	var def_regex = /^[ \t]*#define[ \t]+(\S+)[ \t]*((?:.*\\\r?\n)*.*)/gm;

	var match: any;
	var def: string;
	def_list = code.match(def_regex);
	let result: Array<any> = [];
	if (!def_list)
		return result;

	match = def_regex.exec(code);
	while (match != null) {

		// This is necessary to avoid infinite loops with zero-width matches
    if (match.index === def_regex.lastIndex) {
			def_regex.lastIndex++;
		}

		def_name = match[1];
		def_detail = match[2];
		result.push({ label: def_name, kind: def_kind, documentation: def_doc, detail: def_detail });
		match = def_regex.exec(code);
	}
	return result;
}

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		let connection = createConnection(process.stdin, process.stdout);
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function connlog(item: any) {
	switch (typeof(item)) {
		case "number":
			connection.console.log(item);
			break;
		case "boolean":
			connection.console.log(item);
			break;
		case "undefined":
			connection.console.log(item);
			break;
		case "string":
			connection.console.log(item);
			break;
		default:
			connection.console.log(JSON.stringify(item));
			break;
	}
}
