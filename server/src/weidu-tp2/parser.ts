/**
 * Tree-sitter parser for WeiDU TP2.
 */

import { createParserModule } from "../shared/parser-factory";

const parserModule = createParserModule("tree-sitter-weidu_tp2.wasm", "WeiDU TP2");

export const initParser = parserModule.init.bind(parserModule);
export const getParser = parserModule.getParser.bind(parserModule);
export const isInitialized = parserModule.isInitialized.bind(parserModule);
