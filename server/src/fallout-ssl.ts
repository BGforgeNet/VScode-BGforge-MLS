'use strict';

import {
	CompletionItemKind,
	Diagnostic,
	DiagnosticSeverity,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as common from './common';
import { CompletionItemEx, HoverEx, conlog } from './common';
import { connection, documents } from './server';
import * as path from 'path';
import { HeaderData } from './common';
import { readFileSync } from 'fs';

import { MarkupKind } from 'vscode-languageserver/node';

const fallout_ssl_config = 'bgforge.falloutSSL';

interface HeaderDataList {
	defines: DefineList
	procedures: ProcList
}

interface ProcListItem {
	label: string
	detail: string
}
interface ProcList extends Array<ProcListItem> { }
interface DefineListItem {
	label: string
	detail: string
	constant: boolean
	multiline: boolean
	firstline: string
}
interface DefineList extends Array<DefineListItem> { }

const lang_id = 'fallout-ssl';
const ssl_ext = '.ssl';

export async function load_defines() {
	let completion_list: Array<CompletionItemEx> = [];
	let hover_map = new Map<string, HoverEx>();
	const config = await connection.workspace.getConfiguration(fallout_ssl_config);
	let headers_dir = config.headersDirectory;
	const headers_list = find_headers(headers_dir);

	for (const header_path of headers_list) {
		const text = readFileSync(header_path, 'utf8');
		const header_data = parse_header(text);

		for (const define of header_data.defines) {
			let markdown_value: string;
			if (define.multiline) {
				markdown_value = [
					'```' + `${lang_id}`,
					`${define.detail}`,
					'```'
				].join('\n');
			} else {
				markdown_value = [
					'```' + `${lang_id}`,
					`${define.firstline}`,
					'```'
				].join('\n');
			}
			let completion_kind;
			if (define.constant) {
				completion_kind = CompletionItemKind.Constant;
			} else {
				// there's no good icon for macros, using something distinct from function
				completion_kind = CompletionItemKind.Field;
			}
			let markdown = { kind: MarkupKind.Markdown, value: markdown_value };	
			// const completion_item = { label: define.label, documentation: markdown_content, source: header_path, labelDetails: {detail: "ld1", description: "ld2"}, detail: header_path };
			const completion_item = { label: define.label, documentation: markdown, source: header_path, detail: header_path, kind: completion_kind };
			completion_list.push(completion_item);

			markdown_value = `${markdown_value}\n\`${header_path}\``
			markdown = { kind: MarkupKind.Markdown, value: markdown_value };
			const hover_item = { contents: markdown, source: header_path };
			hover_map.set(define.label, hover_item);
		}

		for (const proc of header_data.procedures) {
			let markdown_value: string;
			markdown_value = [
				'```' + `${lang_id}`,
				`${proc.detail}`,
				'```'
			].join('\n');
			const markdown_content = { kind: MarkupKind.Markdown, value: markdown_value };
			const completion_item = { label: proc.label, documentation: markdown_content, source: header_path, detail: header_path, kind: CompletionItemKind.Function };
			completion_list.push(completion_item);
			const hover_item = { contents: markdown_content, source: header_path };
			hover_map.set(proc.label, hover_item);
		}

	}
	const result: HeaderData = { completion: completion_list, hover: hover_map };
	return result;
}

// export function reload_defines(completion_map: Map<string, Array<any>>, signature_map: Map<string, Array<any>>, filename: string, code: string) {
// 	let completion_list = completion_map.get(lang_id) || [];
// 	let signature_list = signature_map.get(lang_id) || [];
// 	const new_defines = defines_from_file(code);
// 	filename = common.fname(filename);
// 	for (const item of new_defines) {
// 		item.source = filename;
// 	}
// 	const new_procs = procs_from_file(code);
// 	for (const item of new_procs) {
// 		item.source = filename;
// 	}
// 	//delete old defs from this file
// 	completion_list = completion_list.filter(item => item.source !== filename);
// 	signature_list = signature_list.filter(item => item.source !== filename);
// 	//delete defines redefined in current file
// 	completion_list = completion_list.filter(item => new_defines.filter(def_item => def_item.label == item.label).length == 0);
// 	completion_list = completion_list.filter(item => new_procs.filter(proc_item => proc_item.label == item.label).length == 0);
// 	load_defines(completion_map, signature_map, [new_defines, new_procs]);
// }

// 	if (conf.headers_directory != "NONE") {
// 		try {
// 			let procdef_list = fallout_ssl.get_defines(conf.headers_directory);
// 			fallout_ssl.load_defines(completion_map, signature_map, procdef_list);
// 		} catch (e) {
// 			conlog(e);
// 		}
// 	}

function parse_header(text: string) {
	// defines
	let define_list: DefineList = [];
	const define_regex = /^#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]+(.+)/gm;
	const constant_regex = /^[A-Z0-9_]+/;
	let match = define_regex.exec(text);
	while (match != null) {
		// This is necessary to avoid infinite loops with zero-width matches
		if (match.index === define_regex.lastIndex) {
			define_regex.lastIndex++;
		}

		const define_name = match[1];
		let define_firstline = match[3];
		define_firstline = define_firstline.trimEnd();

		// check if it's multiline
		let multiline = false;
		if (define_firstline.endsWith("\\")) {
			multiline = true;
		}

		// check if it has vars
		let define_detail = define_name;
		if (match[2]) {  // function-like macro
			let define_vars = match[2];
			define_detail = `${define_name}(${define_vars})`;
		}

		// check if it's looks like a constant
		// a more elaborate analysis could catch more constants
		// this is deliberately simple to encourage better and more consistent code style
		let constant = false;
		if (!multiline && constant_regex.test(define_name)) {
			constant = true;
		}
		define_list.push({ label: define_name, constant: constant, detail: define_detail, multiline: multiline, firstline: define_firstline });
		match = define_regex.exec(text);
	}

	// procedures
	let proc_list: ProcList = [];
	const proc_regex = /procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/gm;
	const vars_replace_regex = /variable[\s]/gi;  // remove "variable " from tooltip

	match = proc_regex.exec(text);
	while (match != null) {
		// This is necessary to avoid infinite loops with zero-width matches
		if (match.index === proc_regex.lastIndex) {
			proc_regex.lastIndex++;
		}
		const proc_name = match[1];
		let proc_detail = proc_name;
		if (match[2]) {
			const proc_vars = match[2].replace(vars_replace_regex, "");
			proc_detail = `${proc_name}(${proc_vars})`;
		}
		proc_list.push({ label: proc_name, detail: proc_detail });
		match = proc_regex.exec(text);
	}

	const result: HeaderDataList = {
		defines: define_list,
		procedures: proc_list
	}
	return result;
}

function parse_compile_output(text: string) {
	const errors_pattern = /\[Error\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
	const warnings_pattern = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
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
	const errors_warnings = parse_compile_output(output_text);
	const errors = errors_warnings[0];
	const warnings = errors_warnings[1];

	let diagnostics: Diagnostic[] = [];
	for (const e of errors) {
		const diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: { line: e.line - 1, character: e.column },
				end: text_document.positionAt(text_document.offsetAt({ line: e.line, character: 0 }) - 1)
			},
			message: `${e.message}`,
			source: common.diag_src
		};
		diagnostics.push(diagnosic);
	}
	for (const w of warnings) {
		const diagnosic: Diagnostic = {
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

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: text_document.uri, diagnostics });
}

