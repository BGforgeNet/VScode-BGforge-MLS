#!/usr/bin/env node
/**
 * CLI tool to transpile TD and TBAF files to WeiDU D and BAF formats.
 * Auto-detects language by file extension.
 * Usage: node transpile-cli.js <file.td|file.tbaf|dir> [--save] [--check] [-r] [-q]
 */

import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";
import { EXT_TD, EXT_TBAF } from "../../../server/src/core/languages";
import { bundle } from "../../../server/src/tbaf/bundle";
import { emitD } from "../../../server/src/td/emit";
import { TDParser } from "../../../server/src/td/parse";
import { emitBAF } from "../../../server/src/tbaf/emit";
import { TBAFTransformer } from "../../../server/src/tbaf/transform";
import { parseCliArgs, runCli, FileResult, OutputMode } from "../../cli-utils";

type TranspileType = "td" | "tbaf";

const EXTENSIONS = [EXT_TD, EXT_TBAF];

function getTranspileType(filePath: string): TranspileType | null {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(EXT_TD)) return "td";
    if (lower.endsWith(EXT_TBAF)) return "tbaf";
    return null;
}

function getOutputPath(filePath: string, type: TranspileType): string {
    if (type === "td") {
        return filePath.replace(/\.td$/i, ".d");
    }
    return filePath.replace(/\.tbaf$/i, ".baf");
}

async function processFile(filePath: string, mode: OutputMode): Promise<FileResult> {
    const type = getTranspileType(filePath);
    if (!type) {
        console.error(`Error: Unsupported file type: ${filePath} (expected ${EXT_TD} or ${EXT_TBAF})`);
        return "error";
    }

    try {
        const text = fs.readFileSync(filePath, "utf-8");

        // Only bundle if the file has imports (esbuild transforms break block-scoped functions)
        const hasImports = /^\s*(import|export\s+\*\s+from)\s+/m.test(text);
        const code = hasImports ? await bundle(filePath, text) : text;

        // Parse to IR
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile("bundled.ts", code);

        let output: string;
        if (type === "td") {
            const parser = new TDParser();
            const ir = parser.parse(sourceFile);
            ir.sourceFile = filePath;
            output = emitD(ir);
        } else {
            const transformer = new TBAFTransformer();
            const ir = transformer.transform(sourceFile);
            output = emitBAF(ir);
        }

        const outPath = getOutputPath(filePath, type);

        if (mode === "save") {
            const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf-8") : null;
            if (existing !== output) {
                fs.writeFileSync(outPath, output, "utf-8");
                console.log(`Transpiled: ${filePath} -> ${path.basename(outPath)}`);
                return "changed";
            }
            return "unchanged";
        } else if (mode === "check") {
            const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf-8") : null;
            if (existing !== output) {
                console.log(`Would transpile: ${filePath} -> ${path.basename(outPath)}`);
                return "changed";
            }
            return "unchanged";
        } else {
            process.stdout.write(output);
            return "changed";
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error transpiling ${filePath}: ${msg}`);
        return "error";
    }
}

const HELP = `Usage: transpile-cli <file.td|file.tbaf|dir> [--save] [--check] [-r] [-q]
  --save    Write output to file (default: stdout)
  --check   Check if output files are up to date (exit 1 if not)
  -r        Recursively transpile all .td and .tbaf files in directory
  -q        Quiet mode: suppress summary, only print changed files

Examples:
  transpile-cli mydialog.td              # Print D output to stdout
  transpile-cli mydialog.td --save       # Write mydialog.d
  transpile-cli myscript.tbaf --save     # Write myscript.baf
  transpile-cli src/ -r --save           # Transpile all .td and .tbaf files
  transpile-cli src/ -r --check          # Check all outputs are up to date`;

async function main() {
    const args = parseCliArgs(HELP);
    if (!args) return;

    await runCli({
        args,
        extensions: EXTENSIONS,
        description: ".td and .tbaf",
        processFile,
    });
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
