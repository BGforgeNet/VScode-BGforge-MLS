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
	Hover
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
			hoverProvider : true
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

	completion_item_list = load_completion();
	connection.workspace.getWorkspaceFolders().then(function (workspacefolders) {
		connection.workspace.getConfiguration('ssl').then(function (conf: any) {
			var procdef_list = get_defines(workspacefolders[0].uri.replace('file:\/\/', '') + '/' + (conf.headers_directory || 'headers'));
			var def_list = procdef_list[0];
			var proc_list = procdef_list[1];
			for (let item of def_list) {
				//skip duplicates
				var present = completion_item_list.filter(function (el: any) {
					return (el.label == item.label && el.detail == item.detail);
				})
				if (present.length == 0) {
					completion_item_list.push({ label: item.label, kind: item.kind, documentation: item.documentation, detail: item.detail});
				}
			}

			for (let item of proc_list) {
				//skip duplicates
				var present = completion_item_list.filter(function (el: any) {
					return (el.label == item.label && el.detail == item.detail);
				})
				if (present.length == 0) {
					completion_item_list.push({ label: item.label, kind: item.kind, documentation: item.documentation, detail: item.detail});
				}
			}
		});
	});
});

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
			(change.settings.ssl || defaultSettings)
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
			section: 'ssl'
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
	conlog('We received an file change event');
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
		conlog(e);
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

	var full_def_list: Array<any> = [];
	var full_proc_list: Array<any> = [];
	var file;
	for (file of walkDirSync(headers_dir)) {
		const fs = require('fs');
		var file_path = path.join(headers_dir, file);
		var code = fs.readFileSync(file_path, 'utf8');

		var def_list = defines_from_file(code);
		for (let item of def_list)
			full_def_list.push({ label: item.label, kind: item.kind, documentation: file, detail: item.detail, filename: file_path, vars: item.vars});

		var proc_list = procs_from_file(code);
		for (let item of proc_list)
			full_proc_list.push({ label: item.label, kind: item.kind, documentation: file, detail: item.detail, filename: file_path, vars: item.vars});
	}
	return [full_def_list, full_proc_list];
}


//function defines_from_file(file_path: string) {
function defines_from_file(code: string) {;
	var def_list: Array<any> = [];

	var def_name: string;
	var def_detail: string;
	var def_doc = "";
	var def_regex = /^[ \t]*#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]*((?:.*\\\r?\n)*.*)/gm;

	var match: any;
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
		def_detail = match[3];
		var def_vars = "";
		var def_kind = 21; //constant
		if (match[2]) {
			def_vars = match[2]; 
			def_kind = 3; //function
		}
		result.push({ label: def_name, kind: def_kind, documentation: def_doc, detail: def_detail, vars: def_vars});
		match = def_regex.exec(code);
	}
	return result;
}

function procs_from_file(code: string) {
	var proc_list: Array<any> = [];

	var proc_name: string;
	var proc_detail = "";
	var proc_doc = "";
	var proc_kind = 3; //function
	var proc_vars = "";
	var proc_regex = /procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/gm;
	var match: any;
	var vars_re = /variable[\s]/gi; //remove "variable " from tooltip

	proc_list = code.match(proc_regex);
	let result: Array<any> = [];
	if (!proc_list)
		return result;

	match = proc_regex.exec(code);
	while (match != null) {
		// This is necessary to avoid infinite loops with zero-width matches
		if (match.index === proc_regex.lastIndex) {
			proc_regex.lastIndex++;
		}

		proc_name = match[1];
		proc_vars = "";
		proc_detail = match[1];
		if (match[2]) {
			proc_vars = match[2].replace(vars_re, "");
			proc_detail = proc_detail + "(" + proc_vars + ")";
		}
		result.push({ label: proc_name, kind: proc_kind, documentation: proc_doc, detail: proc_detail, vars: proc_vars});
		match = proc_regex.exec(code);
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

function conlog(item: any) {
	switch (typeof (item)) {
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


/*
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VS Code.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	params.contentChanges.
});

connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VS Code.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	var text = params.textDocument.text;
});
*/


/*
connection.onHover(({ textDocument, position }): Hover => {
	var line = textDocument.uri.
	for(var i = 0; i < names.length; i++) {
		if(names[i].line == position.line
				&& (names[i].start <= position.character && names[i].end >= position.character) )
		{
				return {
						contents: names[i].text
				};
		}
	}
});
*/
/*
connection.onHover(
	(p : TextDocumentPositionParams) : Hover => {}
		conlog(p.position.character);
		conlog(p.position.line);
		const fs = require('fs');
		var line = fs.readFileSync(p.textDocument.uri.replace("file://",""), 'utf8')[p.position.line];
		conlog(line);
		return {
				//contents: "xxxxx" + p.position.character + ", yyyyy" + p.position.line,
				//contents: p.textDocument.uri.charAt(p.position.character),
				contents: get_word_at(line, p.position.character),
				range : {
						start : {line: 0, character: 0},
						end : {line: 0, character: 10}
				}
		}
	}
);


function get_word_at(str: string, pos: number) {
	// Search for the word's beginning and end.
	var left = str.slice(0, pos + 1).search(/\S+$/),
			right = str.slice(pos).search(/\s/);

	// The last word in the string is a special case.
	if (right < 0) {
			return str.slice(left);
	}

	// Return the word, using the located bounds to extract it from the string.
	return str.slice(left, right + pos);
}
*/
