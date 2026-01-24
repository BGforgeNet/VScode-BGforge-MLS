#!/usr/bin/env node
/**
 * CLI tool to transpile TD and TBAF files to WeiDU D and BAF formats.
 * Auto-detects language by file extension.
 * Usage: node transpile-cli.js <file.td|file.tbaf|dir> [--save] [-r]
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

type TranspileType = "td" | "tbaf";

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

async function transpileFile(filePath: string, save: boolean): Promise<boolean> {
    const type = getTranspileType(filePath);
    if (!type) {
        console.error(`Error: Unsupported file type: ${filePath} (expected ${EXT_TD} or ${EXT_TBAF})`);
        return false;
    }

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        return false;
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

        if (save) {
            const outPath = getOutputPath(filePath, type);
            fs.writeFileSync(outPath, output, "utf-8");
            console.log(`Transpiled: ${filePath} -> ${path.basename(outPath)}`);
        } else {
            process.stdout.write(output);
        }

        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error transpiling ${filePath}: ${msg}`);
        return false;
    }
}

const SUPPORTED_EXTENSIONS = [EXT_TD, EXT_TBAF];

function findFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findFiles(fullPath));
        } else if (SUPPORTED_EXTENSIONS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: transpile-cli <file.td|file.tbaf|dir> [--save] [-r]");
        console.log("  --save    Write output to file (default: stdout)");
        console.log("  -r        Recursively transpile all .td and .tbaf files in directory");
        console.log("");
        console.log("Examples:");
        console.log("  transpile-cli mydialog.td              # Print D output to stdout");
        console.log("  transpile-cli mydialog.td --save       # Write mydialog.d");
        console.log("  transpile-cli myscript.tbaf --save     # Write myscript.baf");
        console.log("  transpile-cli src/ -r --save           # Transpile all .td and .tbaf files");
        process.exit(0);
    }

    const target = args.find(a => !a.startsWith("-"));
    const save = args.includes("--save");
    const recursive = args.includes("-r") || args.includes("--recursive");

    if (!target) {
        console.error("Error: No file or directory specified");
        process.exit(1);
    }

    if (!fs.existsSync(target)) {
        console.error(`Error: Not found: ${target}`);
        process.exit(1);
    }

    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
        if (!recursive) {
            console.error("Error: Target is a directory. Use -r for recursive.");
            process.exit(1);
        }

        const files = findFiles(target);
        if (files.length === 0) {
            console.error(`No ${EXT_TD} or ${EXT_TBAF} files found in ${target}`);
            process.exit(1);
        }

        console.error(`Found ${files.length} transpilable files`);
        let success = 0, failed = 0;

        for (const file of files) {
            const ok = await transpileFile(file, save);
            if (ok) success++;
            else failed++;
        }

        console.error(`\nSummary: ${success} succeeded, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } else {
        const ok = await transpileFile(target, save);
        if (!ok) process.exit(1);
    }
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
