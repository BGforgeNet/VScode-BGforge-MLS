import * as fs from "fs";
import * as path from "path";
import { DiagnosticSeverity, Diagnostic } from "vscode-languageserver/node";
import { CompletionItemEx } from "./completion";
import { HoverEx } from "./hover";
import { connection } from "./server";
import * as fg from "fast-glob";
import { URI } from "vscode-uri";

export function fname(uri: string) {
    return path.basename(uri);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function conlog(item: any) {
    switch (typeof item) {
        case "number":
            connection.console.log(item.toString());
            break;
        case "boolean":
            connection.console.log(item.toString());
            break;
        case "undefined":
            connection.console.log(item);
            break;
        case "string":
            connection.console.log(item);
            break;
        default:
            if (item.size && item.size > 0 && JSON.stringify(item) == "{}") {
                connection.console.log(JSON.stringify([...item]));
            } else {
                connection.console.log(JSON.stringify(item));
            }
            break;
    }
}

export interface DynamicData {
    completion: Array<CompletionItemEx>;
    hover: Map<string, HoverEx>;
}

export interface ParseItem {
    file: string;
    line: number;
    column_start: number;
    column_end: number;
    message: string;
}
export interface ParseItemList extends Array<ParseItem> {}

export interface ParseResult {
    errors: ParseItemList;
    warnings: ParseItemList;
}

export function sendParseResult(uri: string, parseResult: ParseResult) {
    const diagSource = "BGforge MLS";
    const errors = parseResult.errors;
    const warnings = parseResult.warnings;

    const diagnostics: Diagnostic[] = [];

    for (const e of errors) {
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: e.line - 1, character: e.column_start },
                end: { line: e.line - 1, character: e.column_end },
            },
            message: `${e.message}`,
            source: diagSource,
        };
        diagnostics.push(diagnosic);
    }
    for (const w of warnings) {
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: {
                start: { line: w.line - 1, character: w.column_start },
                end: { line: w.line - 1, character: w.column_end },
            },
            message: `${w.message}`,
            source: diagSource,
        };
        diagnostics.push(diagnosic);
    }

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: uri, diagnostics: diagnostics });
}

/** Check if 1st dir contains the 2nd
 */
export function isSubpath(outer_path: string, inner_path: string) {
    const innerReal = fs.realpathSync(inner_path);
    const outerReal = fs.realpathSync(outer_path);
    if (innerReal.startsWith(outerReal)) {
        return true;
    }
    return false;
}

export function isDirectory(fspath: string) {
    if (fs.existsSync(fspath)) {
        return fs.lstatSync(fspath).isDirectory;
    }
}

export function isHeader(filepath: string, lang_id: string) {
    if (path.extname(filepath) == "h" && lang_id == "fallout-ssl") {
        return true;
    }
    return false;
}

/** find files in directory by extension */
export function findFiles(dirName: string, extension: string) {
    const entries = fg.sync(`**/*.${extension}`, { cwd: dirName, caseSensitiveMatch: false });
    return entries;
}

export function getRelPath(root: string, other_dir: string) {
    return path.relative(root, other_dir);
}

export function getFullPath(uri_string: string) {
    return URI.parse(uri_string).fsPath;
}
