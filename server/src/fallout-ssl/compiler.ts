/**
 * Fallout SSL compilation utilities.
 * Handles compilation via external compile.exe or built-in WASM compiler.
 *
 * Writes a temporary file (.tmp.ssl) in the same directory as the source file
 * so the compiler can resolve relative #include paths. The tmp file name is
 * exported as TMP_SSL_NAME and must be kept in sync with the files.watcherExclude
 * entry in package.json's configurationDefaults (see "Cross-reference: tmp file
 * watcher exclusion" there).
 */

import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
    addFallbackDiagnostic,
    conlog,
    needsShell,
    parseCommandPath,
    ParseItemList,
    ParseResult,
    pathToUri,
    removeTmpFile,
    reportCompileResult,
    runProcess,
    sendParseResult,
    uriToPath,
} from "../common";
import { getDocuments } from "../lsp-connection";
import { showError, showErrorWithActions, showInfo } from "../user-messages";
import { SSLsettings } from "../settings";
import { ssl_compile as ssl_builtin_compiler } from "../sslc/ssl_compiler";

const sslExt = ".ssl";

/**
 * Tmp file name used for compilation. Must be in the same directory as the
 * source file because SSL #include directives can use relative paths.
 *
 * Cross-reference: package.json configurationDefaults has a files.watcherExclude
 * entry for this name to prevent VS Code file watchers from picking it up.
 */
export const TMP_SSL_NAME = ".tmp.ssl";

/**
 * Wine gives network-mapped looking path to compile.exe
 * @param filePath looks like this `Z:/Downloads/1/_mls_test.h`, should be this `/home/user/Downloads/1/_mls_test.h`
 * Imperfect, but works.
 */
function fixWinePath(filePath: string) {
    if (os.platform() === "win32") {
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
        while (match !== null) {
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
        while (match !== null) {
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

/**
 * Reset cached compiler path. Exported for testing only — module-level
 * state (successfulCompilerPath) persists across test cases, so each test
 * must call this in beforeEach to avoid cross-test contamination.
 */
export function _resetCompilerCache() {
    successfulCompilerPath = null;
}

async function checkExternalCompiler(compilePath: string) {
    if (compilePath === successfulCompilerPath) {
        return true;
    }

    return new Promise<boolean>((resolve) => {
        const { executable, prefixArgs } = parseCommandPath(compilePath);
        const shell = needsShell(executable);
        cp.execFile(executable, [...prefixArgs, "--version"], { shell }, (err) => {
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

/** Build args and run the external SSL compiler via shared runProcess. */
function runExternalCompiler(
    compilePath: string,
    compileOptions: readonly string[],
    cwdTo: string,
    dstPath: string,
) {
    const { executable, prefixArgs } = parseCommandPath(compilePath);
    const allArgs = [...prefixArgs, ...compileOptions, TMP_SSL_NAME, "-o", dstPath];
    return runProcess(executable, allArgs, cwdTo);
}

export async function compile(
    uri: string,
    sslSettings: SSLsettings,
    interactive = false,
    text: string,
) {
    const filepath = uriToPath(uri);
    const cwdTo = path.dirname(filepath);
    const tmpPath = path.join(cwdTo, TMP_SSL_NAME);
    const tmpUri = pathToUri(tmpPath);
    const parsed = path.parse(filepath);
    const baseName = parsed.base;
    const base = parsed.name;
    const compileOptions = sslSettings.compileOptions.split(/\s+/).filter(Boolean);
    const dstPath = path.join(sslSettings.outputDirectory, base + ".int");

    if (parsed.ext.toLowerCase() !== sslExt) {
        // vscode loses open file if clicked on console or elsewhere
        conlog("Not a Fallout SSL file! Please focus a Fallout SSL file to compile.");
        if (interactive) {
            showInfo("Please focus a Fallout SSL file to compile!");
        }
        return;
    }
    conlog(`compiling ${baseName}...`);

    await fs.promises.writeFile(tmpPath, text);

    // Errors from the compiler (e.g. WASM crash) propagate to callers.
    // Fire-and-forget call sites (server.ts onDidSave/onDidChangeContent) use
    // `void compile(...).catch(...)` to log and swallow rejections. Awaited
    // call sites (e.g. TSSL transpile chain) catch and report them explicitly.
    // The finally block guarantees tmp file cleanup in both cases.
    try {
        let useBuiltInCompiler = sslSettings.useBuiltInCompiler;

        // TODO: when user declines the fallback prompt, execution falls through to
        // runExternalCompiler which will also fail. Should return early instead.
        if (!useBuiltInCompiler && !(await checkExternalCompiler(sslSettings.compilePath))) {
            const response = await showErrorWithActions(
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
                inputFileName: TMP_SSL_NAME,
                outputFileName: dstPath,
                options: sslSettings.compileOptions,
                headersDir: sslSettings.headersDirectory,
            });
            if (returnCode === 0) {
                if (interactive) {
                    showInfo(`Compiled ${baseName}.`);
                }
            } else {
                if (interactive) {
                    showError(`Failed to compile ${baseName}!`);
                }
            }
            sendDiagnostics(uri, stdout, tmpUri);
            return;
        }

        const { err, stdout } = await runExternalCompiler(
            sslSettings.compilePath,
            compileOptions,
            cwdTo,
            dstPath,
        );

        const parseResult = parseCompileOutput(stdout, uri);

        if (err && parseResult.errors.length === 0) {
            addFallbackDiagnostic(parseResult, err, pathToUri(filepath), stdout);
        }

        reportCompileResult(parseResult, interactive, `Compiled ${baseName}.`, `Failed to compile ${baseName}!`);
        sendParseResult(parseResult, uri, tmpUri);
    } finally {
        await removeTmpFile(tmpPath);
    }
}
