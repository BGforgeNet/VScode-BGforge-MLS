/**
 * Shared parser initialization for Fallout SSL formatter.
 */

import { Parser, Language } from "web-tree-sitter";
import * as path from "path";
import * as fs from "fs";

let parser: Parser | null = null;
let language: Language | null = null;
let initialized = false;

export async function initParser(): Promise<void> {
    if (initialized) return;

    const wasmBinary = fs.readFileSync(path.join(__dirname, "web-tree-sitter.wasm"));
    await Parser.init({ wasmBinary });

    parser = new Parser();
    const sslWasmPath = path.join(__dirname, "tree-sitter-ssl.wasm");
    language = await Language.load(sslWasmPath);
    parser.setLanguage(language);
    initialized = true;
}

export function getParser(): Parser {
    if (!parser) {
        throw new Error("Parser not initialized. Call initParser() first.");
    }
    return parser;
}

export function isInitialized(): boolean {
    return initialized;
}
