/**
 * WeiDU BAF language provider.
 * Implements all BAF file features in one place.
 */

import { TextEdit } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_BAF } from "../core/languages";
import { LanguageProvider } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { fileURLToPath } from "url";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";

const DEFAULT_INDENT = 4;

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? DEFAULT_INDENT };
    } catch {
        return { indentSize: DEFAULT_INDENT };
    }
}

export const weiduBafProvider: LanguageProvider = {
    id: LANG_WEIDU_BAF,

    async init(): Promise<void> {
        await initParser();
        conlog("WeiDU BAF provider initialized");
    },

    format(text: string, uri: string): TextEdit[] {
        if (!isInitialized()) {
            return [];
        }

        const tree = getParser().parse(text);
        if (!tree) {
            return [];
        }

        const options = getFormatOptions(uri);
        const result = formatAst(tree.rootNode, options);

        const validationError = validateFormatting(text, result.text);
        if (validationError) {
            conlog(`BAF formatter bug: ${validationError}`);
            return [];
        }

        return createFullDocumentEdit(text, result.text);
    },
};
