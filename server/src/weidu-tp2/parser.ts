/**
 * Tree-sitter parser for WeiDU TP2 with caching.
 * Uses cached parsing to avoid redundant parses of the same document.
 */

import { createCachedParserModule } from "../shared/parser-factory";

const parserModule = createCachedParserModule("tree-sitter-weidu_tp2.wasm", "WeiDU TP2");

export const initParser = parserModule.init.bind(parserModule);
export const getParser = parserModule.getParser.bind(parserModule);
export const isInitialized = parserModule.isInitialized.bind(parserModule);
export const parseWithCache = parserModule.parseWithCache.bind(parserModule);
