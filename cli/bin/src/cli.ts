#!/usr/bin/env node
/**
 * CLI tool to parse binary files (Fallout PRO) and output structured JSON.
 * Also supports loading JSON back to binary via --load.
 * Usage: node bin-cli.js <file.pro|file.map|dir> [--save] [--check] [--load] [-r] [-q]
 */

import * as fs from "fs";
import * as path from "path";
import { parserRegistry, type ParseOptions, type ParseResult } from "../../../client/src/parsers";
import { parseCliArgs, runCli, safeProcess, reportDiff, FileResult, OutputMode } from "../../cli-utils";

const EXTENSIONS = parserRegistry.getExtensions().map(ext => `.${ext}`);
const CLI_PARSE_OPTIONS: ParseOptions = {
    gracefulMapBoundaries: process.argv.includes("--graceful-map"),
};

async function processFile(filePath: string, mode: OutputMode): Promise<FileResult> {
    return safeProcess(filePath, () => {
        const ext = path.extname(filePath);
        const parser = parserRegistry.getByExtension(ext);

        if (!parser) {
            console.error(`No parser for extension: ${ext} (${filePath})`);
            return "error";
        }

        const data = fs.readFileSync(filePath);
        const result = parser.parse(new Uint8Array(data), CLI_PARSE_OPTIONS);

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

const HELP = `Usage: bin-cli <file.pro|file.map|dir> [--save] [--check] [--load] [-r] [-q]
  --save    Save parsed JSON alongside the binary file (.json)
  --check   Compare parsed output against existing .json snapshot (exit 1 if diff)
  --load    Load JSON and write binary using the parser's native extension
  --graceful-map  Allow ambiguous MAP object boundaries to fall back to opaque bytes
  -r        Recursively process all supported files in directory
  -q        Quiet mode: suppress summary, only print errors

Examples:
  bin-cli file.pro                  # Parse single file, print JSON to stdout
  bin-cli proto/ -r --save          # Save JSON snapshots for all files
  bin-cli proto/ -r -q --check      # Verify files match snapshots (CI)
  bin-cli file.json --load          # Convert JSON back to binary (.pro/.map/etc.)`;

/**
 * Load a JSON file and serialize it back to binary format.
 * Validates by re-parsing the output and comparing to the input JSON.
 */
function loadJsonToBinary(jsonPath: string): void {
    if (!fs.existsSync(jsonPath)) {
        console.error(`Not found: ${jsonPath}`);
        process.exit(1);
    }

    const jsonText = fs.readFileSync(jsonPath, "utf-8");
    const result: ParseResult = JSON.parse(jsonText);

    // Determine the parser from the format field
    const parser = parserRegistry.getById(result.format);
    if (!parser) {
        console.error(`Unknown format: ${result.format}`);
        process.exit(1);
    }
    if (!parser.serialize) {
        console.error(`Parser "${result.format}" does not support serialization`);
        process.exit(1);
    }

    const bytes = parser.serialize(result);

    // Validate: re-parse the output and compare JSON
    const reparsed = parser.parse(bytes, CLI_PARSE_OPTIONS);
    if (reparsed.errors && reparsed.errors.length > 0) {
        console.error(`Validation failed: serialized bytes don't parse cleanly:`);
        for (const err of reparsed.errors) {
            console.error(`  ${err}`);
        }
        process.exit(1);
    }

    const outputExtension = parser.extensions[0];
    if (!outputExtension) {
        console.error(`Parser "${result.format}" does not declare an output extension`);
        process.exit(1);
    }

    const outputPath = jsonPath.replace(/\.json$/, `.${outputExtension}`);
    fs.writeFileSync(outputPath, bytes);
    console.log(`Wrote: ${outputPath} (${bytes.length} bytes)`);
}

async function main() {
    const argv = process.argv.slice(2);

    // Handle --load separately: it takes .json input, not .pro
    if (argv.includes("--load")) {
        const jsonPath = argv.find(a => !a.startsWith("-"));
        if (!jsonPath) {
            console.error("Error: No file specified");
            process.exit(1);
        }
        loadJsonToBinary(jsonPath);
        return;
    }

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
