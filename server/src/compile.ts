import { connection, getDocumentSettings } from "./server";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fallout from "./fallout";
import * as weidu from "./weidu";
import { conlog } from "./common";

/** Only these languages can be compiled */
const falloutLanguages = ["fallout-ssl"];
const weiduLanguages = [
    "weidu-tp2",
    "weidu-tp2-tpl",
    "weidu-d",
    "weidu-d-tpl",
    "weidu-baf",
    "weidu-baf-tpl",
];
const languages = [...falloutLanguages, ...weiduLanguages];

/** These languages require game path to compile */
const languagesRequireGame = ["weidu-d", "weidu-d-tpl", "weidu-baf", "weidu-baf-tpl"];

export const COMMAND_compile = "extension.bgforge.compile";

/** Can we compile this file? */
export async function canCompile(document: TextDocument) {
    const langId = document.languageId;
    if (!languages.includes(langId)) {
        return false;
    }
    const settings = await getDocumentSettings(document.uri);
    if (languagesRequireGame.includes(langId) && settings.weidu.gamePath == "") {
        return false;
    }
    return true;
}

export function clearDiagnostics(uri: string) {
    // Clear old diagnostics. For some reason not working in common.send_parse_result.
    // Probably due to async?
    connection.sendDiagnostics({ uri: uri, diagnostics: [] });
}

/**
 * 
 * @param uri 
 * @param langId 
 * @param interactive - set if it's run manually by command
 * @returns void
 */
export async function compile(uri: string, langId: string, interactive = false) {
    const settings = await getDocumentSettings(uri);

    if (falloutLanguages.includes(langId)) {
        clearDiagnostics(uri);
        fallout.compile(uri, settings.falloutSSL, interactive);
        return;
    }

    if (weiduLanguages.includes(langId)) {
        clearDiagnostics(uri);
        weidu.compile(uri, settings.weidu, interactive);
        return;
    }

    conlog("Compile called on a wrong language.");
    if (interactive) {
        connection.window.showInformationMessage(`Can't compile ${uri}.`);
    }
}
