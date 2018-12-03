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
import Uri from 'vscode-uri';
import * as path from 'path';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

let completion_item_list: Array<any> = [];
let signature_list: Array<any> = [];

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
	//load static completion
	completion_item_list = load_completion();

	//add completion from headers
	connection.workspace.getWorkspaceFolders().then(function (workspacefolders) {
		connection.workspace.getConfiguration('ssl').then(function (conf: any) {
			var procdef_list = get_defines(workspacefolders[0].uri.replace('file:\/\/', '') + '/' + (conf.headers_directory || 'headers'));
			load_defines(procdef_list);
		});
	});
});

function load_defines(procdef_list: Array<any>) {
	var def_list = procdef_list[0];
	var proc_list = procdef_list[1];
	for (let item of def_list) {
		//skip duplicates
		var present = completion_item_list.filter(function (el: any) {
			return (el.label == item.label && el.detail == item.detail);
		})
		if (present.length == 0) {
			completion_item_list.push({ label: item.label, kind: item.kind, documentation: item.source, detail: item.detail, fulltext: item.fulltext, source: item.source });
		}
	}

	for (let item of proc_list) {
		//skip duplicates
		var present = completion_item_list.filter(function (el: any) {
			return (el.label == item.label && el.detail == item.detail);
		})
		if (present.length == 0) {
			completion_item_list.push({ label: item.label, kind: item.kind, documentation: item.source, detail: item.detail, source: item.source });
		}
	}

	//generate signature list
	for (let item of completion_item_list) {
		if (item.detail && item.detail.includes("(")) { //has vars
			let args = get_args(item.detail);
			if (args) {
				let signature = { label: item.label, documentation: `(${args})`, source: item.source };
				signature_list.push(signature);
			}
		}
	}
}

function reload_defines(filename: string, code: string) {
	var new_defines = defines_from_file(code);
	filename = fname(filename);
	for (let item of new_defines) {
		item.source = filename;
	}
	var new_procs = procs_from_file(code);
	for (let item of new_procs) {
		item.source = filename;
	}
	//delete old defs from this file
	completion_item_list = completion_item_list.filter(item => item.source !== filename);
	signature_list = signature_list.filter(item => item.source !== filename);
	//delete defines redefined in current file
	completion_item_list = completion_item_list.filter(item => new_defines.filter(def_item => def_item.label == item.label).length == 0);
	completion_item_list = completion_item_list.filter(item => new_procs.filter(proc_item => proc_item.label == item.label).length == 0);
	load_defines([new_defines, new_procs]);
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
	reload_defines(Uri.parse(change.document.uri).fsPath, change.document.getText());
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
		var current_list = filter_completion(completion_item_list, _textDocumentPosition.textDocument.uri);;
		return current_list;
	}
);

//filter out defines from other opened ssl files
function filter_completion(completion_item_list: Array<any>, filename: string) {
	filename = fname(filename);
	var current_list = completion_item_list.filter(function (el: any) {
		return (!el.source || (!el.source.endsWith(".ssl")) || (el.source.endsWith(".ssl") && filename == el.source));
	});
	return current_list;
};

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
				completion_item_list.push({ label: element['name'], kind: kind, documentation: element['doc'], detail: element['detail'], source: "builtin" });
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
		for (let item of def_list) {
			if (item.fulltext && item.vars) { //only show parenthesis when have vars
				full_def_list.push({ label: item.label, kind: item.kind, detail: `${item.label}(${item.vars})`, source: file, vars: item.vars, fulltext: item.fulltext });
			} else { //no vars, show only define itself
				full_def_list.push({ label: item.label, kind: item.kind, detail: item.label, source: file, vars: item.vars, fulltext: item.fulltext });
			}
		}

		var proc_list = procs_from_file(code);
		for (let item of proc_list)
			full_proc_list.push({ label: item.label, kind: item.kind, detail: item.detail, source: file, vars: item.vars });
	}
	return [full_def_list, full_proc_list];
}

