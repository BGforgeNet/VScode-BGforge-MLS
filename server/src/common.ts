/**
 * Common utilities shared across the language server.
 * Includes logging, file path manipulation, glob helpers, and diagnostic creation.
 */

import * as fg from "fast-glob";
import * as fs from "fs";
import { pathToFileURL } from "node:url";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { Diagnostic, DiagnosticSeverity, Position } from "vscode-languageserver/node";
import { getConnection } from "./lsp-connection";


export const tmpDir = path.join(os.tmpdir(), "bgforge-mls");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function conlog(item: any): void {
    const log = getConnection().console.log.bind(getConnection().console);
    switch (typeof item) {
        case "number":
            log(item.toString());
            break;
        case "boolean":
            log(item.toString());
            break;
        case "undefined":
            log("undefined");
            break;
        case "string":
            log(item);
            break;
        default:
            // Handle objects including Maps - check if item has Map-like iteration
            if (item !== null && typeof item === "object" && typeof item.size === "number" && item.size > 0) {
                // Likely a Map, use spread to get entries
                log(JSON.stringify([...item]));
            } else {
                log(JSON.stringify(item));
            }
            break;
    }
}

interface ParseItem {
    uri: string;
    line: number;
    columnStart: number;
    columnEnd: number;
    message: string;
}
export interface ParseItemList extends Array<ParseItem> { }

export interface ParseResult {
    errors: ParseItemList;
    warnings: ParseItemList;
}

export interface Diagnostics extends Map<string, Diagnostic> { }

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
        // Send the computed diagnostics to VSCode (fire-and-forget notification)
        void getConnection().sendDiagnostics({ uri: uri, diagnostics: [diag] });
    }
}

/** Check if 1st dir contains the 2nd
 */
export function isSubpath(outerPath: string | undefined, innerPath: string) {
    if (outerPath === undefined) {
        return false;
    }
    const innerReal = fs.realpathSync(innerPath);
    const outerReal = fs.realpathSync(outerPath);
    return innerReal.startsWith(outerReal);
}

export function isDirectory(fsPath: string): boolean {
    if (fs.existsSync(fsPath)) {
        return fs.lstatSync(fsPath).isDirectory();
    }
    return false;
}


/** find files in directory by extension */
export function findFiles(dirName: string, extension: string) {
    const entries = fg.sync(`**/*.${extension}`, { cwd: dirName, caseSensitiveMatch: false });
    return entries;
}

/**
 * TODO: deprecate and get rid of this in favour of `getRelPath2`
 * Get the relative path from `root` to `other_dir`
 * @param root
 * @param other_dir
 * @returns relative path. For some reason, may go up to root with ../'s
 */
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
    if (!str) {
        return "";
    }
    const pos = position.character;

    // Check if cursor is on the number inside a $tra(123) pattern (TBAF translation reference)
    // Only match when cursor is on the digits, not on $tra itself
    const traMatch = findTraArgumentAtPosition(str, pos);
    if (traMatch) {
        return traMatch;
    }

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

/**
 * Find if cursor is on the number argument inside a $tra(123) pattern.
 * Only returns match when cursor is on the digits, not on $tra itself.
 */
function findTraArgumentAtPosition(line: string, pos: number): string | null {
    // Match $tra(digits) and capture the digits with their position
    const pattern = /\$tra\((\d+)\)/g;
    for (const match of line.matchAll(pattern)) {
        if (!match[1]) continue;
        // $tra( is 5 characters, so digits start at match.index + 5
        const digitsStart = match.index + 5;
        const digitsEnd = digitsStart + match[1].length;
        // Only match if cursor is on the digits
        if (pos >= digitsStart && pos < digitsEnd) {
            return match[0];
        }
    }
    return null;
}

function onlyDigits(value: string) {
    return /^\d+$/.test(value);
}
