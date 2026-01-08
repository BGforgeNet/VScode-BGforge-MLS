/**
 * Debug script to see what esbuild produces for triggers.td
 */

import * as esbuild from "esbuild-wasm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    await esbuild.initialize({});
    const filePath = path.join(__dirname, "samples/triggers.td");
    const text = fs.readFileSync(filePath, "utf-8");
    const result = await esbuild.build({
        stdin: {
            contents: text,
            resolveDir: path.dirname(filePath),
            sourcefile: filePath,
            loader: "ts",
        },
        bundle: true,
        write: false,
        format: "esm",
        platform: "neutral",
        target: "esnext",
        minify: false,
    });
    console.log(result.outputFiles[0].text);
}

main();
