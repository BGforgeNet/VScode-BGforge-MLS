#!/usr/bin/env node
/**
 * CLI tool to parse binary files (Fallout PRO) and output structured JSON.
 * Usage: node bin-cli.js <file.pro|dir> [--save] [--check] [-r] [-q]
 */

import * as fs from "fs";
import * as path from "path";
import { parserRegistry } from "../../../client/src/parsers";
import { parseCliArgs, runCli, safeProcess, reportDiff, FileResult, OutputMode } from "../../cli-utils";

const EXTENSIONS = parserRegistry.getExtensions().map(ext => `.${ext}`);

async function processFile(filePath: string, mode: OutputMode): Promise<FileResult> {
    return safeProcess(filePath, () => {
        const ext = path.extname(filePath);
        const parser = parserRegistry.getByExtension(ext);

        if (!parser) {
            console.error(`No parser for extension: ${ext} (${filePath})`);
            return "error";
        }

        const data = fs.readFileSync(filePath);
        const result = parser.parse(new Uint8Array(data));

        if (result.errors && result.errors.length > 0) {
            console.error(`Error parsing ${filePath}:`);
            for (const err of result.errors) {
                console.error(`  ${err}`);
            }
            return "error";
        }

        const json = JSON.stringify(result, null, 2);
        const jsonPath = filePath.replace(/\.[^.]+$/, ".json");

        if (mode === "save") {
            const existing = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf-8").trim() : null;
            if (existing !== json) {
                fs.writeFileSync(jsonPath, json + "\n");
                console.log(`Saved: ${jsonPath}`);
                return "changed";
            }
            return "unchanged";
        } else if (mode === "check") {
            if (!fs.existsSync(jsonPath)) {
                console.error(`Missing: ${jsonPath}`);
                return "error";
            }
            const expected = fs.readFileSync(jsonPath, "utf-8").trim();
            if (json !== expected) {
                reportDiff(filePath, expected, json);
                return "changed";
            }
            return "unchanged";
        } else {
            process.stdout.write(json + "\n");
            return "unchanged";
        }
    });
}

const HELP = `Usage: bin-cli <file.pro|dir> [--save] [--check] [-r] [-q]
  --save    Save parsed JSON alongside the binary file (.json)
  --check   Compare parsed output against existing .json snapshot (exit 1 if diff)
  -r        Recursively process all supported files in directory
  -q        Quiet mode: suppress summary, only print errors

Examples:
  bin-cli file.pro                  # Parse single file, print JSON to stdout
  bin-cli proto/ -r --save          # Save JSON snapshots for all files
  bin-cli proto/ -r -q --check      # Verify files match snapshots (CI)`;

async function main() {
    const args = parseCliArgs(HELP);
    if (!args) return;

    await runCli({
        args,
        extensions: EXTENSIONS,
        description: ".pro binary",
        processFile,
    });
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
