/**
 * Tree-sitter parser for WeiDU D.
 */

import { createParserModule } from "../shared/parser-factory";

const parserModule = createParserModule("tree-sitter-weidu_d.wasm", "WeiDU D");

export const initParser = parserModule.init.bind(parserModule);
export const getParser = parserModule.getParser.bind(parserModule);
export const isInitialized = parserModule.isInitialized.bind(parserModule);
