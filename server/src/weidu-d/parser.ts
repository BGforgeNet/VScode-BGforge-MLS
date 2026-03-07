/**
 * Tree-sitter parser for WeiDU D with caching.
 */

import { createCachedParserModule } from "../shared/parser-factory";

const parserModule = createCachedParserModule("tree-sitter-weidu_d.wasm", "WeiDU D");

export const initParser = () => parserModule.init();
export const getParser = () => parserModule.getParser();
export const isInitialized = () => parserModule.isInitialized();
export const parseWithCache = (text: string) => parserModule.parseWithCache(text);
