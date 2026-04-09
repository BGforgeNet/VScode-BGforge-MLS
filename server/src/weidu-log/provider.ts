/**
 * WeiDU log language provider.
 * Provides go-to-definition for mod paths (~mod/path.tp2~ -> actual .tp2 file).
 */

import { Location, Position } from "vscode-languageserver/node";
import { conlog } from "../common";
import { LANG_WEIDU_LOG } from "../core/languages";
import type { LanguageProvider, ProviderContext, ProviderBase, NavigationCapability } from "../language-provider";
import { getDefinition } from "./definition";

class WeiduLogProvider implements ProviderBase, NavigationCapability {
    readonly id = LANG_WEIDU_LOG;

    async init(_context: ProviderContext): Promise<void> {
        conlog("WeiDU log provider initialized");
    }

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    }
}

export const weiduLogProvider: LanguageProvider = new WeiduLogProvider();
