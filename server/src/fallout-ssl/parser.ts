/**
 * Tree-sitter parser for Fallout SSL with caching.
 */

import { createCachedParserModule } from "../shared/parser-factory";

const parserModule = createCachedParserModule("tree-sitter-ssl.wasm", "SSL");

export const initParser = parserModule.init.bind(parserModule);
export const getParser = parserModule.getParser.bind(parserModule);
export const isInitialized = parserModule.isInitialized.bind(parserModule);
export const parseWithCache = parserModule.parseWithCache.bind(parserModule);
