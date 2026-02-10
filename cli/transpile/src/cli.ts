#!/usr/bin/env node
/**
 * CLI tool to transpile TD, TBAF, and TSSL files to WeiDU D, BAF, and Fallout SSL formats.
 * Auto-detects language by file extension.
 * Usage: node transpile-cli.js <file.td|file.tbaf|file.tssl|dir> [--save] [--check] [-r] [-q]
 */

import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";
import { EXT_TD, EXT_TBAF, EXT_TSSL } from "../../../server/src/core/languages";
import { bundle } from "../../../server/src/tbaf/bundle";
import { emitD } from "../../../server/src/td/emit";
import { TDParser } from "../../../server/src/td/parse";
import { emitBAF } from "../../../server/src/tbaf/emit";
import { TBAFTransformer } from "../../../server/src/tbaf/transform";
import { transpile as transpileTSSL } from "../../../server/src/tssl";
import { parseCliArgs, runCli, safeProcess, reportDiff, FileResult, OutputMode } from "../../cli-utils";

type TranspileType = "td" | "tbaf" | "tssl";

const EXTENSIONS = [EXT_TD, EXT_TBAF, EXT_TSSL];

function getTranspileType(filePath: string): TranspileType | null {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(EXT_TD)) return "td";
    if (lower.endsWith(EXT_TBAF)) return "tbaf";
    if (lower.endsWith(EXT_TSSL)) return "tssl";
    return null;
}

function getOutputPath(filePath: string, type: TranspileType): string {
    if (type === "td") {
        return filePath.replace(/\.td$/i, ".d");
    }
    if (type === "tssl") {
        return filePath.replace(/\.tssl$/i, ".ssl");
    }
    return filePath.replace(/\.tbaf$/i, ".baf");
}

async function processFile(filePath: string, mode: OutputMode): Promise<FileResult> {
    const type = getTranspileType(filePath);
    if (!type) {
        console.error(`Error: Unsupported file type: ${filePath} (expected ${EXT_TD}, ${EXT_TBAF}, or ${EXT_TSSL})`);
        return "error";
    }

    return safeProcess(filePath, async () => {
        const text = fs.readFileSync(filePath, "utf-8");

        let output: string;
        if (type === "tssl") {
            // TSSL has its own bundling and transformation pipeline
            output = await transpileTSSL(path.resolve(filePath), text);
        } else {
            // Only bundle if the file has imports (esbuild transforms break block-scoped functions)
            const hasImports = /^\s*(import|export\s+\*\s+from)\s+/m.test(text);
            const code = hasImports ? await bundle(filePath, text) : text;

            // Parse to IR
            const project = new Project({ useInMemoryFileSystem: true });
            const sourceFile = project.createSourceFile("bundled.ts", code);

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
                reportDiff(filePath, existing ?? "", output);
                return "changed";
            }
            return "unchanged";
        } else {
            process.stdout.write(output);
            return "changed";
        }
    });
}

const HELP = `Usage: transpile-cli <file.td|file.tbaf|file.tssl|dir> [--save] [--check] [-r] [-q]
  --save    Write output to file (default: stdout)
  --check   Check if output files are up to date (exit 1 if not)
  -r        Recursively transpile all .td, .tbaf, and .tssl files in directory
  -q        Quiet mode: suppress summary, only print changed files

Examples:
  transpile-cli mydialog.td              # Print D output to stdout
  transpile-cli mydialog.td --save       # Write mydialog.d
  transpile-cli myscript.tbaf --save     # Write myscript.baf
  transpile-cli myscript.tssl --save     # Write myscript.ssl
  transpile-cli src/ -r --save           # Transpile all .td, .tbaf, and .tssl files
  transpile-cli src/ -r --check          # Check all outputs are up to date`;

async function main() {
    const args = parseCliArgs(HELP);
    if (!args) return;

    await runCli({
        args,
        extensions: EXTENSIONS,
        description: ".td, .tbaf, and .tssl",
        processFile,
    });
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
