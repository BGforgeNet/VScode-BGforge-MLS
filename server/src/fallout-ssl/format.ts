import { TextEdit, Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";
// Using 'ini' instead of 'editorconfig' package because editorconfig depends on
// @one-ini/wasm which requires a .wasm file that doesn't bundle properly with esbuild
import { parse as parseIni } from "ini";
import { conlog } from "../common";
import { connection } from "../server";
import { formatDocument as formatAst, FormatOptions, FormatError, setLogger } from "./format-core";
import { initParser, getParser, isInitialized } from "../format/parser";

export async function initFormatter(): Promise<void> {
    if (isInitialized()) return;
    setLogger(conlog);
    await initParser();
    conlog("Fallout SSL formatter initialized");
}

function matchesGlob(fileName: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern.startsWith("*.")) {
        const extPattern = pattern.slice(2);
        const braceMatch = extPattern.match(/^\{(.+)\}$/);
        if (braceMatch) {
            const extensions = braceMatch[1].split(",");
            return extensions.some(ext => fileName.endsWith("." + ext.trim()));
        }
        return fileName.endsWith("." + extPattern);
    }
    return fileName === pattern;
}

function getIndentFromEditorconfig(filePath: string): number | null {
    const fileName = path.basename(filePath);
    let dir = path.dirname(filePath);
    let result: number | null = null;

    while (true) {
        const configPath = path.join(dir, ".editorconfig");
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, "utf-8");
                const config = parseIni(content);
                // Later matching sections override earlier ones
                for (const section of Object.keys(config)) {
                    if (matchesGlob(fileName, section)) {
                        const indent = config[section].indent_size;
                        if (typeof indent === "number") {
                            result = indent;
                        } else if (typeof indent === "string") {
                            const parsed = parseInt(indent, 10);
                            if (!isNaN(parsed)) result = parsed;
                        }
                    }
                }
                if (result !== null) return result;
                if (config.root === true || config.root === "true") break;
            } catch {
                // Ignore read errors
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return result;
}

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? 4 };
    } catch {
        return { indentSize: 4 };
    }
}

function formatErrorsToDiagnostics(errors: FormatError[]): Diagnostic[] {
    return errors.map(err => ({
        severity: DiagnosticSeverity.Error,
        range: {
            start: { line: err.line - 1, character: err.column - 1 },
            end: { line: err.line - 1, character: err.column - 1 + 10 }, // Approximate word length
        },
        message: err.message,
        source: "ssl-format",
    }));
}

export function formatDocument(text: string, uri: string): TextEdit[] {
    if (!isInitialized()) {
        connection.window.showWarningMessage("Formatter not initialized");
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        connection.window.showWarningMessage("Failed to parse document for formatting");
        return [];
    }

    const options = getFormatOptions(uri);
    const result = formatAst(tree.rootNode, options);

    // Send format errors as diagnostics (empty array clears previous)
    const diagnostics = formatErrorsToDiagnostics(result.errors);
    connection.sendDiagnostics({ uri, diagnostics });

    const lines = text.split("\n");
    const lastLine = lines[lines.length - 1];

    return [TextEdit.replace({
        start: { line: 0, character: 0 },
        end: { line: lines.length - 1, character: lastLine.length },
    }, result.text)];
}
