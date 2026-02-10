/**
 * Fallout SSL compilation utilities.
 * Handles compilation via external compile.exe or built-in WASM compiler.
 */

import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
    conlog,
    parseCommandPath,
    ParseItemList,
    ParseResult,
    pathToUri,
    sendParseResult,
    uriToPath,
} from "../common";
import { getConnection, getDocuments } from "../lsp-connection";
import { SSLsettings } from "../settings";
import { ssl_compile as ssl_builtin_compiler } from "../sslc/ssl_compiler";

const sslExt = ".ssl";

/**
 * Wine gives network-mapped looking path to compile.exe
 * @param filePath looks like this `Z:/Downloads/1/_mls_test.h`, should be this `/home/user/Downloads/1/_mls_test.h`
 * Imperfect, but works.
 */
function fixWinePath(filePath: string) {
    if (os.platform() == "win32") {
        return filePath;
    }
    if (!filePath.startsWith("Z:/")) {
        return filePath;
    }

    const homeDir = os.homedir();
    const relPath = filePath.replace("Z:/", "");
    const realPath = path.join(homeDir, relPath);
    return realPath;
}

/**
 * Parse compile.exe output with regex and return found matches.
 * `text` looks like this
 * `[Error] <1.ssl.tmp>:2:8: Expecting top-level statement`
 * or
 * `[Error] <Semantic> <my_script.ssl>:26:25: Unknown identifier qq.`
 * or (wine)
 * `[Error] <Z:/Downloads/1/_mls_test.h>:1: Illegal parameter "1"`
 *
 * Numbers mean line:column, if column is absent, it means first column.
 */
function parseCompileOutput(text: string, uri: string) {
    const textDocument = getDocuments().get(uri);
    if (!textDocument) {
        return { errors: [], warnings: [] };
    }
    const errorsRegex = /\[Error\]( <Semantic>)? <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const warningsRegex = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    // compile.exe may show errors and warnings for included files, not just current one
    // So we need to get uri's for those
    // They could be relative to the original file path
    const filePath = uriToPath(uri);
    const fileDir = path.dirname(filePath);

    try {
        let match = errorsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            const matchFile = match[2];
            const matchLine = match[3];
            const matchCol = match[4];
            const matchMsg = match[5];
            if (!matchFile || !matchLine || !matchMsg) continue;

            const col = matchCol || "1";

            // calculate uri for actual file where the error is found
            const errorFile = fixWinePath(matchFile);
            let errorFilePath: string;
            if (path.isAbsolute(errorFile)) {
                errorFilePath = errorFile;
            } else {
                errorFilePath = path.join(fileDir, errorFile);
            }
            const errorFileUri = pathToUri(errorFilePath);

            errors.push({
                uri: errorFileUri,
                line: parseInt(matchLine),
                columnStart: 0,
                columnEnd: parseInt(col) - 1,
                message: matchMsg,
            });
            match = errorsRegex.exec(text);
        }

        match = warningsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === warningsRegex.lastIndex) {
                warningsRegex.lastIndex++;
            }
            const matchFile = match[1];
            const matchLine = match[2];
            const matchCol = match[3];
            const matchMsg = match[4];
            if (!matchFile || !matchLine || !matchMsg) continue;

            const col = matchCol || "0";
            const line = parseInt(matchLine);
            const column_end = textDocument.offsetAt({ line: line, character: 0 }) - 1;

            // calculate uri for actual file where the warning is found
            const errorFile = fixWinePath(matchFile);
            let errorFilePath: string;
            if (path.isAbsolute(errorFile)) {
                errorFilePath = errorFile;
            } else {
                errorFilePath = path.join(fileDir, errorFile);
            }
            const errorFileUri = pathToUri(errorFilePath);

            warnings.push({
                uri: errorFileUri,
                line: line,
                columnStart: parseInt(col),
                columnEnd: column_end,
                message: matchMsg,
            });
            match = warningsRegex.exec(text);
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

