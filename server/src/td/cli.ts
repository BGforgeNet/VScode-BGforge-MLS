#!/usr/bin/env node
/**
 * CLI tool to transpile TD (TypeScript Dialog) files to WeiDU D format
 * Usage: node td-cli.js <file.td> [--save]
 */

import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";
import { EXT_TD } from "../core/languages";
import { bundle } from "../tbaf/bundle";
import { emitD } from "./emit";
import { TDParser } from "./parse";

async function transpileFile(filePath: string, save: boolean): Promise<boolean> {
    if (!filePath.toLowerCase().endsWith(EXT_TD)) {
        console.error(`Error: ${filePath} is not a ${EXT_TD} file`);
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
        const parser = new TDParser();
        const ir = parser.parse(sourceFile);
        ir.sourceFile = filePath;

        // Emit D code
        const dCode = emitD(ir);

        if (save) {
            const dPath = filePath.replace(/\.td$/i, ".d");
            fs.writeFileSync(dPath, dCode, "utf-8");
            console.log(`Transpiled: ${filePath} -> ${path.basename(dPath)}`);
        } else {
            process.stdout.write(dCode);
        }

        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error transpiling ${filePath}: ${msg}`);
        return false;
    }
}

function findTdFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findTdFiles(fullPath));
        } else if (entry.name.toLowerCase().endsWith(EXT_TD)) {
            files.push(fullPath);
        }
    }
    return files;
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: td-cli <file.td|dir> [--save] [-r]");
        console.log("  --save    Write .d output to file (default: stdout)");
        console.log("  -r        Recursively transpile all .td files in directory");
        console.log("");
        console.log("Examples:");
        console.log("  td-cli mydialog.td              # Print D output to stdout");
        console.log("  td-cli mydialog.td --save       # Write mydialog.d");
        console.log("  td-cli dialogs/ -r --save       # Transpile all .td files in dialogs/");
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

        const files = findTdFiles(target);
        if (files.length === 0) {
            console.error(`No ${EXT_TD} files found in ${target}`);
            process.exit(1);
        }

        console.error(`Found ${files.length} ${EXT_TD} files`);
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
