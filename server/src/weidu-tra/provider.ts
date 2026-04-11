/**
 * WeiDU translation (.tra) language provider.
 * Provides whitespace-normalized formatting for .tra translation files.
 */

import { conlog } from "../common";
import { LANG_WEIDU_TRA } from "../core/languages";
import type { FormatResult } from "../core/capabilities";
import type { LanguageProvider, ProviderBase, ProviderContext, FormattingCapability } from "../language-provider";
import { formatTra } from "./format";

class WeiduTraProvider implements ProviderBase, FormattingCapability {
    readonly id = LANG_WEIDU_TRA;

    async init(_context: ProviderContext): Promise<void> {
        conlog("WeiDU TRA provider initialized");
    }

    format(text: string, _uri: string): FormatResult {
        return formatTra(text);
    }
}

export const weiduTraProvider: LanguageProvider = new WeiduTraProvider();
