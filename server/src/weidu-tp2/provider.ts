/**
 * WeiDU TP2 language provider.
 * Implements all TP2 file features in one place.
 *
 * Note: TP2 doesn't have a tree-sitter formatter yet, so format is not implemented.
 * Features like completion, hover, and definition are still handled by Galactus
 * until migrated here.
 */

import { conlog } from "../common";
import { LANG_WEIDU_TP2 } from "../core/languages";
import { LanguageProvider, ProviderContext } from "../language-provider";

export const weiduTp2Provider: LanguageProvider = {
    id: LANG_WEIDU_TP2,

    async init(_context: ProviderContext): Promise<void> {
        // TP2 doesn't need parser initialization yet (no tree-sitter formatter)
        conlog("WeiDU TP2 provider initialized");
    },

    // Note: format, completion, hover, definition, compile will be added
    // as features are migrated from Galactus
};
