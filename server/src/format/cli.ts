#!/usr/bin/env node
/**
 * CLI tool to format Fallout SSL files
 * Usage: node format-cli.js <file.ssl|dir> [--save] [-r]
 */

import * as fs from "fs";
import * as path from "path";
import { formatDocument } from "../fallout-ssl/format-core";
import { initParser, getParser } from "./parser";

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

type FormatResult = "changed" | "unchanged" | "error";

function formatFile(filePath: string, save: boolean): FormatResult {
    const text = fs.readFileSync(filePath, "utf-8");
    const tree = getParser().parse(text);
    if (!tree) {
        console.error(`Error: Failed to parse ${filePath}`);
        return "error";
    }

    const formatted = formatDocument(tree.rootNode);

    if (save) {
        if (formatted !== text) {
            fs.writeFileSync(filePath, formatted);
            console.log(`Formatted: ${filePath}`);
            return "changed";
        }
        return "unchanged";
    } else {
        process.stdout.write(formatted);
        return formatted !== text ? "changed" : "unchanged";
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: format-cli <file.ssl|dir> [--save] [-r]");
        console.log("  --save    Write formatted output back to file(s)");
        console.log("  -r        Recursively format all .ssl files in directory");
        console.log("  Without --save, prints to stdout (single file only)");
        process.exit(0);
    }

    const target = args.find(a => !a.startsWith("-"));
    const saveToFile = args.includes("--save");
    const recursive = args.includes("-r") || args.includes("--recursive");

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
        if (!saveToFile) {
            console.error("Error: --save is required for recursive formatting.");
            process.exit(1);
        }
        const files = findFiles(target, ".ssl");
        console.log(`Found ${files.length} .ssl files`);
        let changed = 0, unchanged = 0, errors = 0;
        for (const file of files) {
            const result = formatFile(file, true);
            if (result === "changed") changed++;
            else if (result === "unchanged") unchanged++;
            else errors++;
        }
        console.log(`\nSummary: ${changed} changed, ${unchanged} unchanged, ${errors} errors`);
        if (errors > 0) {
            process.exit(1);
        }
    } else {
        formatFile(target, saveToFile);
    }
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
