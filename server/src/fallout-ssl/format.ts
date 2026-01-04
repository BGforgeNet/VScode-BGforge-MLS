/**
 * SSL formatting for LSP.
 */

import { TextEdit, Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { connection } from "../server";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit } from "../shared/format-utils";
import { formatDocument as formatAst, FormatOptions, FormatError } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";

const DEFAULT_INDENT = 4;
const DEFAULT_MAX_LINE_LENGTH = 120;

export async function initFormatter(): Promise<void> {
    if (isInitialized()) return;
    await initParser();
    conlog("Fallout SSL formatter initialized");
}

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? DEFAULT_INDENT, maxLineLength: DEFAULT_MAX_LINE_LENGTH };
    } catch {
        return { indentSize: DEFAULT_INDENT, maxLineLength: DEFAULT_MAX_LINE_LENGTH };
    }
}

function formatErrorsToDiagnostics(errors: FormatError[]): Diagnostic[] {
    return errors.map(err => ({
        severity: DiagnosticSeverity.Error,
        range: {
            start: { line: err.line - 1, character: err.column - 1 },
            end: { line: err.line - 1, character: err.column - 1 + 10 },
        },
        message: err.message,
        source: "ssl-format",
    }));
}

export function formatDocument(text: string, uri: string): TextEdit[] {
    if (!isInitialized()) {
        connection.window.showWarningMessage("SSL formatter not initialized");
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        connection.window.showWarningMessage("Failed to parse SSL document for formatting");
        return [];
    }

    const options = getFormatOptions(uri);
    const result = formatAst(tree.rootNode, options);

    // Send format errors as diagnostics (empty array clears previous)
    const diagnostics = formatErrorsToDiagnostics(result.errors);
    connection.sendDiagnostics({ uri, diagnostics });

    return createFullDocumentEdit(text, result.text);
}
