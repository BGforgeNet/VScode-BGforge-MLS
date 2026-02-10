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

/** Expand leading ~ to the user's home directory. execFile doesn't use a shell, so ~ is not expanded. */
export function expandHome(filePath: string): string {
    if (filePath.startsWith("~/") || filePath === "~") {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- logging accepts any value
export function conlog(item: any): void {
    const log = getConnection().console.log.bind(getConnection().console);
    if (item === undefined) {
        log("undefined");
        return;
    }
    if (typeof item === "string") {
        log(item);
        return;
    }
    if (typeof item === "number" || typeof item === "boolean") {
        log(item.toString());
        return;
    }
    if (item instanceof Map) {
        log(JSON.stringify([...item]));
        return;
    }
    try {
        log(JSON.stringify(item));
    } catch {
        log(String(item));
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

/**
 * Compilers may output results for different files.
 * If we use tmp file for processing, then tmp file uri should be replaced with main file uri
 * @param parseResult ParseResult
 * @param mainUri uri of the file we're parsing
 * @param tmpUri uri of tmpFile used to dump unsaved changed to for parsing
 */
export function sendParseResult(parseResult: ParseResult, mainUri: string, tmpUri: string) {
    const diagSource = "BGforge MLS";
    const diagnostics = new Map<string, Diagnostic[]>();

    function addDiagnostic(item: ParseItem, severity: DiagnosticSeverity) {
        const diagnostic: Diagnostic = {
            severity,
            range: {
                start: { line: item.line - 1, character: item.columnStart },
                end: { line: item.line - 1, character: item.columnEnd },
            },
            message: `${item.message}`,
            source: diagSource,
        };
        const uri = item.uri === tmpUri ? mainUri : item.uri;
        const existing = diagnostics.get(uri) ?? [];
        diagnostics.set(uri, [...existing, diagnostic]);
    }

    for (const e of parseResult.errors) {
        addDiagnostic(e, DiagnosticSeverity.Error);
    }
    for (const w of parseResult.warnings) {
        addDiagnostic(w, DiagnosticSeverity.Warning);
    }

    for (const [uri, diags] of diagnostics) {
        void getConnection().sendDiagnostics({ uri, diagnostics: diags });
    }
}

/** Check if 1st dir contains the 2nd */
export function isSubpath(outerPath: string | undefined, innerPath: string): boolean {
    if (outerPath === undefined) {
        return false;
    }
    try {
        const innerReal = fs.realpathSync(innerPath);
        const outerReal = fs.realpathSync(outerPath);
        const rel = path.relative(outerReal, innerReal);
        return !rel.startsWith("..") && !path.isAbsolute(rel);
    } catch {
        return false;
    }
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

/** Known wrapper commands that may prefix executable paths in user settings. */
const KNOWN_WRAPPERS = new Set(["wine", "wine64", "mono", "dotnet", "flatpak"]);

/**
 * Split a command-line setting into executable and prefix arguments.
 * Only splits when the first token is a known wrapper (e.g., "wine ~/bin/compile").
 * Plain paths (even with spaces) pass through as-is with tilde expansion.
 * This avoids breaking paths that contain spaces like "/opt/my tools/compile".
 */
export function parseCommandPath(commandPath: string): { executable: string; prefixArgs: string[] } {
    const trimmed = commandPath.trim();
    if (trimmed === "") {
        return { executable: commandPath, prefixArgs: [] };
    }

    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex === -1) {
        // Single token, no splitting needed
        return { executable: expandHome(trimmed), prefixArgs: [] };
    }

    const firstToken = trimmed.slice(0, spaceIndex);
    if (KNOWN_WRAPPERS.has(firstToken.toLowerCase())) {
        const rest = trimmed.slice(spaceIndex + 1).trim();
        return {
            executable: firstToken,
            prefixArgs: rest ? [expandHome(rest)] : [],
        };
    }

    // Not a known wrapper - treat entire string as the executable path
    return { executable: expandHome(trimmed), prefixArgs: [] };
}

/** Get the relative path from `root` to `other_dir`. */
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

/** Extract the text from the start of the line up to the cursor position. */
export function getLinePrefix(text: string, position: Position): string {
    return text.split("\n")[position.line]?.substring(0, position.character) ?? "";
}

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
