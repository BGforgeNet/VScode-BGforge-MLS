/**
 * WeiDU D formatting for LSP.
 */

import { TextEdit } from "vscode-languageserver/node";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { connection } from "../server";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";

const DEFAULT_INDENT = 4;

export async function initFormatter(): Promise<void> {
    if (isInitialized()) return;
    await initParser();
    conlog("WeiDU D formatter initialized");
}

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? DEFAULT_INDENT };
    } catch {
        return { indentSize: DEFAULT_INDENT };
    }
}

export function formatDocument(text: string, uri: string): TextEdit[] {
    if (!isInitialized()) {
        connection.window.showWarningMessage("WeiDU D formatter not initialized");
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        connection.window.showWarningMessage("Failed to parse D document for formatting");
        return [];
    }

    const options = getFormatOptions(uri);
    const result = formatAst(tree.rootNode, options);

    const validationError = validateFormatting(text, result.text);
    if (validationError) {
        connection.window.showErrorMessage(`D formatter bug: ${validationError}`);
        return [];
    }

    return createFullDocumentEdit(text, result.text);
}