function find_headers(dirName: string) {
	const fg = require('fast-glob');
	const entries = fg.sync(['**/*.h'], { cwd: dirName, caseSensitiveMatch: false });
	return entries;
}

// export function get_defines(headers_dir: string) {
// 	const { readdirSync, statSync, stat } = require('fs')
// 	const path = require('path');
// 	const walkDirSync = function (directoryName: string) {
// 		const files = readdirSync(directoryName);
// 		const result: string[] = [];
// 		files.forEach(function (file: string) {
// 			const subfile = statSync(path.join(directoryName, file));
// 			if (subfile.isDirectory()) {
// 				for (let subfileName of walkDirSync(path.join(directoryName, file))) {
// 					if (path.extname(subfileName) == '.h') {
// 						result.push(path.join(file, subfileName));
// 					}
// 				}
// 			} else {
// 				if (path.extname(file) == '.h') {
// 					result.push(file);
// 				}
// 			}

// 		})
// 		return result;
// 	}

// 	let full_def_list: Array<any> = [];
// 	let full_proc_list: Array<any> = [];
// 	for (const file of walkDirSync(headers_dir)) {
// 		const fs = require('fs');
// 		const file_path = path.join(headers_dir, file);
// 		const code = fs.readFileSync(file_path, 'utf8');