//function defines_from_file(file_path: string) {
function defines_from_file(code: string) {
	var def_list: Array<any> = [];

	var def_name: string;
	var def_fulltext: string;
	var def_regex = /^[ \t]*#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]*((?:.*\\\r?\n)*.*)/gm;
	var def_detail = "";
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
		def_fulltext = match[3];
		var def_vars = "";
		var def_kind = 21; //constant
		def_detail = def_name;
		if (match[2]) {
			def_vars = match[2];
			def_kind = 3; //function
			def_detail = `${def_name}(${def_vars})`;
		}
		result.push({ label: def_name, kind: def_kind, documentation: "", detail: def_detail, fulltext: def_fulltext, vars: def_vars });
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
		result.push({ label: proc_name, kind: proc_kind, documentation: proc_doc, detail: proc_detail, vars: proc_vars });
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

function fname(uri: string) {
	return uri.split('/').pop();
}

//get word under cursor
function get_word_at(str: string, pos: number) {
	// Search for the word's beginning and end.
	var left = str.slice(0, pos + 1).search(/\w+$/), right = str.slice(pos).search(/\W/);
	// The last word in the string is a special case.
	if (right < 0) {
		return str.slice(left);
	}
	// Return the word, using the located bounds to extract it from the string.
	return str.slice(left, right + pos);
}

//get word before cursor's position (for signature)
function get_signature_word(str: string, pos: number) {
	//cut off last character and search for words
	const sliced = str.slice(0, pos);
	let lpos = sliced.indexOf(')');
	let matches = str.slice(lpos > 0 ? lpos : 0, pos).match(/(\w+)\(/g);
	if (matches) {
		var word = matches.pop().slice(0, -1);
		return word;
	}
}

//get everything between parenthesis
function get_args(str: string) {
	let match = str.match(/\((.*)\)/)
	if (match && match.length > 1) {
		return match[1];
	}
	return "";
}

connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover => {
	let text = documents.get(textDocumentPosition.textDocument.uri).getText();
	let lines = text.split(/\r?\n/g);
	let position = textDocumentPosition.position;
	var filename = fname(textDocumentPosition.textDocument.uri);

	let str = lines[position.line];
	let pos = position.character;
	let word = get_word_at(str, pos);

	if (word) {
		var present = completion_item_list.filter(function (el: any) {
			return (el.label == word);
		});
		present = filter_completion(present, filename);
		if (present.length > 0) {
			let item = present[0];
			if (item.detail || item.documentation) {
				var markdown;
				if (item.fulltext) { //full text for defines
					markdown = {
						kind: MarkupKind.Markdown,
						value: [
							'```c++', //yeah, so what?
							item.fulltext,
							'```',
							item.documentation
						].join('\n')
					};
				} else {
					markdown = {
						kind: MarkupKind.Markdown,
						value: [
							'```c++', //yeah, so what?
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
	let word = get_signature_word(str, pos);
	if (word) {
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
	var command = params.command;
	var args: Array<any> = params.arguments;
	var compile_exe = args[0];
	//var filepath = args[1];
	var text_document: any = args[1];
	var filepath = text_document.fileName;
	var dst_dir = args[2];
	var cwd_to = path.dirname(filepath);
	var base_name = path.parse(filepath).base;
	var base = path.parse(filepath).name;
	var dst_path = path.join(dst_dir, base + '.int');

	if (command == "extension.SSLcompile") {
		conlog("compiling...");
		const cp = require('child_process');

		cp.exec(compile_exe + " " + base_name + ' -o ' + dst_path, { cwd: cwd_to }, (err: any, stdout: any, stderr: any) => {
			conlog('stdout: ' + stdout);
			conlog('stderr: ' + stderr);
			if (err) {
				conlog('error: ' + err);
			}
			send_diagnostics(documents.get(text_document.uri.external), stdout);
		});
	}
});

function parse_compile_output(text: string) {
	let errors_pattern = /\[Error\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
	let warnings_pattern = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
	let errors = [];
	let warnings = [];

	try {
		let match: any;
		while ((match = errors_pattern.exec(text)) != null) {
			// This is necessary to avoid infinite loops with zero-width matches
			if (match.index === errors_pattern.lastIndex) {
				errors_pattern.lastIndex++;
			}
			let col: string;
			if (match[3] == "") { col = "0" } else { col = match[3] }
			errors.push({ file: match[1], line: parseInt(match[2]), column: parseInt(col), message: match[4] });
		};

		while ((match = warnings_pattern.exec(text)) != null) {
			// This is necessary to avoid infinite loops with zero-width matches
			if (match.index === warnings_pattern.lastIndex) {
				warnings_pattern.lastIndex++;
			};
			let col: string;
			if (match[3] == "") { col = "0" } else { col = match[3] };
			warnings.push({ file: match[1], line: parseInt(match[2]), column: parseInt(col), message: match[4] });
		};
	} catch (err) {
		conlog(err);
	}
	return [errors, warnings];
}

function send_diagnostics(text_document: TextDocument, output_text: string) {
	let errors_warnings = parse_compile_output(output_text);
	let errors = errors_warnings[0];
	let warnings = errors_warnings[1];
	let src = "BGforge SSL server";
	let diagnostics: Diagnostic[] = [];
	for (let e of errors) {
		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: { line: e.line - 1, character: e.column },
				end: text_document.positionAt(text_document.offsetAt({ line: e.line, character: 0 }) - 1)
			},
			message: `${e.message}`,
			source: src
		};
		diagnostics.push(diagnosic);
	}
	for (let w of warnings) {
		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: { line: w.line - 1, character: w.column },
				end: text_document.positionAt(text_document.offsetAt({ line: w.line, character: 0 }) - 1)
			},
			message: `${w.message}`,
			source: src
		};
		diagnostics.push(diagnosic);
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: text_document.uri, diagnostics });
}
