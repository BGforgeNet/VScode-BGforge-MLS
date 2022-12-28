"use strict";

import { CompletionItemKind, Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import * as common from "./common";
import {
    CompletionItemEx,
    HoverEx,
    conlog,
    CompletionList,
    HoverMap,
    CompletionListEx,
    HoverMapEx,
} from "./common";
import { connection, documents } from "./server";
import * as path from "path";
import { DynamicData } from "./common";
import { readFileSync } from "fs";
import { sync as fgsync } from "fast-glob";
import { MarkupKind } from "vscode-languageserver/node";
import * as cp from "child_process";
import { URI } from "vscode-uri";

const fallout_ssl_config = "bgforge.falloutSSL";

interface HeaderDataList {
    macros: DefineList;
    procedures: ProcList;
}

interface ProcListItem {
    label: string;
    detail: string;
}
interface ProcList extends Array<ProcListItem> {}
interface DefineListItem {
    label: string;
    detail: string;
    constant: boolean;
    multiline: boolean;
    firstline: string;
}
interface DefineList extends Array<DefineListItem> {}

const lang_id = "fallout-ssl";
const ssl_ext = ".ssl";

export async function load_data() {
    const completion_list: Array<CompletionItemEx> = [];
    const hover_map = new Map<string, HoverEx>();
    const config = await connection.workspace.getConfiguration(fallout_ssl_config);
    const headers_dir = config.headersDirectory;
    const headers_list = find_headers(headers_dir);

    for (const header_path of headers_list) {
        const text = readFileSync(header_path, "utf8");
        const header_data = find_symbols(text);
        load_macros(header_path, header_data, completion_list, hover_map);
        load_procedures(header_path, header_data, completion_list, hover_map);
    }
    const result: DynamicData = { completion: completion_list, hover: hover_map };
    return result;
}

function load_procedures(
    path: string,
    header_data: HeaderDataList,
    completion_list: CompletionList,
    hover_map: HoverMap
) {
    for (const proc of header_data.procedures) {
        const markdown_value = ["```" + `${lang_id}`, `${proc.detail}`, "```"].join("\n");
        const markdown_content = { kind: MarkupKind.Markdown, value: markdown_value };
        const completion_item = {
            label: proc.label,
            documentation: markdown_content,
            source: path,
            detail: path,
            kind: CompletionItemKind.Function,
        };
        completion_list.push(completion_item);
        const hover_item = { contents: markdown_content, source: path };
        hover_map.set(proc.label, hover_item);
    }
}

function load_macros(
    path: string,
    header_data: HeaderDataList,
    completion_list: CompletionList,
    hover_map: HoverMap
) {
    for (const macro of header_data.macros) {
        let markdown_value: string;
        if (macro.multiline) {
            markdown_value = ["```" + `${lang_id}`, `${macro.detail}`, "```"].join("\n");
        } else {
            markdown_value = ["```" + `${lang_id}`, `${macro.firstline}`, "```"].join("\n");
        }
        let completion_kind;
        if (macro.constant) {
            completion_kind = CompletionItemKind.Constant;
        } else {
            // there's no good icon for macros, using something distinct from function
            completion_kind = CompletionItemKind.Field;
        }
        let markdown = { kind: MarkupKind.Markdown, value: markdown_value };
        // const completion_item = { label: define.label, documentation: markdown_content, source: header_path, labelDetails: {detail: "ld1", description: "ld2"}, detail: header_path };
        const completion_item = {
            label: macro.label,
            documentation: markdown,
            source: path,
            detail: path,
            kind: completion_kind,
        };
        completion_list.push(completion_item);

        markdown_value = `${markdown_value}\n\`${path}\``;
        markdown = { kind: MarkupKind.Markdown, value: markdown_value };
        const hover_item = { contents: markdown, source: path };
        hover_map.set(macro.label, hover_item);
    }
}

export function reload_data(
    path: string,
    text: string,
    completion: CompletionListEx | undefined,
    hover: HoverMapEx | undefined
) {
    const symbols = find_symbols(text);
    if (completion == undefined) {
        completion = [];
    }
    const new_completion = completion.filter((item) => item.source != path);
    if (hover == undefined) {
        hover = new Map();
    }
    const new_hover = new Map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Array.from(hover).filter(([key, value]) => {
            if (value.source != path) {
                return true;
            }
            return false;
        })
    );

    load_macros(path, symbols, new_completion, new_hover);
    load_procedures(path, symbols, new_completion, new_hover);
    const result: DynamicData = { completion: new_completion, hover: new_hover };
    return result;
}

