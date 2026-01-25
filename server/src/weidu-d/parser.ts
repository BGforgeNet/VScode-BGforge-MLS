/**
 * Tree-sitter parser for WeiDU D with caching.
 */

import { createCachedParserModule } from "../shared/parser-factory";

const parserModule = createCachedParserModule("tree-sitter-weidu_d.wasm", "WeiDU D");

export const initParser = parserModule.init.bind(parserModule);
export const getParser = parserModule.getParser.bind(parserModule);
export const isInitialized = parserModule.isInitialized.bind(parserModule);
export const parseWithCache = parserModule.parseWithCache.bind(parserModule);
