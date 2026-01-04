/**
 * BAF formatting for LSP.
 */

import { TextEdit } from "vscode-languageserver/node";
import { fileURLToPath } from "url";
import { conlog } from "../common";
import { connection } from "../server";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit } from "../shared/format-utils";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";

const DEFAULT_INDENT = 4;

export async function initFormatter(): Promise<void> {
    if (isInitialized()) return;
    await initParser();
    conlog("WeiDU BAF formatter initialized");
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
        connection.window.showWarningMessage("BAF formatter not initialized");
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        connection.window.showWarningMessage("Failed to parse BAF document for formatting");
        return [];
    }

    const options = getFormatOptions(uri);
    const result = formatAst(tree.rootNode, options);

    return createFullDocumentEdit(text, result.text);
}
