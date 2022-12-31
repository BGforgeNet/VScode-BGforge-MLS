import { realpathSync } from "fs";
import * as path from "path";
import { DiagnosticSeverity, Diagnostic } from "vscode-languageserver/node";
import { CompletionItemEx } from "./completion";
import { HoverEx } from "./hover";
import { connection } from "./server";

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

// get word under cursor
export function get_word_at(str: string, pos: number) {
    // Search for the word's beginning and end.
    const left = str.slice(0, pos + 1).search(/\w+$/),
        right = str.slice(pos).search(/\W/);
    // The last word in the string is a special case.
    if (right < 0) {
        return str.slice(left);
    }
    // Return the word, using the located bounds to extract it from the string.
    return str.slice(left, right + pos);
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

export function send_parse_result(uri: string, parse_result: ParseResult) {
    const diag_src = "BGforge MLS";
    const errors = parse_result.errors;
    const warnings = parse_result.warnings;

    const diagnostics: Diagnostic[] = [];

    for (const e of errors) {
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: e.line - 1, character: e.column_start },
                end: { line: e.line - 1, character: e.column_end },
            },
            message: `${e.message}`,
            source: diag_src,
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
            source: diag_src,
        };
        diagnostics.push(diagnosic);
    }

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: uri, diagnostics: diagnostics });
}

/** Check if 1st dir contains the 2nd
 */
export function is_subdir(outer_path: string, inner_path: string) {
    const inner_real = realpathSync(inner_path);
    const outer_real = realpathSync(outer_path);
    if (inner_real.startsWith(outer_real)) {
        return true;
    }
    return false;
}

export function is_header(filepath: string, lang_id: string) {
    if (path.extname(filepath) == "h" && lang_id == "fallout-ssl") {
        return true;
    }
    return false;
}
