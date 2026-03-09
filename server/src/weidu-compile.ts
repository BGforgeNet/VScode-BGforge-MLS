/**
 * WeiDU compilation: spawn WeiDU processes, parse output, send diagnostics.
 * Used by BAF, D, and TP2 providers for parse-checking.
 */

import * as fs from "fs";
import * as path from "path";
import {
    addFallbackDiagnostic,
    conlog,
    parseCommandPath,
    ParseItemList,
    ParseResult,
    pathToUri,
    removeTmpFile,
    reportCompileResult,
    runProcess,
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
    const errorsRegex = /\[(\S+)\]\s+(?:(?:PARSE|LEXER)\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];
    const seen = new Set<string>();

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
            if (!matchUri || !matchLine || !matchColStart || !matchColEnd) {
                match = errorsRegex.exec(text);
                continue;
            }

            // WeiDU may emit both "PARSE ERROR" and "ERROR" for the same location
            const key = `${matchUri}:${matchLine}:${matchColStart}-${matchColEnd}`;
            if (!seen.has(key)) {
                seen.add(key);

                // Extract up to 4 non-empty detail lines after the error header.
                // WeiDU always stops at the first error, so there's no risk of bleeding
                // into a second error block — but we still limit to 4 lines for readability.
                const afterMatch = text.slice(match.index + match[0].length);
                const detailLines = afterMatch.split(/\r?\n/).slice(1).filter((l) => l.length > 0);
                const maxDetailLines = 4;
                const truncatedDetails = detailLines.length > maxDetailLines
                    ? [...detailLines.slice(0, maxDetailLines), "..."]
                    : detailLines;
                const message = truncatedDetails.join("\n");

                errors.push({
                    uri: pathToUri(matchUri),
                    line: parseInt(matchLine),
                    columnStart: parseInt(matchColStart) - 1, // weidu uses 1-index, while vscode 0 index?
                    columnEnd: parseInt(matchColEnd),
                    message,
                });
            }

            match = errorsRegex.exec(text);
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

export async function compile(uri: string, settings: WeiDUsettings, interactive = false, text: string) {
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

    try {
        await fs.promises.writeFile(tmpFile, text);
        const allArgs = [...weiduPrefixArgs, ...weiduArgs, weiduType, tmpFile];
        const { err, stdout } = await runProcess(weiduPath, allArgs, cwdTo);

        const parseResult = parseWeiduOutput(stdout);

        let showedSpecificError = false;
        if (err && parseResult.errors.length === 0) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                showError(`WeiDU not found at '${weiduPath}'. Check bgforge.mls.weidu.path setting.`);
                showedSpecificError = true;
            }
            addFallbackDiagnostic(parseResult, err, pathToUri(filePath), stdout);
        }

        // Skip generic message when we already showed a specific one (e.g. ENOENT)
        if (!showedSpecificError) {
            reportCompileResult(parseResult, interactive, `Successfully parsed ${baseName}.`, `Failed to parse ${baseName}!`);
        }

        // Always send diagnostics: clears stale errors on success, reports new ones on failure
        sendParseResult(parseResult, uri, tmpUri);
    } finally {
        await removeTmpFile(tmpFile);
    }
}
