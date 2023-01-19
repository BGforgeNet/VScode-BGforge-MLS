import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { TextDocument } from "vscode-languageserver-textdocument";
import { conlog, isDirectory } from "./common";
import * as fallout from "./fallout";
import { connection, getDocumentSettings } from "./server";
import * as weidu from "./weidu";

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

export const tmpDir = path.join(os.tmpdir(), "bgforge-mls");
/**
 * Copies files to tmpdir and parses it there, then send diagnostic to the real file.
 * Because weidu and compile.exe require file on disk to parse.
 * @param uri
 * @param langId
 * @param interactive - set if it's run manually by command
 * @param text - current full text (which could be different from on-disk version)
 * @returns void
 */
export async function compile(uri: string, langId: string, interactive = false, text: string) {
    const settings = await getDocumentSettings(uri);
    if (!isDirectory(tmpDir)) {
        fs.mkdirSync(tmpDir);
    }

    if (falloutLanguages.includes(langId)) {
        clearDiagnostics(uri);
        fallout.compile(uri, settings.falloutSSL, interactive, text);
        return;
    }

    if (weiduLanguages.includes(langId)) {
        clearDiagnostics(uri);
        weidu.compile(uri, settings.weidu, interactive, text);
        return;
    }

    conlog("Compile called on a wrong language.");
    if (interactive) {
        connection.window.showInformationMessage(`Can't compile ${uri}.`);
    }
}
