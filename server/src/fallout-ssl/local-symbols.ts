/**
 * Local symbol extraction for Fallout SSL files.
 *
 * Converts the current document's AST to IndexedSymbol[] for unified
 * hover/completion/definition handling. This is the bridge between
 * AST-based local analysis and the indexed symbol lookup system.
 *
 * Cached by text hash for performance - same text returns same result.
 */

import { MarkupKind } from "vscode-languageserver/node";
import type { IndexedSymbol, CallableSymbol, ConstantSymbol } from "../core/symbol";
import { SourceType, ScopeLevel, SymbolKind } from "../core/symbol";
import { buildSymbol, type RawSymbolData, type ParameterData } from "../core/symbol-builder";
import { TextCache } from "../shared/text-cache";
import { parseWithCache, isInitialized } from "./parser";
import { extractProcedures, extractMacros, findPrecedingDocComment, makeRange, extractParams } from "./utils";
import { buildMacroTooltip, buildMacroCompletion } from "./macro-utils";
import * as jsdoc from "../shared/jsdoc";

/** Cached local symbols data: symbols array + name lookup map */
interface LocalSymbolsData {
    symbols: IndexedSymbol[];
    byName: Map<string, IndexedSymbol>;
}

/** LRU cache for local symbols */
const cache = new TextCache<LocalSymbolsData>();

/**
 * Parse document and build local symbols data.
 * Called by cache on miss.
 */
function parseLocalSymbols(text: string, uri: string): LocalSymbolsData | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const symbols: IndexedSymbol[] = [];
    const root = tree.rootNode;

    // Extract procedures
    const procedures = extractProcedures(root);
    for (const [name, { node }] of procedures) {
        const range = makeRange(node);
        const docComment = findPrecedingDocComment(root, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;

        // Extract parameter info with defaults from AST only (not JSDoc)
        const astParams = extractParams(node);
        const parameters: ParameterData[] = astParams.map(p => {
            // Find JSDoc for this param (for type and description only)
            const jsdocArg = parsed?.args.find(a => a.name === p.name);
            return {
                name: p.name,
                type: jsdocArg?.type,
                description: jsdocArg?.description,
                defaultValue: p.defaultValue,
            };
        });

        const rawData: RawSymbolData = {
            name,
            kind: SymbolKind.Procedure,
            location: { uri, range },
            scope: { level: ScopeLevel.File },
            source: { type: SourceType.Document, uri },
            parameters: parameters.length > 0 ? parameters : undefined,
            description: parsed?.desc,
            returnType: parsed?.ret?.type,
        };

        symbols.push(buildSymbol(rawData));
    }

    // Extract macros
    const macros = extractMacros(root);
    for (const macro of macros) {
        const macroHover = {
            kind: MarkupKind.Markdown,
            value: buildMacroTooltip(macro, ""),
        };
        const completion = buildMacroCompletion(macro, "", "");
        const location = macro.node ? { uri, range: makeRange(macro.node) } : null;

        const base = {
            name: macro.name,
            location,
            scope: { level: ScopeLevel.File },
            source: { type: SourceType.Document, uri, displayPath: undefined },
            completion,
            hover: { contents: macroHover },
            signature: undefined,
        };

        if (macro.hasParams) {
            symbols.push({
                ...base,
                kind: SymbolKind.Macro,
                callable: {
                    params: macro.params?.map(p => ({ name: p })),
                },
            } as CallableSymbol);
        } else {
            symbols.push({
                ...base,
                kind: SymbolKind.Constant,
                constant: {
                    value: macro.body ?? "",
                },
            } as ConstantSymbol);
        }
    }

    // Extract file-level variables and exports
    for (const node of root.children) {
        if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        const rawData: RawSymbolData = {
                            name: nameNode.text,
                            kind: SymbolKind.Variable,
                            location: { uri, range: makeRange(child) },
                            scope: { level: ScopeLevel.File },
                            source: { type: SourceType.Document, uri },
                        };
                        symbols.push(buildSymbol(rawData));
                    }
                }
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const rawData: RawSymbolData = {
                    name: nameNode.text,
                    kind: SymbolKind.Variable,
                    location: { uri, range: makeRange(node) },
                    scope: { level: ScopeLevel.File },
                    source: { type: SourceType.Document, uri },
                    description: "export variable",
                };
                symbols.push(buildSymbol(rawData));
            }
        }
    }

    // Build name lookup map (first definition wins)
    const byName = new Map<string, IndexedSymbol>();
    for (const sym of symbols) {
        if (!byName.has(sym.name)) {
            byName.set(sym.name, sym);
        }
    }

    return { symbols, byName };
}

/**
 * Get all local symbols from the current document.
 */
export function getLocalSymbols(text: string, uri: string): IndexedSymbol[] {
    return cache.getOrParse(uri, text, parseLocalSymbols)?.symbols ?? [];
}

/**
 * Look up a local symbol by name. O(1) via cached map.
 */
export function lookupLocalSymbol(name: string, text: string, uri: string): IndexedSymbol | undefined {
    return cache.getOrParse(uri, text, parseLocalSymbols)?.byName.get(name);
}

/**
 * Clear cache for a specific URI.
 */
export function clearLocalSymbolsCache(uri: string): void {
    cache.clear(uri);
}

/**
 * Clear entire cache (for testing).
 */
export function clearAllLocalSymbolsCache(): void {
    cache.clearAll();
}
