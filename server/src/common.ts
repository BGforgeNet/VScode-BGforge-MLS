import * as fs from "fs";
import * as path from "path";
import { DiagnosticSeverity, Diagnostic } from "vscode-languageserver/node";
import { CompletionItemEx } from "./completion";
import { HoverEx } from "./hover";
import { connection } from "./server";
import * as fg from "fast-glob";
import { URI } from "vscode-uri";
import { Definition } from "./definition";
import { pathToFileURL } from 'node:url';

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


export type DataType = "static" | "header" | "self";

export interface DynamicData {
    completion: Array<CompletionItemEx>;
    hover: Map<string, HoverEx>;
    definition: Definition;
}

export interface ParseItem {
    file: string;
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

export function sendParseResult(uri: string, parseResult: ParseResult) {
    const diagSource = "BGforge MLS";
    const errors = parseResult.errors;
    const warnings = parseResult.warnings;

    const diagnostics: Diagnostic[] = [];

    for (const e of errors) {
        const diagnosic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: e.line - 1, character: e.columnStart },
                end: { line: e.line - 1, character: e.columnEnd },
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
                start: { line: w.line - 1, character: w.columnStart },
                end: { line: w.line - 1, character: w.columnEnd },
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
    return URI.parse(uri_string).path;
}

export function pathToUri(filePath: string) {
    const cwd = process.cwd();
    const fullPath = path.join(cwd, filePath);
    const uri = pathToFileURL(fullPath)
    return uri.toString();
}

// https://stackoverflow.com/questions/72119570/why-doesnt-vs-code-typescript-recognize-the-indices-property-on-the-result-of-r
// https://github.com/microsoft/TypeScript/issues/44227
export type RegExpMatchArrayWithIndices = RegExpMatchArray & { indices: Array<[number, number]> };
