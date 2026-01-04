/**
 * TBAF Transpiler - Main Entry Point
 *
 * Transpiles TypeScript BAF (.tbaf) to BAF format.
 */

import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";
import { conlog, uriToPath } from "../common";
import { bundle } from "./bundle";
import { emitBAF } from "./emit";
import { BAFScript, isOrGroup } from "./ir";
import { TBAFTransformer } from "./transform";

export const EXT_TBAF = ".tbaf";

/**
 * Compile a TBAF file to BAF.
 *
 * @param uri VSCode URI of the file
 * @param text Source text content
 * @returns Path to generated BAF file
 */
export async function compile(uri: string, text: string): Promise<string> {
    const filePath = uriToPath(uri);
    const ext = path.extname(filePath).toLowerCase();

    if (ext !== EXT_TBAF) {
        throw new Error(`${uri} is not a .tbaf file`);
    }

    // 1. Bundle imports
    const bundled = await bundle(filePath, text);

    // 2. Parse bundled code
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("bundled.ts", bundled);

    // 3. Transform AST to IR
    const transformer = new TBAFTransformer();
    const ir = transformer.transform(sourceFile);

    // Use original file path for the header comment
    ir.sourceFile = filePath;

    // 4. Apply BAF-specific fixups to IR
    applyBAFFixups(ir);

    // 5. Emit BAF text
    const baf = emitBAF(ir);

    // 6. Write output
    const bafPath = filePath.replace(/\.tbaf$/i, ".baf");
    fs.writeFileSync(bafPath, baf, "utf-8");

    conlog(`Transpiled to ${bafPath}`);
    return bafPath;
}

/**
 * Apply BAF-specific fixups to the IR.
 * Handles LOCALS/GLOBAL quoting, $obj(), $tra() replacements.
 */
function applyBAFFixups(script: BAFScript): void {
    for (const block of script.blocks) {
        // Fix conditions
        for (const cond of block.conditions) {
            if (isOrGroup(cond)) {
                for (const c of cond.conditions) {
                    fixupArgs(c.args);
                }
            } else {
                fixupArgs(cond.args);
            }
        }

        // Fix actions
        for (const action of block.actions) {
            fixupArgs(action.args);
        }
    }
}

/**
 * Apply BAF fixups to argument list.
 * Handles nested $obj() and $tra() calls within arguments.
 */
function fixupArgs(args: string[]): void {
    args.forEach((arg, i) => {
        args[i] = fixupArg(arg);
    });
}

/**
 * Apply BAF fixups to a single argument string.
 */
function fixupArg(arg: string): string {
    // LOCALS and GLOBAL should be quoted
    if (arg === "LOCALS") {
        return '"LOCALS"';
    }
    if (arg === "GLOBAL") {
        return '"GLOBAL"';
    }

    // $obj("[ANYONE]") => [ANYONE] (globally, handles nested calls)
    arg = arg.replace(/\$obj\("\[(.*?)\]"\)/g, "[$1]");

    // $obj("string") => "string" (globally, handles nested calls)
    arg = arg.replace(/\$obj\("(.*?)"\)/g, '"$1"');

    // $tra(123) => @123 (globally, handles nested calls)
    arg = arg.replace(/\$tra\((\d+)\)/g, "@$1");

    return arg;
}
