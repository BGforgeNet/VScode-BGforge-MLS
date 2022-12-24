'use strict';

import {
	Diagnostic,
	DiagnosticSeverity,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as common from './common';
import { conlog } from './common';
import { connection, documents } from './server';
import * as path from 'path';

const lang_id = 'fallout-ssl';
const ssl_ext = '.ssl';

export function load_defines(completion_map: Map<string, Array<any>>, signature_map: Map<string, Array<any>>, procdef_list: Array<any>) {
	const completion_list = completion_map.get(lang_id) || [];
	const def_list = procdef_list[0];
	const proc_list = procdef_list[1];
	for (const item of def_list) {
		// skip duplicates
		const present = completion_list.filter(function (el: any) {
			return (el.label == item.label);
		})
		if (present.length == 0) {
			completion_list.push({ label: item.label, kind: item.kind, documentation: { "kind": "markdown", "value": item.source }, detail: item.detail, fulltext: item.fulltext, source: item.source });
		}
	}

	for (const item of proc_list) {
		// skip duplicates
		const present = completion_list.filter(function (el: any) {
			return (el.label == item.label);
		})
		if (present.length == 0) {
			completion_list.push({ label: item.label, kind: item.kind, documentation: { "kind": "markdown", "value": item.source }, detail: item.detail, source: item.source });
		}
	}

	completion_map.set(lang_id, completion_list);
	const signature_list = get_signature_list(completion_map);
	signature_map.set("fallout-ssl", signature_list);

}

export function reload_defines(completion_map: Map<string, Array<any>>, signature_map: Map<string, Array<any>>, filename: string, code: string) {
	let completion_list = completion_map.get(lang_id) || [];
	let signature_list = signature_map.get(lang_id) || [];
	const new_defines = defines_from_file(code);
	filename = common.fname(filename);
	for (const item of new_defines) {
		item.source = filename;
	}
	const new_procs = procs_from_file(code);
	for (const item of new_procs) {
		item.source = filename;
	}
	//delete old defs from this file
	completion_list = completion_list.filter(item => item.source !== filename);
	signature_list = signature_list.filter(item => item.source !== filename);
	//delete defines redefined in current file
	completion_list = completion_list.filter(item => new_defines.filter(def_item => def_item.label == item.label).length == 0);
	completion_list = completion_list.filter(item => new_procs.filter(proc_item => proc_item.label == item.label).length == 0);
	load_defines(completion_map, signature_map, [new_defines, new_procs]);
}


//function defines_from_file(file_path: string) {
function defines_from_file(code: string) {
	let def_list: Array<any> = [];

	let def_name: string;
	let def_fulltext: string;
	const def_regex = /^[ \t]*#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]*((?:.*\\\r?\n)*.*)/gm;
	let def_detail = "";
	let match: any;
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
		let def_vars = "";
		let def_kind = 21;  // constant
		def_detail = def_name;
		if (match[2]) {
			def_vars = match[2];
			def_kind = 3;  // function
			def_detail = `${def_name}(${def_vars})`;
		}
		result.push({ label: def_name, kind: def_kind, documentation: "", detail: def_detail, fulltext: def_fulltext, vars: def_vars });
		match = def_regex.exec(code);
	}
	return result;
}


function procs_from_file(code: string) {
	let proc_list: Array<any> = [];

	let proc_name: string;
	let proc_detail = "";
	let proc_doc = "";
	let proc_kind = 3;  // function
	let proc_vars = "";
	const proc_regex = /procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/gm;
	let match: any;
	const vars_re = /variable[\s]/gi;  // remove "variable " from tooltip

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

export function get_defines(headers_dir: string) {
	const { readdirSync, statSync, stat } = require('fs')
	const path = require('path');
	const walkDirSync = function (directoryName: string) {
		const files = readdirSync(directoryName);
		const result: string[] = [];
		files.forEach(function (file: string) {
			const subfile = statSync(path.join(directoryName, file));
			if (subfile.isDirectory()) {
				for (let subfileName of walkDirSync(path.join(directoryName, file))) {
					if (path.extname(subfileName) == '.h') {
						result.push(path.join(file, subfileName));
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

	let full_def_list: Array<any> = [];
	let full_proc_list: Array<any> = [];
	for (const file of walkDirSync(headers_dir)) {
		const fs = require('fs');
		const file_path = path.join(headers_dir, file);
		const code = fs.readFileSync(file_path, 'utf8');

		const def_list = defines_from_file(code);
		for (let item of def_list) {
			if (item.fulltext && item.vars) {  // only show parenthesis when have vars
				full_def_list.push({ label: item.label, kind: item.kind, detail: `${item.label}(${item.vars})`, source: file, vars: item.vars, fulltext: item.fulltext });
			} else {  // no vars, show only define itself
				full_def_list.push({ label: item.label, kind: item.kind, detail: item.label, source: file, vars: item.vars, fulltext: item.fulltext });
			}
		}

		const proc_list = procs_from_file(code);
		for (let item of proc_list)
			full_proc_list.push({ label: item.label, kind: item.kind, detail: item.detail, source: file, vars: item.vars });
	}
	return [full_def_list, full_proc_list];
}

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
