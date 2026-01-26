/**
 * SSL formatting for LSP.
 */

import { conlog } from "../common";
import { FormatResult } from "../language-provider";
import { getFormatOptions } from "../shared/format-options";
import { createFullDocumentEdit } from "../shared/format-utils";
import { formatDocument as formatAst } from "./format-core";
import { initParser as initTreeSitter, parseWithCache, isInitialized } from "./parser";

export async function initParser(): Promise<void> {
    if (isInitialized()) return;
    await initTreeSitter();
    conlog("Fallout SSL formatter initialized");
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
