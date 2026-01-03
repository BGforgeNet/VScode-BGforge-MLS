#!/usr/bin/env node
/**
 * CLI tool to format Fallout SSL files
 * Usage: node format-cli.js <file.ssl|dir> [--save] [-r]
 */

import * as fs from "fs";
import * as path from "path";
import { formatDocument, FormatOptions, FormatError } from "../fallout-ssl/format-core";
import { initParser, getParser } from "./parser";
import * as editorconfig from "editorconfig";

function findFiles(dir: string, ext: string, files: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findFiles(fullPath, ext, files);
        } else if (entry.name.endsWith(ext)) {
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

function getFormatOptions(filePath: string): FormatOptions {
    const config = editorconfig.parseSync(filePath);
    return {
        indentSize: typeof config.indent_size === "number" ? config.indent_size : 4,
        maxLineLength: typeof config.max_line_length === "number" ? config.max_line_length : 120,
    };
}

type FormatMode = "save" | "stdout" | "check";

function formatFile(filePath: string, mode: FormatMode): FileResult {
    const text = fs.readFileSync(filePath, "utf-8");
    const tree = getParser().parse(text);
    if (!tree) {
        console.error(`Error: Failed to parse ${filePath}`);
        return "error";
    }

    const options = getFormatOptions(path.resolve(filePath));
    const result = formatDocument(tree.rootNode, options);

    // Print any errors (reserved words used as identifiers, etc.)
    if (result.errors.length > 0) {
        printErrors(filePath, result.errors);
    }

    const changed = result.text !== text;
    if (mode === "save") {
        if (changed) {
            fs.writeFileSync(filePath, result.text);
            console.log(`Formatted: ${filePath}`);
        }
    } else if (mode === "stdout") {
        process.stdout.write(result.text);
    } else if (mode === "check" && changed) {
        console.log(`Would format: ${filePath}`);
    }
    return changed ? "changed" : "unchanged";
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: format-cli <file.ssl|dir> [--save] [-r] [-q]");
        console.log("  --save    Write formatted output back to file(s)");
        console.log("  -r        Recursively format all .ssl files in directory");
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

    await initParser();

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
        if (!recursive) {
            console.error("Error: Target is a directory. Use -r for recursive formatting.");
            process.exit(1);
        }
        const files = findFiles(target, ".ssl");
        if (!quiet) console.log(`Found ${files.length} .ssl files`);
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