// 		const def_list = defines_from_file(code);
// 		for (let item of def_list) {
// 			if (item.fulltext && item.vars) {  // only show parenthesis when have vars
// 				full_def_list.push({ label: item.label, kind: item.kind, detail: `${item.label}(${item.vars})`, source: file, vars: item.vars, fulltext: item.fulltext });
// 			} else {  // no vars, show only define itself
// 				full_def_list.push({ label: item.label, kind: item.kind, detail: item.label, source: file, vars: item.vars, fulltext: item.fulltext });
// 			}
// 		}

// 		const proc_list = procs_from_file(code);
// 		for (let item of proc_list)
// 			full_proc_list.push({ label: item.label, kind: item.kind, detail: item.detail, source: file, vars: item.vars });
// 	}
// 	return [full_def_list, full_proc_list];
// }

export function sslcompile(params: any, cancel_token: any) {
	const command = params.command;
	const args: Array<any> = params.arguments;
	const compile_cmd = args[1];
	const text_document: any = args[0];
	const dst_dir = args[2];
	const filepath = text_document.fileName;
	const cwd_to = path.dirname(filepath);
	const base_name = path.parse(filepath).base;
	const base = path.parse(filepath).name;
	const dst_path = path.join(dst_dir, base + '.int');
	const ext = path.parse(filepath).ext;

	if (command == "extension.bgforge.compile") {
		if (ext.toLowerCase() != ssl_ext) {  // vscode loses open file if clicked on console or elsewhere
			conlog("Not a Fallout SSL file! Please focus a Fallout SSL file to compile.");
			connection.window.showInformationMessage("Please focus a Fallout SSL file to compile!");
			return;
		}
		conlog(`compiling ${base_name}...`);
		const cp = require('child_process');

		cp.exec(compile_cmd + " " + base_name + ' -o ' + dst_path, { cwd: cwd_to }, (err: any, stdout: any, stderr: any) => {
			conlog('stdout: ' + stdout);
			if (stderr) { conlog('stderr: ' + stderr); }
			if (err) {
				conlog('error: ' + err);
				connection.window.showErrorMessage(`Failed to compile ${base_name}!`);
			} else {
				connection.window.showInformationMessage(`Succesfully compiled ${base_name}.`);
			}
			send_diagnostics(documents.get(text_document.uri.external), stdout);
		});
	}
}

//get everything between parenthesis
function get_args(str: string) {
	const match = str.match(/\((.*)\)/)
	if (match && match.length > 1) {
		return match[1];
	}
	return "";
}

// filter out defines from other opened ssl files
export function filter_completion(completion_list: Array<any>, filename: string) {
	filename = common.fname(filename);
	const current_list = completion_list.filter(function (el: any) {
		return (!el.source.endsWith(".ssl") || (el.source.endsWith(".ssl") && filename == el.source));
	});
	return current_list;
};

export function get_signature_list(completion_map: Map<string, Array<any>>) {
	let signature_list: Array<any> = [];
	for (let lang of completion_map.keys()) {
		const completion_list = completion_map.get(lang);
		// generate signature list
		for (let item of completion_list) {
			if (item.detail && (typeof item.detail === 'string') && item.detail.includes("(")) {  // has vars
				let args = get_args(item.detail);
				if (args) {
					let signature = { label: item.label, documentation: `(${args})`, source: item.source };
					signature_list.push(signature);
				}
			}
		}
	}
	return signature_list;
}
