/**
 * WeiDU compilation: spawn WeiDU processes, parse output, send diagnostics.
 * Used by BAF, D, and TP2 providers for parse-checking.
 */

import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
    conlog,
    needsShell,
    parseCommandPath,
    ParseItemList,
    ParseResult,
    pathToUri,
    sendParseResult,
    tmpDir,
    uriToPath,
} from "./common";
import { showError, showInfo, showWarning } from "./user-messages";
import { WeiDUsettings } from "./settings";

const valid_extensions = new Map([
    [".tp2", "tp2"],
    [".tph", "tpa"],
    [".tpa", "tpa"],
    [".tpp", "tpp"],
    [".d", "d"],
    [".baf", "baf"],
]);

/** `text` looks like this
 *
 * `[ua.tp2]  ERROR at line 30 column 1-63` */
function parseWeiduOutput(text: string) {
    const errorsRegex = /\[(\S+)\]\s+(?:PARSE\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match = errorsRegex.exec(text);
        while (match !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            const matchUri = match[1];
            const matchLine = match[2];
            const matchColStart = match[3];
            const matchColEnd = match[4];
            if (!matchUri || !matchLine || !matchColStart || !matchColEnd) continue;
            errors.push({
                uri: pathToUri(matchUri),
                line: parseInt(matchLine),
                columnStart: parseInt(matchColStart) - 1, // weidu uses 1-index, while vscode 0 index?
                columnEnd: parseInt(matchColEnd),
                message: text,
            });
            match = errorsRegex.exec(text);
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

function sendDiagnostics(uri: string, output_text: string, tmpUri: string) {
    const parseResult = parseWeiduOutput(output_text);
    sendParseResult(parseResult, uri, tmpUri);
}

export function compile(uri: string, settings: WeiDUsettings, interactive = false, text: string) {
    const gamePath = settings.gamePath;
    const { executable: weiduPath, prefixArgs: weiduPrefixArgs } = parseCommandPath(settings.path);
    const filePath = uriToPath(uri);
    const cwdTo = tmpDir;
    const baseName = path.parse(filePath).base;
    const ext = path.parse(filePath).ext.toLowerCase();

    /**
     * Preprocessed file.
     * Weidu used to have issues with non-baf extensions, ref https://github.com/WeiDUorg/weidu/issues/237
     */
    const tmpFile = path.join(tmpDir, `tmp${ext}`);
    const tmpUri = pathToUri(tmpFile);

    const weiduArgs = ["--no-exit-pause", "--noautoupdate", "--debug-assign", "--parse-check"];
    if (gamePath === "") {
        // d and baf need game files
        weiduArgs.unshift("--nogame");
    } else {
        weiduArgs.unshift("--game", gamePath);
    }

    const weiduType = valid_extensions.get(ext);
    if (!weiduType) {
        // vscode loses open file if clicked on console or elsewhere
        conlog("Not a WeiDU file (tp2, tph, tpa, tpp, d, baf)! Focus a WeiDU file to parse.");
        if (interactive) {
            showInfo("Focus a WeiDU file to parse!");
        }

        return;
    }

    if ((weiduType === "d" || weiduType === "baf") && gamePath === "") {
        conlog("Path to IE game is not specified in settings, can't parse D or BAF!");
        if (interactive) {
            showWarning(
                "Path to IE game is not specified in settings, can't parse D or BAF!"
            );
        }
        return;
    }

    // parse
    conlog(`parsing ${baseName}...`);
    fs.writeFileSync(tmpFile, text);
    const allArgs = [...weiduPrefixArgs, ...weiduArgs, weiduType, tmpFile];
    const shell = needsShell(weiduPath);
    conlog(`${weiduPath} ${allArgs.join(" ")}`);
    cp.execFile(weiduPath, allArgs, { cwd: cwdTo, shell }, (err, stdout: string, stderr: string) => {
        conlog("stdout: " + stdout);
        const parseResult = parseWeiduOutput(stdout); // dupe, yes
        conlog(parseResult);
        if (stderr) {
            conlog("Parse stderr: " + stderr);
        }
        if (
            (err && err.code !== 0) ||
            parseResult.errors.length > 0 || // weidu doesn't always return non-zero on parse failure?
            parseResult.warnings.length > 0
        ) {
            if (err) {
                conlog("Parse  error: " + err.message);
            }
            conlog(parseResult);
            if (interactive) {
                showError(`Failed to parse ${baseName}!`);
            }
            sendDiagnostics(uri, stdout, tmpUri);
        } else {
            if (interactive) {
                showInfo(`Successfully parsed ${baseName}.`);
            }
        }
    });
}
