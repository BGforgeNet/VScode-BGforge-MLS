/**
 * Tree-sitter parser for WeiDU BAF.
 */

import { createParserModule } from "../shared/parser-factory";

const parserModule = createParserModule("tree-sitter-baf.wasm", "BAF");

export const initParser = parserModule.init.bind(parserModule);
export const getParser = parserModule.getParser.bind(parserModule);
export const isInitialized = parserModule.isInitialized.bind(parserModule);
