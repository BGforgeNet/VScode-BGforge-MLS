/**
 * Compilation dispatcher.
 * Routes compile requests to language providers and handles TypeScript transpilers.
 */

import * as fs from "fs";
import * as path from "path";
import { conlog, isDirectory, pathToUri, tmpDir } from "./common";
import { EXT_TBAF, EXT_TD, EXT_TSSL } from "./core/languages";
import * as fallout from "./fallout-ssl/compiler";
import { getConnection } from "./lsp-connection";
import { registry } from "./provider-registry";
import { getDocumentSettings } from "./server";
import * as tbaf from "./tbaf/index";
import * as td from "./td/index";
import * as tssl from "./tssl";
import * as weidu from "./weidu-compile";

export const COMMAND_compile = "extension.bgforge.compile";

export function clearDiagnostics(uri: string) {
    // Clear old diagnostics (fire-and-forget notification)
    void getConnection().sendDiagnostics({ uri: uri, diagnostics: [] });
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

    // Try provider first (all standard languages have providers now)
    if (registry.has(langId)) {
        clearDiagnostics(uri);
        const handled = await registry.compile(langId, uri, text, interactive);
        if (handled) {
            return;
        }
    }

    // TypeScript-based transpilers (TBAF, TSSL, TD)
    if (langId == "typescript") {
        if (uri.toLowerCase().endsWith(EXT_TD)) {
            try {
                const dPath = await td.compile(uri, text);
                const dName = path.basename(dPath);
                getConnection().window.showInformationMessage(`Transpiled to ${dName}`);
                // Chain D compilation if weidu and game path are configured
                if (settings.weidu.path && settings.weidu.gamePath) {
                    const dUri = pathToUri(dPath);
                    const dText = fs.readFileSync(dPath, 'utf-8');
                    weidu.compile(dUri, settings.weidu, true, dText);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                getConnection().window.showErrorMessage(`TD: ${msg}`);
            }
            return;
        }
        if (uri.toLowerCase().endsWith(EXT_TBAF)) {
            try {
                const bafPath = await tbaf.compile(uri, text);
                const bafName = path.basename(bafPath);
                getConnection().window.showInformationMessage(`Transpiled to ${bafName}`);
                // Chain BAF compilation if weidu and game path are configured
                if (settings.weidu.path && settings.weidu.gamePath) {
                    const bafUri = pathToUri(bafPath);
                    const bafText = fs.readFileSync(bafPath, 'utf-8');
                    weidu.compile(bafUri, settings.weidu, true, bafText);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                getConnection().window.showErrorMessage(`TBAF: ${msg}`);
            }
        }
        if (uri.toLowerCase().endsWith(EXT_TSSL)) {
            try {
                const sslPath = await tssl.compile(uri, text);
                const sslName = path.basename(sslPath);
                getConnection().window.showInformationMessage(`Transpiled to ${sslName}`);
                // Chain SSL compilation
                const sslUri = pathToUri(sslPath);
                const sslText = fs.readFileSync(sslPath, 'utf-8');
                await fallout.compile(sslUri, settings.falloutSSL, true, sslText);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                getConnection().window.showErrorMessage(`TSSL: ${msg}`);
            }
        }
        return;
    }

    conlog(`Don't know how to compile ${langId} - ${uri}`);
    if (interactive) {
        getConnection().window.showInformationMessage(`Don't know how to compile ${langId} - ${uri}`);
    }
}