function sendDiagnostics(uri: string, outputText: string, tmpUri: string) {
    const parseResult = parseCompileOutput(outputText, uri);
    sendParseResult(parseResult, uri, tmpUri);
}

let successfulCompilerPath: string | null = null;
async function checkExternalCompiler(compilePath: string) {
    if (compilePath === successfulCompilerPath) {
        // Check compiler only once
        return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
        const { executable, prefixArgs } = parseCommandPath(compilePath);
        cp.execFile(executable, [...prefixArgs, "--version"], (err) => {
            conlog(`Compiler check '${compilePath} --version' err=${err}`);
            if (err) {
                resolve(false);
            } else {
                successfulCompilerPath = compilePath;
                resolve(true);
            }
        });
    });
}

export async function compile(
    uri: string,
    sslSettings: SSLsettings,
    interactive = false,
    text: string,
) {
    const filepath = uriToPath(uri);
    const cwdTo = path.dirname(filepath);
    // tmp file has to be in the same dir, because includes can be relative or absolute
    const tmpName = ".tmp.ssl";
    const tmpPath = path.join(cwdTo, tmpName);
    const tmpUri = pathToUri(tmpPath);
    const baseName = path.parse(filepath).base;
    const base = path.parse(filepath).name;
    const compileOptions = sslSettings.compileOptions.split(/\s+/).filter(Boolean);
    const dstPath = path.join(sslSettings.outputDirectory, base + ".int");
    const ext = path.parse(filepath).ext;

    if (ext.toLowerCase() != sslExt) {
        // vscode loses open file if clicked on console or elsewhere
        conlog("Not a Fallout SSL file! Please focus a Fallout SSL file to compile.");
        if (interactive) {
            getConnection().window.showInformationMessage("Please focus a Fallout SSL file to compile!");
        }
        return;
    }
    conlog(`compiling ${baseName}...`);

    fs.writeFileSync(tmpPath, text);

    let useBuiltInCompiler = sslSettings.useBuiltInCompiler;

    if (!useBuiltInCompiler && !(await checkExternalCompiler(sslSettings.compilePath))) {
        const response = await getConnection().window.showErrorMessage(
            `Failed to run '${sslSettings.compilePath}'! Use built-in compiler this time?`,
            { title: "Yes", id: "yes" },
            { title: "No", id: "no" },
        );
        if (response?.id === "yes") {
            useBuiltInCompiler = true;
        }
    }

    if (useBuiltInCompiler) {
        const { stdout, returnCode } = await ssl_builtin_compiler({
            interactive,
            cwd: cwdTo,
            inputFileName: tmpName,
            outputFileName: dstPath,
            options: sslSettings.compileOptions,
            headersDir: sslSettings.headersDirectory,
        });
        if (returnCode === 0) {
            if (interactive) {
                getConnection().window.showInformationMessage(`Compiled ${baseName}.`);
            }
        } else {
            if (interactive) {
                getConnection().window.showErrorMessage(`Failed to compile ${baseName}!`);
            }
        }
        sendDiagnostics(uri, stdout, tmpUri);
        // sometimes it gets deleted due to async runs?
        if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
        }
        return;
    }

    const { executable, prefixArgs } = parseCommandPath(sslSettings.compilePath);
    const allArgs = [...prefixArgs, ...compileOptions, tmpName, "-o", dstPath];
    conlog(`${sslSettings.compilePath} ${allArgs.join(" ")}`);
    cp.execFile(
        executable,
        allArgs,
        { cwd: cwdTo },
        (err, stdout: string, stderr: string) => {
            conlog("stdout: " + stdout);
            if (stderr) {
                conlog("stderr: " + stderr);
            }
            if (err) {
                conlog("error: " + err.message);
                if (interactive) {
                    getConnection().window.showErrorMessage(`Failed to compile ${baseName}!`);
                }
            } else {
                if (interactive) {
                    getConnection().window.showInformationMessage(`Compiled ${baseName}.`);
                }
            }
            sendDiagnostics(uri, stdout, tmpUri);
            // sometimes it gets deleted due to async runs?
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        },
    );
}
