/**
 * Fallout Worldmap TXT language provider.
 * Simple provider for worldmap.txt files with static completion and hover only.
 */

import { CompletionItem, Hover } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_FALLOUT_WORLDMAP_TXT } from "../core/languages";
import { Language, Features } from "../data-loader";
import { LanguageProvider, ProviderContext } from "../language-provider";

const features: Features = {
    completion: true,
    definition: false,
    hover: true,
    udf: false,
    headers: false,
    externalHeaders: false,
    parse: false,
    parseRequiresGame: false,
    signature: false,
    staticCompletion: true,
    staticHover: true,
    staticSignature: false,
};

/** Internal Language instance for data features */
let language: Language | undefined;

export const falloutWorldmapProvider: LanguageProvider = {
    id: LANG_FALLOUT_WORLDMAP_TXT,

    async init(context: ProviderContext): Promise<void> {
        language = new Language(LANG_FALLOUT_WORLDMAP_TXT, features, context.workspaceRoot);
        await language.init();
        conlog("Fallout Worldmap provider initialized");
    },

    getCompletions(uri: string): CompletionItem[] {
        return language?.completion(uri) ?? [];
    },

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
    },
};
