#!/usr/bin/env node
/**
 * CLI tool to transpile TBAF (TypeScript BAF) files to WeiDU BAF format
 * Usage: node tbaf-cli.js <file.tbaf> [--save]
 */

import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";
import { EXT_TBAF } from "../core/languages";
import { bundle } from "./bundle";
import { emitBAF } from "./emit";
import { TBAFTransformer } from "./transform";

async function transpileFile(filePath: string, save: boolean): Promise<boolean> {
    if (!filePath.toLowerCase().endsWith(EXT_TBAF)) {
        console.error(`Error: ${filePath} is not a ${EXT_TBAF} file`);
        return false;
    }

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        return false;
    }

    try {
        const text = fs.readFileSync(filePath, "utf-8");

        // Only bundle if the file has imports
        const hasImports = /^\s*(import|export\s+\*\s+from)\s+/m.test(text);
        const code = hasImports ? await bundle(filePath, text) : text;

        // Parse to IR
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile("bundled.ts", code);
        const transformer = new TBAFTransformer();
        const ir = transformer.transform(sourceFile);

        // Emit BAF code
        const bafCode = emitBAF(ir);

        if (save) {
            const bafPath = filePath.replace(/\.tbaf$/i, ".baf");
            fs.writeFileSync(bafPath, bafCode, "utf-8");
            console.log(`Transpiled: ${filePath} -> ${path.basename(bafPath)}`);
        } else {
            process.stdout.write(bafCode);
        }

        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error transpiling ${filePath}: ${msg}`);
        return false;
    }
}

function findTbafFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findTbafFiles(fullPath));
        } else if (entry.name.toLowerCase().endsWith(EXT_TBAF)) {
            files.push(fullPath);
        }
    }
    return files;
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log("Usage: tbaf-cli <file.tbaf|dir> [--save] [-r]");
        console.log("  --save    Write .baf output to file (default: stdout)");
        console.log("  -r        Recursively transpile all .tbaf files in directory");
        console.log("");
        console.log("Examples:");
        console.log("  tbaf-cli myscript.tbaf              # Print BAF output to stdout");
        console.log("  tbaf-cli myscript.tbaf --save       # Write myscript.baf");
        console.log("  tbaf-cli scripts/ -r --save         # Transpile all .tbaf files in scripts/");
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

        const files = findTbafFiles(target);
        if (files.length === 0) {
            console.error(`No ${EXT_TBAF} files found in ${target}`);
            process.exit(1);
        }

        console.error(`Found ${files.length} ${EXT_TBAF} files`);
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
