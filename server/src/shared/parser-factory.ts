/**
 * Shared tree-sitter parser factory.
 * Creates parser modules for different grammars.
 */

import { Parser, Language } from "web-tree-sitter";
import * as path from "path";
import * as fs from "fs";

export interface ParserModule {
    init(): Promise<void>;
    getParser(): Parser;
    isInitialized(): boolean;
}

let treeSitterInitialized = false;

async function initTreeSitter(): Promise<void> {
    if (treeSitterInitialized) return;
    const wasmBinary = fs.readFileSync(path.join(__dirname, "web-tree-sitter.wasm"));
    await Parser.init({ wasmBinary });
    treeSitterInitialized = true;
}

/**
 * Creates a parser module for a specific grammar.
 * @param wasmFileName - Name of the grammar WASM file (e.g., "tree-sitter-baf.wasm")
 * @param name - Human-readable name for error messages
 */
export function createParserModule(wasmFileName: string, name: string): ParserModule {
    let parser: Parser | null = null;
    let initialized = false;

    return {
        async init(): Promise<void> {
            if (initialized) return;
            await initTreeSitter();
            parser = new Parser();
            const wasmPath = path.join(__dirname, wasmFileName);
            const language = await Language.load(wasmPath);
            parser.setLanguage(language);
            initialized = true;
        },

        getParser(): Parser {
            if (!parser) {
                throw new Error(`${name} parser not initialized. Call init() first.`);
            }
            return parser;
        },

        isInitialized(): boolean {
            return initialized;
        },
    };
}
