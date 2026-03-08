/**
 * TBAF Transpiler - Main Entry Point
 *
 * Transpiles TypeScript BAF (.tbaf) to BAF format.
 */

import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";
import { conlog, uriToPath } from "../common";
import { EXT_TBAF } from "../core/languages";
import { applyHelperFixups, extractTraTag } from "../transpiler-utils";
import { bundle } from "./bundle";
import { emitBAF } from "./emit";
import { BAFScript, isOrGroup } from "./ir";
import { TBAFTransformer } from "./transform";

/**
 * Core transpilation pipeline: TBAF source text to BAF output string.
 * Shared by compile() (LSP, writes to disk) and transpile() (CLI, returns string).
 * @param filePath Absolute file path to the .tbaf file
 * @param text Source text content
 * @returns Generated BAF output string
 */
async function transpileCore(filePath: string, text: string): Promise<string> {
    // Extract @tra tag before bundling (esbuild strips comments)
    const traTag = extractTraTag(text);

    // 1. Bundle imports (skips bundling internally for files without imports)
    const bundled = await bundle(filePath, text);

    // 2. Parse bundled code
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("bundled.ts", bundled);

    // 3. Transform AST to IR
    const transformer = new TBAFTransformer();
    const ir = { ...transformer.transform(sourceFile), sourceFile: filePath, traTag };

    // 4. Apply BAF-specific fixups to IR
    applyBAFFixups(ir);

    // 5. Emit BAF text
    return emitBAF(ir);
}

/**
 * Compile a TBAF file to BAF, writing the output to disk.
 * Used by the LSP compile handler.
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

    const baf = await transpileCore(filePath, text);

    const bafPath = filePath.replace(/\.tbaf$/i, ".baf");
    fs.writeFileSync(bafPath, baf, "utf-8");

    conlog(`Transpiled to ${bafPath}`);
    return bafPath;
}

/**
 * Transpile TBAF to BAF, returning the output string without writing to disk.
 * Used by the CLI where the caller controls file I/O.
 * @param filePath Absolute file path to the .tbaf file
 * @param text Source text content
 * @returns Generated BAF output string
 */
export async function transpile(filePath: string, text: string): Promise<string> {
    return transpileCore(filePath, text);
}

/**
 * Apply BAF-specific fixups to the IR.
 * Handles LOCALS/GLOBAL quoting, $obj(), $tra(), point notation replacements.
 */
export function applyBAFFixups(script: BAFScript): void {
    for (const block of script.blocks) {
        // Fix conditions
        for (const cond of block.conditions) {
            if (isOrGroup(cond)) {
                for (const c of cond.conditions) {
                    c.args = fixupArgs(c.args);
                }
            } else {
                cond.args = fixupArgs(cond.args);
            }
        }

        // Fix actions
        for (const action of block.actions) {
            action.args = fixupArgs(action.args);
        }
    }
}

/**
 * Apply WeiDU helper fixups to argument list using shared resolution logic.
 * Returns a new array with fixups applied.
 */
function fixupArgs(args: readonly string[]): string[] {
    return args.map((arg) => applyHelperFixups(arg));
}
