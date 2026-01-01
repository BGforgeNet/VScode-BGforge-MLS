#!/usr/bin/env node
/**
 * Binary file parser CLI tool
 *
 * Parses binary files (e.g., Fallout PRO files) and outputs structured JSON.
 * Supports single files or recursive directory processing.
 *
 * Usage:
 *   pnpx tsx client/src/bin-cli.ts <file|dir> [options]
 *
 * Options:
 *   --save        Save parsed JSON alongside the binary file (.json)
 *   --check       Compare parsed output against existing .json snapshot
 *   -q, --quiet   Only print errors (suppress OK messages)
 *   -r, --recursive  Process directories recursively
 *
 * Examples:
 *   # Parse single file to stdout
 *   pnpx tsx client/src/bin-cli.ts file.pro
 *
 *   # Save JSON snapshots for all files in directory
 *   pnpx tsx client/src/bin-cli.ts proto/ -r --save
 *
 *   # Verify files match snapshots (CI/testing)
 *   pnpx tsx client/src/bin-cli.ts proto/ -r -q --check
 *
 * Exit codes:
 *   0 - Success (all files parsed/checked OK)
 *   1 - Error (parse failure, missing snapshot, or diff detected)
 */
import * as fs from "fs";
import * as path from "path";
import { parserRegistry } from "./parsers";

const args = process.argv.slice(2);
const save = args.includes("--save");
const check = args.includes("--check");
const quiet = args.includes("-q") || args.includes("--quiet");
const recursive = args.includes("-r") || args.includes("--recursive");
const target = args.find(a => !a.startsWith("-"));

if (!target) {
    console.error("Usage: bin-cli <file|dir> [--save] [--check] [-q|--quiet] [-r|--recursive]");
    console.error("");
    console.error("Options:");
    console.error("  --save       Save parsed JSON alongside the binary file");
    console.error("  --check      Compare parsed output against existing JSON");
    console.error("  -q, --quiet  Only print errors and warnings");
    console.error("  -r, --recursive  Process directory recursively");
    process.exit(1);
}

/**
 * Find all parseable files in a directory recursively
 * Handles circular symlinks by tracking visited directories
 */
function findFiles(dir: string): string[] {
    const files: string[] = [];
    const extensions = new Set(parserRegistry.getExtensions());
    const visited = new Set<string>();

    function walk(currentDir: string) {
        // Resolve real path to detect circular symlinks
        let realDir: string;
        try {
            realDir = fs.realpathSync(currentDir);
        } catch {
            console.error(`Cannot resolve path: ${currentDir}`);
            return;
        }

        if (visited.has(realDir)) {
            return; // Circular symlink or already visited
        }
        visited.add(realDir);

        let entries;
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (err) {
            console.error(`Cannot read directory ${currentDir}: ${err}`);
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            try {
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).slice(1).toLowerCase();
                    if (extensions.has(ext)) {
                        files.push(fullPath);
                    }
                }
            } catch (err) {
                console.error(`Cannot access ${fullPath}: ${err}`);
            }
        }
    }

    walk(dir);
    return files.sort();
}

/**
 * Process a single file. Returns true if successful, false if error.
 */
function processFile(file: string): boolean {
    const ext = path.extname(file);
    const parser = parserRegistry.getByExtension(ext);

    if (!parser) {
        console.error(`No parser for extension: ${ext} (${file})`);
        return false;
    }

    let data: Buffer;
    try {
        data = fs.readFileSync(file);
    } catch (err) {
        console.error(`Error reading ${file}: ${err}`);
        return false;
    }

    const result = parser.parse(new Uint8Array(data));

    // Check for parse errors
    if (result.errors && result.errors.length > 0) {
        console.error(`Error parsing ${file}:`);
        for (const err of result.errors) {
            console.error(`  ${err}`);
        }
        return false;
    }

    const json = JSON.stringify(result, null, 2);
    const jsonPath = file.replace(/\.[^.]+$/, ".json");

    if (save) {
        fs.writeFileSync(jsonPath, json + "\n");
        if (!quiet) {
            console.log(`Saved: ${jsonPath}`);
        }
    } else if (check) {
        if (!fs.existsSync(jsonPath)) {
            console.error(`Missing: ${jsonPath}`);
            return false;
        }
        const expected = fs.readFileSync(jsonPath, "utf-8").trim();
        if (json !== expected) {
            console.error(`DIFF: ${file}`);
            // Simple line-by-line diff
            const actualLines = json.split("\n");
            const expectedLines = expected.split("\n");
            const maxLines = Math.max(actualLines.length, expectedLines.length);
            for (let i = 0; i < maxLines; i++) {
                if (actualLines[i] !== expectedLines[i]) {
                    console.error(`  Line ${i + 1}:`);
                    console.error(`    - ${expectedLines[i] ?? "(missing)"}`);
                    console.error(`    + ${actualLines[i] ?? "(missing)"}`);
                }
            }
            return false;
        }
        if (!quiet) {
            console.log(`OK: ${file}`);
        }
    } else if (!quiet) {
        // Just dump JSON to stdout
        console.log(json);
    }

    return true;
}

// Main logic
let stat;
try {
    stat = fs.statSync(target);
} catch (err) {
    console.error(`Cannot access ${target}: ${err}`);
    process.exit(1);
}

if (stat.isDirectory()) {
    if (!recursive) {
        console.error(`${target} is a directory. Use -r to process recursively.`);
        process.exit(1);
    }

    const files = findFiles(target);
    if (files.length === 0) {
        console.error(`No parseable files found in ${target}`);
        process.exit(1);
    }

    let hasErrors = false;
    let processed = 0;
    let failed = 0;

    for (const file of files) {
        const success = processFile(file);
        processed++;
        if (!success) {
            hasErrors = true;
            failed++;
        }
    }

    if (!quiet || hasErrors) {
        console.log(`\nProcessed ${processed} files, ${failed} failed.`);
    }

    process.exit(hasErrors ? 1 : 0);
} else {
    // Single file mode
    const success = processFile(target);
    process.exit(success ? 0 : 1);
}
