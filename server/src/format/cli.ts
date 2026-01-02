#!/usr/bin/env node
/**
 * CLI tool to format Fallout SSL files
 * Usage: node format-cli.js <file.ssl> [--save]
 */

import * as fs from "fs";
import { formatDocument } from "../fallout-ssl/format-core";
import { initParser, getParser } from "./parser";

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: format-cli <file.ssl> [--save]");
        console.log("  --save    Write formatted output back to file");
        console.log("  Without --save, prints to stdout");
        process.exit(0);
    }

    const filePath = args.find(a => !a.startsWith("-"));
    const saveToFile = args.includes("--save");

    if (!filePath) {
        console.error("Error: No file specified");
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }

    const text = fs.readFileSync(filePath, "utf-8");

    await initParser();
    const tree = getParser().parse(text);
    if (!tree) {
        console.error("Error: Failed to parse file");
        process.exit(1);
    }

    const formatted = formatDocument(tree.rootNode);

    if (saveToFile) {
        fs.writeFileSync(filePath, formatted);
        console.log(`Formatted: ${filePath}`);
    } else {
        // stdout.write avoids adding extra newline
        process.stdout.write(formatted);
    }
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
