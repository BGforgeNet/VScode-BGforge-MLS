"use strict";

import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import * as common from "./common";
import { conlog } from "./common";
import { connection } from "./server";
import * as path from "path";
import * as cp from "child_process";
import { URI } from "vscode-uri";

const valid_extensions = new Map([
    [".tp2", "tp2"],
    [".tph", "tpa"],
    [".tpa", "tpa"],
    [".tpp", "tpp"],
    [".d", "d"],
    [".baf", "baf"],
]);

function parse_compile_output(text: string) {
    const errors_pattern = /\[(\S+)\]\s+(?:PARSE\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
    const errors = [];

    try {
        let match: RegExpExecArray;
        while ((match = errors_pattern.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errors_pattern.lastIndex) {
                errors_pattern.lastIndex++;
            }
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                col_start: parseInt(match[3]),
                col_end: parseInt(match[4]),
                message: text,
            });
        }
    } catch (err) {
        conlog(err);
    }
    return [errors, []];
}

function parse_gcc_output(text: string) {
    const errors_pattern = /((\S+)\.tpl):(\d+):(\d+): error:.*/g;
    const errors = [];

    try {
        let match: RegExpExecArray;
        while ((match = errors_pattern.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errors_pattern.lastIndex) {
                errors_pattern.lastIndex++;
            }
            errors.push({
                file: match[1],
                line: parseInt(match[3]),
                col_start: parseInt(match[4]),
                col_end: match[0].length,
                message: text,
            });
        }
    } catch (err) {
        conlog(err);
    }
    return [errors, []];
}

function send_diagnostics(uri_string: string, output_text: string, format = "weidu") {
    let errors_warnings = [];
    if (format == "gcc") {
        errors_warnings = parse_gcc_output(output_text);
    } else {
        errors_warnings = parse_compile_output(output_text);
    }
    const errors = errors_warnings[0];

    const diagnostics: Diagnostic[] = [];
    for (const e of errors) {
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: e.line - 1, character: e.col_start - 1 },
                end: { line: e.line - 1, character: e.col_end },
            },
            message: `${e.message}`,
            source: common.diag_src,
        };
        diagnostics.push(diagnosic);
    }
    connection.sendDiagnostics({ uri: uri_string, diagnostics });
}

// export function wcompile(params: any) {
export function wcompile(uri_string: string, weidu_path: string, game_path: string) {
    const filepath = URI.parse(uri_string).fsPath;
    const cwd_to = path.dirname(filepath);
    const base_name = path.parse(filepath).base;
    let ext = path.parse(filepath).ext;
    ext = ext.toLowerCase();
    let tpl = false;
    let real_name = base_name; // filename without .tpl
    if (ext == ".tpl") {
        tpl = true;
        real_name = base_name.substring(0, base_name.length - 4);
        ext = path.parse(real_name).ext;
    }

    let weidu_args = "--no-exit-pause --noautoupdate --debug-assign --parse-check";
    if (game_path == "") {
        // d and baf need game files
        weidu_args = `--nogame ${weidu_args}`;
    } else {
        weidu_args = `--game ${game_path} ${weidu_args}`;
    }

    const weidu_type = valid_extensions.get(ext);
    if (!weidu_type) {
        // vscode loses open file if clicked on console or elsewhere
        conlog(
            "Not a WeiDU file (tp2, tph, tpa, tpp, d, baf, tpl) or template! Focus a WeiDU file to parse."
        );
        connection.window.showInformationMessage("Focus a WeiDU file or template to parse!");
        return;
    }

    if ((weidu_type == "d" || weidu_type == "baf") && game_path == "") {
        conlog("Path to IE game is not specified in settings, can't parse D or BAF!");
        connection.window.showWarningMessage(
            "Path to IE game is not specified in settings, can't parse D or BAF!"
        );
        return;
    }

    // preprocess
    let preprocess_failed = false;
    if (tpl == true) {
        conlog(`preprocessing ${base_name}...`);
        const gcc_args = [
            "-E",
            "-x",
            "c",
            "-P",
            "-Wundef",
            "-Werror",
            "-Wfatal-errors",
            "-o",
            `${real_name}`,
            `${base_name}`,
        ];
        const result = cp.spawnSync("gcc", gcc_args, { cwd: cwd_to });
        conlog("stdout: " + result.stdout);
        if (result.stderr) {
            conlog("stderr: " + result.stderr);
        }
        if (result.status != 0) {
            conlog("error: " + result.status);
            connection.window.showErrorMessage(`Failed to preprocess ${base_name}!`);
            send_diagnostics(uri_string, result.stderr.toString(), "gcc");
            preprocess_failed = true;
        } else {
            connection.window.showInformationMessage(`Succesfully preprocessed ${base_name}.`);
        }
    }
    if (preprocess_failed) {
        return 1;
    }

    // parse
    conlog(`parsing ${real_name}...`);
    const weidu_cmd = `${weidu_path} ${weidu_args} ${weidu_type} ${real_name} `;
    cp.exec(weidu_cmd, { cwd: cwd_to }, (err: cp.ExecException, stdout: string, stderr: string) => {
        conlog("stdout: " + stdout);
        const errors_warnings = parse_compile_output(stdout); //dupe, yes
        conlog(errors_warnings);
        if (stderr) {
            conlog("stderr: " + stderr);
        }
        if (
            (err && err.code != 0) ||
            errors_warnings[0].length > 0 || // weidu doesn't always return non-zero on parse failure?
            errors_warnings[1].length > 0
        ) {
            conlog("error: " + err.message);
            conlog(errors_warnings);
            connection.window.showErrorMessage(`Failed to parse ${real_name}!`);
            if (tpl == false) {
                send_diagnostics(uri_string, stdout);
            }
        } else {
            connection.window.showInformationMessage(`Succesfully parsed ${real_name}.`);
        }
    });
}
