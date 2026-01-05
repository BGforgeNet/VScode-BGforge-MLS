/**
 * Fallout SSL language provider.
 * Implements all Fallout SSL file features in one place.
 */

import { TextEdit } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_FALLOUT_SSL } from "../core/languages";
import { LanguageProvider, ProviderContext } from "../language-provider";
import { formatDocument, initFormatter } from "./format";
import { isInitialized } from "./parser";

export const falloutSslProvider: LanguageProvider = {
    id: LANG_FALLOUT_SSL,

    async init(_context: ProviderContext): Promise<void> {
        await initFormatter();
        conlog("Fallout SSL provider initialized");
    },

    format(text: string, uri: string): TextEdit[] {
        if (!isInitialized()) {
            return [];
        }
        return formatDocument(text, uri);
    },
};
