/**
 * Fallout message (.msg) language provider.
 * Provides whitespace-normalized formatting for .msg message files.
 */

import { conlog } from "../common";
import { LANG_FALLOUT_MSG } from "../core/languages";
import type { FormatResult } from "../core/capabilities";
import type { LanguageProvider, ProviderBase, ProviderContext, FormattingCapability } from "../language-provider";
import { formatMsg } from "./format";

class FalloutMsgProvider implements ProviderBase, FormattingCapability {
    readonly id = LANG_FALLOUT_MSG;

    async init(_context: ProviderContext): Promise<void> {
        conlog("Fallout MSG provider initialized");
    }

    format(text: string, _uri: string): FormatResult {
        return formatMsg(text);
    }
}

export const falloutMsgProvider: LanguageProvider = new FalloutMsgProvider();
