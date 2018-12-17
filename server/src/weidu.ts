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

import * as common from './common';
import { conlog } from './common';
import { connection, documents } from './server';
import * as path from 'path';

let lang_id = 'weidu';
let file_ext = '.tp2';

function parse_compile_output(text: string) {
	let errors_pattern = /\[(\S+)\] PARSE ERROR at line (\d+) column (\d+)-(\d+)/g;
//	let warnings_pattern = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
	let errors = [];
	let warnings: any[] = [];

	try {
		let match: any;
		while ((match = errors_pattern.exec(text)) != null) {
			// This is necessary to avoid infinite loops with zero-width matches
			if (match.index === errors_pattern.lastIndex) {
				errors_pattern.lastIndex++;
			}
			errors.push({ file: match[1], line: parseInt(match[2]), col_start: parseInt(match[3]), col_end: parseInt(match[4]), message: text });
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

	let diagnostics: Diagnostic[] = [];
	for (let e of errors) {
		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: { line: e.line - 1, character: e.col_start - 1 },
				end: { line: e.line - 1, character: e.col_end },
			},
			message: `${e.message}`,
			source: common.diag_src
		};
		diagnostics.push(diagnosic);
	}
	/*
	for (let w of warnings) {
		let diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: { line: w.line - 1, character: w.column },
				end: text_document.positionAt(text_document.offsetAt({ line: w.line, character: 0 }) - 1)
			},
			message: `${w.message}`,
			source: common.diag_src
		};
		diagnostics.push(diagnosic);
	}
	*/
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: text_document.uri, diagnostics });
}


export function wcompile(params: any, cancel_token: any) {
	var command = params.command;
	var args: Array<any> = params.arguments;
	var text_document: any = args[1];
	var filepath = text_document.fileName;
	var cwd_to = path.dirname(filepath);
	var base_name = path.parse(filepath).base;
	var ext = path.parse(filepath).ext;
	let weidu_path = args[3];
	let dev_null = get_dev_null();
	let weidu_args = `--nogame --no-exit-pause --skip-at-view --noautoupdate --uninstall --language 0 --log ${dev_null}`;
	let weidu_cmd = `${weidu_path} ${weidu_args} ${base_name}`;

	if (command == "extension.bgforge.compile") {
		if (ext != file_ext) { //vscode loses open file if clicked on console or elsewhere
			conlog("Not a WeiDU TP2 file! Please focus a WeiDU TP2 file to compile.");
			connection.window.showInformationMessage("Please focus a WeiDU TP2 file to compile!");
			return;
		}
		conlog(`compiling ${base_name}...`);
		const cp = require('child_process');

		cp.exec(weidu_cmd, { cwd: cwd_to }, (err: any, stdout: any, stderr: any) => {
			conlog('stdout: ' + stdout);
			let errors_warnings = parse_compile_output(stdout); //dupe, yes
			if (stderr) { conlog('stderr: ' + stderr); }
			if (err) {
				conlog('error: ' + err);
				connection.window.showErrorMessage(`Failed to compile ${base_name}!`);
			} else {
				if (errors_warnings[0].length == 0)  { //weidu returns 0 on parse error
					connection.window.showInformationMessage(`Succesfully compiled ${base_name}.`);
				} else {
					conlog(errors_warnings);
					connection.window.showErrorMessage(`Failed to compile ${base_name}!`);
				}
				send_diagnostics(documents.get(text_document.uri.external), stdout);
			}
		});
	}
}

function get_dev_null() {
	let os = require('os');
	let dev_null: string;
	if (os.platform() == "win32") {
		dev_null = "nul"
	} else {
		dev_null = "/dev/null"
	}
	return dev_null;
}
