import * as fs from "fs";
import * as path from "path";
import { conlog, isDirectory, pathToUri, tmpDir } from "./common";
import * as fallout from "./fallout";
import {
    LANG_FALLOUT_SSL,
    LANG_WEIDU_BAF,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TPL,
} from "./lang-ids";
import { connection, getDocumentSettings } from "./server";
import * as tbaf from "./tbaf/index";
import * as tssl from "./tssl";
import * as weidu from "./weidu";

/** Only these languages can be compiled */
const falloutLanguages = [LANG_FALLOUT_SSL];
const weiduLanguages = [LANG_WEIDU_TP2, LANG_WEIDU_TP2_TPL, LANG_WEIDU_D, LANG_WEIDU_D_TPL, LANG_WEIDU_BAF];

export const COMMAND_compile = "extension.bgforge.compile";

export function clearDiagnostics(uri: string) {
    // Clear old diagnostics (fire-and-forget notification)
    void connection.sendDiagnostics({ uri: uri, diagnostics: [] });
}

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
        await fallout.compile(uri, settings.falloutSSL, interactive, text);
        return;
    }

    if (weiduLanguages.includes(langId)) {
        clearDiagnostics(uri);
        weidu.compile(uri, settings.weidu, interactive, text);
        return;
    }

    if (langId == "typescript") {
        if (uri.toLowerCase().endsWith(".tbaf")) {
            try {
                const bafPath = await tbaf.compile(uri, text);
                const bafName = path.basename(bafPath);
                connection.window.showInformationMessage(`Transpiled to ${bafName}`);
                // Chain BAF compilation if weidu and game path are configured
                if (settings.weidu.path && settings.weidu.gamePath) {
                    const bafUri = pathToUri(bafPath);
                    const bafText = fs.readFileSync(bafPath, 'utf-8');
                    weidu.compile(bafUri, settings.weidu, true, bafText);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                connection.window.showErrorMessage(`TBAF: ${msg}`);
            }
        }
        if (uri.toLowerCase().endsWith(".tssl")) {
            try {
                const sslPath = await tssl.compile(uri, text);
                const sslName = path.basename(sslPath);
                connection.window.showInformationMessage(`Transpiled to ${sslName}`);
                // Chain SSL compilation
                const sslUri = pathToUri(sslPath);
                const sslText = fs.readFileSync(sslPath, 'utf-8');
                await fallout.compile(sslUri, settings.falloutSSL, true, sslText);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                connection.window.showErrorMessage(`TSSL: ${msg}`);
            }
        }
        return;
    }

    conlog(`Don't know how to compile ${langId} - ${uri}`);
    if (interactive) {
        connection.window.showInformationMessage(`Don't know how to compile ${langId} - ${uri}`);
    }
}
