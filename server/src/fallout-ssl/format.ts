/**
 * SSL formatting for LSP.
 */

import { fileURLToPath } from "url";
import { conlog } from "../common";
import { FormatResult } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit } from "../shared/format-utils";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, parseWithCache, isInitialized } from "./parser";

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

export function formatDocument(text: string, uri: string): FormatResult {
    if (!isInitialized()) {
        return { edits: [], warning: "SSL formatter not initialized" };
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return { edits: [], warning: "Failed to parse SSL document for formatting" };
    }

    const options = getFormatOptions(uri);

    let result;
    try {
        result = formatAst(tree.rootNode, options);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        conlog(`SSL formatter error: ${msg}`);
        return { edits: [], warning: `SSL formatter error: ${msg}` };
    }

    return { edits: createFullDocumentEdit(text, result.text) };
}
