/**
 * WeiDU D language provider.
 * Implements all D file features in one place.
 */

import { DocumentSymbol, Location, Position, TextEdit } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_D } from "../lang-ids";
import { LanguageProvider } from "../language-provider";
import { getIndentFromEditorconfig } from "../shared/editorconfig";
import { createFullDocumentEdit, validateFormatting } from "../shared/format-utils";
import { fileURLToPath } from "url";
import { getDefinition } from "./definition";
import { formatDocument as formatAst, FormatOptions } from "./format-core";
import { initParser, getParser, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";

const DEFAULT_INDENT = 4;

const DEFAULT_LINE_LIMIT = 120;

function getFormatOptions(uri: string): FormatOptions {
    try {
        const filePath = fileURLToPath(uri);
        const indentSize = getIndentFromEditorconfig(filePath);
        return { indentSize: indentSize ?? DEFAULT_INDENT, lineLimit: DEFAULT_LINE_LIMIT };
    } catch {
        return { indentSize: DEFAULT_INDENT, lineLimit: DEFAULT_LINE_LIMIT };
    }
}

export const weiduDProvider: LanguageProvider = {
    id: LANG_WEIDU_D,

    async init(): Promise<void> {
        await initParser();
        conlog("WeiDU D provider initialized");
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
            conlog(`D formatter bug: ${validationError}`);
            return [];
        }

        return createFullDocumentEdit(text, result.text);
    },

    symbols(text: string): DocumentSymbol[] {
        return getDocumentSymbols(text);
    },

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    },
};
