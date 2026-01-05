/**
 * WeiDU TP2 language provider.
 * Implements all TP2 file features in one place.
 *
 * Note: TP2 doesn't have a tree-sitter formatter yet, so format is not implemented.
 * Internally delegates data features to a Language instance for now.
 */

import { CompletionItem, Hover, Location } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_TP2 } from "../core/languages";
import { Language, Features } from "../language";
import { LanguageProvider, ProviderContext } from "../language-provider";
import { compile as weiduCompile } from "../weidu";

const features: Features = {
    completion: true,
    definition: true,
    hover: true,
    udf: true,
    headers: true,
    externalHeaders: false,
    parse: true,
    parseRequiresGame: false,
    signature: false,
    staticCompletion: true,
    staticHover: true,
    staticSignature: false,
};

/** Internal Language instance for data features */
let language: Language | undefined;
/** Stored context for compile settings access */
let storedContext: ProviderContext | undefined;

export const weiduTp2Provider: LanguageProvider = {
    id: LANG_WEIDU_TP2,

    async init(context: ProviderContext): Promise<void> {
        storedContext = context;

        // Initialize Language instance for data features
        language = new Language(LANG_WEIDU_TP2, features, context.workspaceRoot);
        await language.init();

        conlog("WeiDU TP2 provider initialized");
    },

    getCompletions(uri: string): CompletionItem[] {
        return language?.completion(uri) ?? [];
    },

    getHover(uri: string, symbol: string): Hover | null {
        return language?.hover(uri, symbol) ?? null;
    },

    getSymbolDefinition(symbol: string): Location | null {
        return language?.definition(symbol) ?? null;
    },

    reloadFileData(uri: string, text: string): void {
        language?.reloadFileData(uri, text);
    },

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!storedContext) {
            conlog("WeiDU TP2 provider not initialized, cannot compile");
            return;
        }
        weiduCompile(uri, storedContext.settings.weidu, interactive, text);
    },
};
