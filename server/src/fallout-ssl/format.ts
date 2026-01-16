/**
 * SSL formatting for LSP.
 */

import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { FormatResult } from "../language-provider";
import { getConnection } from "../lsp-connection";
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

export function formatDocument(text: string, uri: string): FormatResult {
    if (!isInitialized()) {
        return { edits: [], warning: "SSL formatter not initialized" };
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return { edits: [], warning: "Failed to parse SSL document for formatting" };
    }

    const options = getFormatOptions(uri);
    const result = formatAst(tree.rootNode, options);

    // Send format errors as diagnostics (empty array clears previous, fire-and-forget)
    const diagnostics = formatErrorsToDiagnostics(result.errors);
    void getConnection().sendDiagnostics({ uri, diagnostics });

    return { edits: createFullDocumentEdit(text, result.text) };
}
