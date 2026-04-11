/**
 * Fallout scripts.lst language provider.
 * Provides column-aligned formatting for scripts.lst files.
 */

import { conlog } from "../common";
import { LANG_FALLOUT_SCRIPTS_LST } from "../core/languages";
import type { FormatResult } from "../core/capabilities";
import type { LanguageProvider, ProviderBase, ProviderContext, FormattingCapability } from "../language-provider";
import { formatScriptsLst } from "./format";

class FalloutScriptsLstProvider implements ProviderBase, FormattingCapability {
    readonly id = LANG_FALLOUT_SCRIPTS_LST;

    async init(_context: ProviderContext): Promise<void> {
        conlog("Fallout scripts.lst provider initialized");
    }

    format(text: string, _uri: string): FormatResult {
        return formatScriptsLst(text);
    }
}

export const falloutScriptsLstProvider: LanguageProvider = new FalloutScriptsLstProvider();
