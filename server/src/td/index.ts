/**
 * TD Transpiler - Main Entry Point
 *
 * Transpiles TypeScript Dialog (.td.ts) to WeiDU D format.
 */

import * as fs from "fs";
import { Project } from "ts-morph";
import { conlog, uriToPath } from "../common";
import { EXT_TD } from "../core/languages";
import { bundle } from "../tbaf/bundle";
import { emitD } from "./emit";
import { TDParser } from "./parse";

/**
 * Compile a TD file to D.
 *
 * @param uri VSCode URI of the file
 * @param text Source text content
 * @returns Path to generated D file
 */
export async function compile(uri: string, text: string): Promise<string> {
    const filePath = uriToPath(uri);

    if (!filePath.toLowerCase().endsWith(EXT_TD)) {
        throw new Error(`${uri} is not a ${EXT_TD} file`);
    }

    // 1. Bundle imports (reuse TBAF bundler)
    const bundled = await bundle(filePath, text);

    // 2. Parse bundled code
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("bundled.ts", bundled);

    // 3. Parse AST to IR
    const parser = new TDParser();
    const ir = parser.parse(sourceFile);

    // Use original file path for the header comment
    ir.sourceFile = filePath;

    // 4. Apply D-specific fixups to IR
    applyDFixups(ir);

    // 5. Emit D text
    const d = emitD(ir);

    // 6. Write output
    const extRegex = new RegExp(EXT_TD.replace(".", "\\.") + "$", "i");
    const dPath = filePath.replace(extRegex, ".d");
    fs.writeFileSync(dPath, d, "utf-8");

    conlog(`Transpiled to ${dPath}`);
    return dPath;
}

/**
 * Apply D-specific fixups to the IR.
 * Handles tra() replacements and other WeiDU-specific transforms.
 */
function applyDFixups(_script: import("./types").TDScript): void {
    // Currently no special fixups needed.
    // The parser and emitter handle tra()/tlk() directly.
    // Future: could add fixups for action string formatting, etc.
}
