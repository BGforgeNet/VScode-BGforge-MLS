#!/usr/bin/env node
/**
 * CLI tool to format Fallout SSL, WeiDU BAF, WeiDU D, and WeiDU TP2 files.
 * Usage: node format-cli.js <file.ssl|file.baf|file.d|file.tp2|dir> [--save] [-r] [-q] [--check]
 */

import * as fs from "fs";
import * as path from "path";
import {
    formatDocument as formatSslDocument,
    FormatOptions as SslFormatOptions,
} from "../../../server/src/fallout-ssl/format-core";
import { initParser as initSslParser, getParser as getSslParser } from "../../../server/src/fallout-ssl/parser";
import {
    formatDocument as formatBafDocument,
    FormatOptions as BafFormatOptions,
} from "../../../server/src/weidu-baf/format-core";
import { initParser as initBafParser, getParser as getBafParser } from "../../../server/src/weidu-baf/parser";
import {
    formatDocument as formatDDocument,
    FormatOptions as DFormatOptions,
} from "../../../server/src/weidu-d/format-core";
import { initParser as initDParser, getParser as getDParser } from "../../../server/src/weidu-d/parser";
import {
    formatDocument as formatTp2Document,
    FormatOptions as Tp2FormatOptions,
} from "../../../server/src/weidu-tp2/format/core";
import { initParser as initTp2Parser, getParser as getTp2Parser } from "../../../server/src/weidu-tp2/parser";
import { getEditorconfigSettings } from "../../../server/src/shared/editorconfig";
import { validateFormatting } from "../../../server/src/shared/format-utils";
import { EXT_WEIDU_TP2 } from "../../../server/src/core/languages";
import { parseCliArgs, runCli, safeProcess, reportDiff, FileResult, OutputMode } from "../../cli-utils";

const DEFAULT_INDENT = 4;
const EXTENSIONS = [".ssl", ".baf", ".d", ...EXT_WEIDU_TP2];

type FileType = "ssl" | "baf" | "d" | "tp2";

function getFileType(filePath: string): FileType | null {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".ssl") return "ssl";
    if (ext === ".baf") return "baf";
    if (ext === ".d") return "d";
    if ((EXT_WEIDU_TP2 as readonly string[]).includes(ext)) return "tp2";
    return null;
}

function getFormatOptions(filePath: string): { indentSize: number; lineLimit: number } {
    const config = getEditorconfigSettings(filePath);
    return {
        indentSize: config.indentSize ?? DEFAULT_INDENT,
        lineLimit: config.maxLineLength ?? 120,
    };
}

async function processFile(filePath: string, mode: OutputMode): Promise<FileResult> {
    return safeProcess(filePath, () => {
        const fileType = getFileType(filePath);
        if (!fileType) {
            console.error(`Error: Unsupported file type: ${filePath}`);
            return "error";
        }

        const text = fs.readFileSync(filePath, "utf-8");
        const opts = getFormatOptions(path.resolve(filePath));
        let result: { text: string };

        if (fileType === "ssl") {
            const tree = getSslParser().parse(text);
            if (!tree) { console.error(`Error: Failed to parse ${filePath}`); return "error"; }
            const options: SslFormatOptions = { indentSize: opts.indentSize, maxLineLength: opts.lineLimit };
            result = formatSslDocument(tree.rootNode, options);
        } else if (fileType === "baf") {
            const tree = getBafParser().parse(text);
            if (!tree) { console.error(`Error: Failed to parse ${filePath}`); return "error"; }
            const options: BafFormatOptions = { indentSize: opts.indentSize };
            result = formatBafDocument(tree.rootNode, options);
        } else if (fileType === "d") {
            const tree = getDParser().parse(text);
            if (!tree) { console.error(`Error: Failed to parse ${filePath}`); return "error"; }
            const options: DFormatOptions = { indentSize: opts.indentSize, lineLimit: opts.lineLimit };
            result = formatDDocument(tree.rootNode, options);
        } else {
            const tree = getTp2Parser().parse(text);
            if (!tree) { console.error(`Error: Failed to parse ${filePath}`); return "error"; }
            const options: Tp2FormatOptions = { indentSize: opts.indentSize, lineLimit: opts.lineLimit };
            result = formatTp2Document(tree.rootNode, options);
        }

        const validationError = validateFormatting(text, result.text);
        if (validationError) {
            console.error(`${filePath}: Formatter bug: ${validationError}`);
            return "error";
        }

        const changed = result.text !== text;
        if (mode === "save") {
            if (changed) {
                fs.writeFileSync(filePath, result.text);
                console.log(`Formatted: ${filePath}`);
            }
        } else if (mode === "stdout") {
            process.stdout.write(result.text);
        } else if (changed) {
            reportDiff(filePath, text, result.text);
            return "changed";
        }
        return changed ? "changed" : "unchanged";
    });
}

const HELP = `Usage: format-cli <file.ssl|file.baf|file.d|file.tp2|dir> [--save] [--check] [-r] [-q]
  --save    Write formatted output back to file(s)
  --check   Check if files are formatted (exit 1 if not)
  -r        Recursively format all supported files in directory
  -q        Quiet mode: suppress summary, only print changed files
  Without --save or --check: single file prints to stdout, directory shows what would change`;

async function main() {
    const args = parseCliArgs(HELP);
    if (!args) return;

    const stat = fs.statSync(args.target);
    const isDir = stat.isDirectory();
    const fileType = isDir ? null : getFileType(args.target);

    await runCli({
        args,
        extensions: EXTENSIONS,
        description: ".ssl, .baf, .d, and .tp2",
        async init() {
            if (isDir || fileType === "ssl") await initSslParser();
            if (isDir || fileType === "baf") await initBafParser();
            if (isDir || fileType === "d") await initDParser();
            if (isDir || fileType === "tp2") await initTp2Parser();
        },
        processFile,
    });
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
