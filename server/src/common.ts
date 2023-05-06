import * as fg from "fast-glob";
import * as fs from "fs";
import { pathToFileURL } from "node:url";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { Diagnostic, DiagnosticSeverity, Position } from "vscode-languageserver/node";
import { connection } from "./server";

export function fname(uri: string) {
    return path.basename(uri);
}

export const tmpDir = path.join(os.tmpdir(), "bgforge-mls");

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
            connection.console.log("undefined");
            break;
        case "string":
            connection.console.log(item);
            break;
        default:
            if (item && item.size && item.size > 0 && JSON.stringify(item) == "{}") {
                if (JSON.stringify([...item]) == "{}") {
                    // map
                    connection.console.log(item);
                } else {
                    connection.console.log(JSON.stringify([...item]));
                }
            } else {
                connection.console.log(JSON.stringify(item));
            }
            break;
    }
}

export interface ParseItem {
    uri: string;
    line: number;
    columnStart: number;
    columnEnd: number;
    message: string;
}
export interface ParseItemList extends Array<ParseItem> {}

export interface ParseResult {
    errors: ParseItemList;
    warnings: ParseItemList;
}

export interface Diagnostics extends Map<string, Diagnostic> {}

/**
 * Compilers may output results for different files.
 * If we use tmp file for processing, then tmp file uri should be replaced with main file uri
 * @param parseResult ParseResult
 * @param mainUri uri of the file we're parsing
 * @param tmpUri uri of tmpFile used to dump unsaved changed to for parsing
 */
export function sendParseResult(parseResult: ParseResult, mainUri: string, tmpUri: string) {
    const diagSource = "BGforge MLS";
    const errors = parseResult.errors;
    const warnings = parseResult.warnings;

    const diagnostics: Diagnostics = new Map();

    for (const e of errors) {
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: e.line - 1, character: e.columnStart },
                end: { line: e.line - 1, character: e.columnEnd },
            },
            message: `${e.message}`,
            source: diagSource,
        };
        let uri = e.uri;
        if (uri == tmpUri) {
            uri = mainUri;
        }
        diagnostics.set(uri, diagnostic);
    }
    for (const w of warnings) {
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: {
                start: { line: w.line - 1, character: w.columnStart },
                end: { line: w.line - 1, character: w.columnEnd },
            },
            message: `${w.message}`,
            source: diagSource,
        };
        let uri = w.uri;
        if (uri == tmpUri) {
            uri = mainUri;
        }
        diagnostics.set(w.uri, diagnostic);
    }

    for (const [uri, diag] of diagnostics) {
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: uri, diagnostics: [diag] });
    }
}

/** Check if 1st dir contains the 2nd
 */
export function isSubpath(outerPath: string, innerPath: string) {
    const innerReal = fs.realpathSync(innerPath);
    const outerReal = fs.realpathSync(outerPath);
    if (innerReal.startsWith(outerReal)) {
        return true;
    }
    return false;
}

export function isDirectory(fsPath: string) {
    if (fs.existsSync(fsPath)) {
        return fs.lstatSync(fsPath).isDirectory;
    }
}

export function isHeader(filePath: string, langId: string) {
    if (path.extname(filePath) == "h" && langId == "fallout-ssl") {
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

export function uriToPath(uri_string: string) {
    return fileURLToPath(uri_string);
}

export function pathToUri(filePath: string) {
    const uri = pathToFileURL(filePath);
    return uri.toString();
}

// https://stackoverflow.com/questions/72119570/why-doesnt-vs-code-typescript-recognize-the-indices-property-on-the-result-of-r
// https://github.com/microsoft/TypeScript/issues/44227
export type RegExpMatchArrayWithIndices = RegExpMatchArray & { indices: Array<[number, number]> };

/**
 * Get word under cursor, for which we want to find a hover
 * This a preliminary non-whitespace symbol, could look like `NOption(154,Node003,004`
 * or `NOption(154` or `NOption`
 * From that hover will extract the actual symbol or tra reference to search for.
 */
export function symbolAtPosition(text: string, position: Position) {
    const lines = text.split(/\r?\n/g);
    const str = lines[position.line];
    const pos = position.character;

    // Search for the word's beginning and end.
    let left = str.slice(0, pos + 1).search(/\w+$/),
        right = str.slice(pos).search(/\W/);

    let result: string;
    // The last word in the string is a special case.
    if (right < 0) {
        result = str.slice(left);
    } else {
        // Return the word, using the located bounds to extract it from the string.
        result = str.slice(left, right + pos);
    }

    // if a proper symbol, return
    if (!onlyDigits(result)) {
        return result;
    }

    // and if pure numeric, check if it's a tra reference
    if (onlyDigits(result)) {
        left = str.slice(0, pos + 1).search(/\S+$/);
        right = str.slice(pos).search(/\W/);
        if (right < 0) {
            result = str.slice(left);
        } else {
            result = str.slice(left, right + pos);
        }
    }

    return result;
}

function onlyDigits(value: string) {
    return /^\d+$/.test(value);
}
