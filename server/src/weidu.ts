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

import { URI } from 'vscode-uri';
import * as common from './common';
import { conlog } from './common';
import { connection, documents } from './server';
import * as path from 'path';

let lang_id = 'weidu';
let valid_extensions = new Map([
	[".tp2", "tp2"],
	[".tph", "tpa"],
	[".tpa", "tpa"],
	[".tpp", "tpp"],
	[".d", "d"],
	[".baf", "baf"]
]);


function parse_compile_output(text: string) {
	let errors_pattern = /\[(\S+)\]\s+(?:PARSE\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
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

function parse_gcc_output(text: string) {
	let errors_pattern = /((\S+)\.tpl):(\d+):(\d+): error:.*/g;
	let errors = [];
	let warnings: any[] = [];

	try {
		let match: any;
		while ((match = errors_pattern.exec(text)) != null) {
			// This is necessary to avoid infinite loops with zero-width matches
			if (match.index === errors_pattern.lastIndex) {
				errors_pattern.lastIndex++;
			}
			errors.push({ file: match[1], line: parseInt(match[3]), col_start: parseInt(match[4]), col_end: parseInt((match[0]).length), message: text });
		};

	} catch (err) {
		conlog(err);
	}
	return [errors, warnings];
}

function send_diagnostics(text_document: TextDocument, output_text: string, format = 'weidu') {
	let errors_warnings = [];
	if (format == 'gcc') {
		errors_warnings = parse_gcc_output(output_text);
	} else {
		errors_warnings = parse_compile_output(output_text);
	}
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
	ext = ext.toLowerCase();
	let tpl = false;
	let real_name = base_name // filename without .tpl
	let real_path = filepath;
	if (ext == '.tpl') {
		tpl = true;
		real_name = base_name.substring(0, base_name.length - 4);
		real_path = real_path.substring(0, real_path.length - 4);
		ext = path.parse(real_name).ext;
	}
	let weidu_path = args[3];
	let game_path = args[4];
	let weidu_args = "--no-exit-pause --noautoupdate --debug-assign --parse-check";
	if (game_path == "") { // d and baf need game files
		weidu_args = `--nogame ${weidu_args}`;
	} else {
		weidu_args = `--game ${game_path} ${weidu_args}`;
	}

	if (command == "extension.bgforge.compile") {
		let weidu_type = valid_extensions.get(ext);
		if (!weidu_type) { //vscode loses open file if clicked on console or elsewhere
			conlog("Not a WeiDU file (tp2, tph, tpa, tpp, d, baf) or template! Focus a WeiDU file to parse.");
			connection.window.showInformationMessage("Focus a WeiDU file or template to parse!");
			return;
		}

		if ((weidu_type == 'd' || weidu_type == 'baf') && game_path == '') {
			conlog("Path to IE game is not specified in settings, can't parse D or BAF!");
			connection.window.showWarningMessage("Path to IE game is not specified in settings, can't parse D or BAF!");
			return;
		}

		const cp = require('child_process');

		// preprocess
		let preprocess_failed = false;
		if (tpl == true) {
			conlog(`preprocessing ${base_name}...`);
			let gcc_args = ['-E', '-x', 'c', '-P', '-Wundef', '-Werror', '-Wfatal-errors', '-o', `${real_name}`, `${base_name}`]
			let result = cp.spawnSync('gcc', gcc_args, { cwd: cwd_to });
			conlog('stdout: ' + result.stdout);
			if (result.stderr) { conlog('stderr: ' + result.stderr); }
			if (result.status != 0) {
				conlog('error: ' + result.status);
				connection.window.showErrorMessage(`Failed to preprocess ${base_name}!`);
				send_diagnostics(documents.get(text_document.uri.external), result.stderr, 'gcc');
				preprocess_failed = true;
			} else {
				connection.window.showInformationMessage(`Succesfully preprocessed ${base_name}.`);
			}
		}
		if (preprocess_failed) { return 1 };

		// parse
		conlog(`parsing ${real_name}...`);
		let weidu_cmd = `${weidu_path} ${weidu_args} ${weidu_type} ${real_name} `;
		cp.exec(weidu_cmd, { cwd: cwd_to }, (err: any, stdout: any, stderr: any) => {
			conlog('stdout: ' + stdout);
			let errors_warnings = parse_compile_output(stdout); //dupe, yes
			conlog(errors_warnings);
			if (stderr) { conlog('stderr: ' + stderr); }
			if ( (err && (err.code != 0))
					|| (errors_warnings[0].length > 0) // weidu doesn't always return non-zero on parse failure?
					|| (errors_warnings[1].length > 0)
			) {
				conlog('error: ' + err);
				conlog(errors_warnings);
				connection.window.showErrorMessage(`Failed to parse ${real_name}!`);
				if (tpl == false) {
					send_diagnostics(documents.get(text_document.uri.external), stdout);
				}
			} else {
				connection.window.showInformationMessage(`Succesfully parsed ${real_name}.`);
			}
		});
	}
}
