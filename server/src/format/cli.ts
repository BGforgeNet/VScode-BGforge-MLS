#!/usr/bin/env node
/**
 * CLI tool to format Fallout SSL, WeiDU BAF, WeiDU D, and WeiDU TP2 files
 * Usage: node format-cli.js <file.ssl|file.baf|file.d|file.tp2|dir> [--save] [-r]
 */

import * as fs from "fs";
import * as path from "path";
import {
    formatDocument as formatSslDocument,
    FormatOptions as SslFormatOptions,
    FormatError,
} from "../fallout-ssl/format-core";
import { initParser as initSslParser, getParser as getSslParser } from "../fallout-ssl/parser";
import {
    formatDocument as formatBafDocument,
    FormatOptions as BafFormatOptions,
} from "../weidu-baf/format-core";
import { initParser as initBafParser, getParser as getBafParser } from "../weidu-baf/parser";
import {
    formatDocument as formatDDocument,
    FormatOptions as DFormatOptions,
} from "../weidu-d/format-core";
import { initParser as initDParser, getParser as getDParser } from "../weidu-d/parser";
import {
    formatDocument as formatTp2Document,
    FormatOptions as Tp2FormatOptions,
} from "../weidu-tp2/format/core";
import { initParser as initTp2Parser, getParser as getTp2Parser } from "../weidu-tp2/parser";
import * as editorconfig from "editorconfig";
import { validateFormatting } from "../shared/format-utils";
import { EXT_WEIDU_TP2 } from "../core/languages";

const DEFAULT_INDENT = 4;

type FileType = "ssl" | "baf" | "d" | "tp2";

function getFileType(filePath: string): FileType | null {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".ssl") return "ssl";
    if (ext === ".baf") return "baf";
    if (ext === ".d") return "d";
    if ((EXT_WEIDU_TP2 as readonly string[]).includes(ext)) return "tp2";
    return null;
}

function findFiles(dir: string, exts: string[], files: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findFiles(fullPath, exts, files);
        } else if (exts.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}

type FileResult = "changed" | "unchanged" | "error";

function printErrors(filePath: string, errors: FormatError[]): void {
    for (const err of errors) {
        console.error(`${filePath}:${err.line}:${err.column}: ${err.message}`);
    }
}

function getSslFormatOptions(filePath: string): SslFormatOptions {
    const config = editorconfig.parseSync(filePath);
    return {
        indentSize: typeof config.indent_size === "number" ? config.indent_size : DEFAULT_INDENT,
        maxLineLength: typeof config.max_line_length === "number" ? config.max_line_length : 120,
    };
}

function getBafFormatOptions(filePath: string): BafFormatOptions {
    const config = editorconfig.parseSync(filePath);
    return {
        indentSize: typeof config.indent_size === "number" ? config.indent_size : DEFAULT_INDENT,
    };
}

function getDFormatOptions(filePath: string): DFormatOptions {
    const config = editorconfig.parseSync(filePath);
    return {
        indentSize: typeof config.indent_size === "number" ? config.indent_size : DEFAULT_INDENT,
        lineLimit: typeof config.max_line_length === "number" ? config.max_line_length : 120,
    };
}

function getTp2FormatOptions(filePath: string): Tp2FormatOptions {
    const config = editorconfig.parseSync(filePath);
    return {
        indentSize: typeof config.indent_size === "number" ? config.indent_size : DEFAULT_INDENT,
        lineLimit: typeof config.max_line_length === "number" ? config.max_line_length : 120,
    };
}

type FormatMode = "save" | "stdout" | "check";

function formatFile(filePath: string, mode: FormatMode): FileResult {
    const fileType = getFileType(filePath);
    if (!fileType) {
        console.error(`Error: Unsupported file type: ${filePath}`);
        return "error";
    }

    const text = fs.readFileSync(filePath, "utf-8");
    let result: { text: string; errors: FormatError[] };

    if (fileType === "ssl") {
        const tree = getSslParser().parse(text);
        if (!tree) {
            console.error(`Error: Failed to parse ${filePath}`);
            return "error";
        }
        const options = getSslFormatOptions(path.resolve(filePath));
        result = formatSslDocument(tree.rootNode, options);
    } else if (fileType === "baf") {
        const tree = getBafParser().parse(text);
        if (!tree) {
            console.error(`Error: Failed to parse ${filePath}`);
            return "error";
        }
        const options = getBafFormatOptions(path.resolve(filePath));
        result = formatBafDocument(tree.rootNode, options);
    } else if (fileType === "d") {
        const tree = getDParser().parse(text);
        if (!tree) {
            console.error(`Error: Failed to parse ${filePath}`);
            return "error";
        }
        const options = getDFormatOptions(path.resolve(filePath));
        result = formatDDocument(tree.rootNode, options);
    } else {
        // tp2
        const tree = getTp2Parser().parse(text);
        if (!tree) {
            console.error(`Error: Failed to parse ${filePath}`);
            return "error";
        }
        const options = getTp2FormatOptions(path.resolve(filePath));
        result = formatTp2Document(tree.rootNode, options);
    }

    // Print any errors (reserved words used as identifiers, etc.)
    if (result.errors.length > 0) {
        printErrors(filePath, result.errors);
    }

    // Validate formatting didn't change content
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
        // mode === "check"
        console.log(`Would format: ${filePath}`);
    }
    return changed ? "changed" : "unchanged";
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: format-cli <file.ssl|file.baf|file.d|file.tp2|dir> [--save] [-r] [-q]");
        console.log("  --save    Write formatted output back to file(s)");
        console.log("  -r        Recursively format all .ssl, .baf, .d, and .tp2 files in directory");
        console.log("  -q        Quiet mode: suppress summary, only print changed files");
        console.log("  Without --save: single file prints to stdout, directory shows what would change");
        process.exit(0);
    }

    const target = args.find(a => !a.startsWith("-"));
    const saveToFile = args.includes("--save");
    const recursive = args.includes("-r") || args.includes("--recursive");
    const quiet = args.includes("-q") || args.includes("--quiet");

    if (!target) {
        console.error("Error: No file or directory specified");
        process.exit(1);
    }

    if (!fs.existsSync(target)) {
        console.error(`Error: Not found: ${target}`);
        process.exit(1);
    }

    // Initialize parsers based on what we need
    const stat = fs.statSync(target);
    const isDir = stat.isDirectory();
    const fileType = isDir ? null : getFileType(target);

    // Initialize parsers as needed
    if (isDir || fileType === "ssl") {
        await initSslParser();
    }
    if (isDir || fileType === "baf") {
        await initBafParser();
    }
    if (isDir || fileType === "d") {
        await initDParser();
    }
    if (isDir || fileType === "tp2") {
        await initTp2Parser();
    }

    if (isDir) {
        if (!recursive) {
            console.error("Error: Target is a directory. Use -r for recursive formatting.");
            process.exit(1);
        }
        const files = findFiles(target, [".ssl", ".baf", ".d", ...EXT_WEIDU_TP2]);
        if (!quiet) console.log(`Found ${files.length} files (.ssl, .baf, .d, and .tp2)`);
        let changed = 0, unchanged = 0, errors = 0;
        const mode: FormatMode = saveToFile ? "save" : "check";
        for (const file of files) {
            const result = formatFile(file, mode);
            if (result === "changed") changed++;
            else if (result === "unchanged") unchanged++;
            else errors++;
        }
        if (!quiet) console.log(`\nSummary: ${changed} changed, ${unchanged} unchanged, ${errors} errors`);
        if (errors > 0) {
            process.exit(1);
        }
    } else {
        formatFile(target, saveToFile ? "save" : "stdout");
    }
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