function find_symbols(text: string) {
    // defines
    const define_list: DefineList = [];
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
        if (match[2]) {
            // function-like macro
            const define_vars = match[2];
            define_detail = `${define_name}(${define_vars})`;
        }

        // check if it's looks like a constant
        // a more elaborate analysis could catch more constants
        // this is deliberately simple to encourage better and more consistent code style
        let constant = false;
        if (!multiline && constant_regex.test(define_name)) {
            constant = true;
        }
        define_list.push({
            label: define_name,
            constant: constant,
            detail: define_detail,
            multiline: multiline,
            firstline: define_firstline,
        });
        match = define_regex.exec(text);
    }

    // procedures
    const proc_list: ProcList = [];
    const proc_regex = /procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/gm;
    const vars_replace_regex = /variable[\s]/gi; // remove "variable " from tooltip

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
        macros: define_list,
        procedures: proc_list,
    };
    return result;
}

function parse_compile_output(text: string) {
    const errors_pattern = /\[Error\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const warnings_pattern = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const errors = [];
    const warnings = [];

    try {
        let match: RegExpExecArray;
        while ((match = errors_pattern.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errors_pattern.lastIndex) {
                errors_pattern.lastIndex++;
            }
            let col: string;
            if (match[3] == "") {
                col = "0";
            } else {
                col = match[3];
            }
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(col),
                message: match[4],
            });
        }

        while ((match = warnings_pattern.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === warnings_pattern.lastIndex) {
                warnings_pattern.lastIndex++;
            }
            let col: string;
            if (match[3] == "") {
                col = "0";
            } else {
                col = match[3];
            }
            warnings.push({
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(col),
                message: match[4],
            });
        }
    } catch (err) {
        conlog(err);
    }
    return [errors, warnings];
}

function send_diagnostics(uri: string, output_text: string) {
    const text_document = documents.get(uri);
    const errors_warnings = parse_compile_output(output_text);
    const errors = errors_warnings[0];
    const warnings = errors_warnings[1];

    const diagnostics: Diagnostic[] = [];
    for (const e of errors) {
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: e.line - 1, character: e.column },
                end: text_document.positionAt(
                    text_document.offsetAt({ line: e.line, character: 0 }) - 1
                ),
            },
            message: `${e.message}`,
            source: common.diag_src,
        };
        diagnostics.push(diagnosic);
    }
    for (const w of warnings) {
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: {
                start: { line: w.line - 1, character: w.column },
                end: text_document.positionAt(
                    text_document.offsetAt({ line: w.line, character: 0 }) - 1
                ),
            },
            message: `${w.message}`,
            source: common.diag_src,
        };
        diagnostics.push(diagnosic);
    }

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: text_document.uri, diagnostics });
}

function find_headers(dirName: string) {
    const entries = fgsync(["**/*.h"], { cwd: dirName, caseSensitiveMatch: false });
    return entries;
}

export function sslcompile(uri_string: string, compile_cmd: string, dst_dir: string) {
    const filepath = URI.parse(uri_string).fsPath;
    const cwd_to = path.dirname(filepath);
    const base_name = path.parse(filepath).base;
    const base = path.parse(filepath).name;
    const dst_path = path.join(dst_dir, base + ".int");
    const ext = path.parse(filepath).ext;

    if (ext.toLowerCase() != ssl_ext) {
        // vscode loses open file if clicked on console or elsewhere
        conlog("Not a Fallout SSL file! Please focus a Fallout SSL file to compile.");
        connection.window.showInformationMessage("Please focus a Fallout SSL file to compile!");
        return;
    }
    conlog(`compiling ${base_name}...`);

    cp.exec(
        compile_cmd + " " + base_name + " -o " + dst_path,
        { cwd: cwd_to },
        (err: cp.ExecException, stdout: string, stderr: string) => {
            conlog("stdout: " + stdout);
            if (stderr) {
                conlog("stderr: " + stderr);
            }
            if (err) {
                conlog("error: " + err.message);
                connection.window.showErrorMessage(`Failed to compile ${base_name}!`);
            } else {
                connection.window.showInformationMessage(`Succesfully compiled ${base_name}.`);
            }
            send_diagnostics(uri_string, stdout);
        }
    );
}
