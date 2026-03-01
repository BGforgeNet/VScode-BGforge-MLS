/**
 * Local symbol extraction for Fallout SSL files.
 *
 * Converts the current document's AST to IndexedSymbol[] for unified
 * hover/completion/definition handling. Builds language-specific hover
 * and completion directly (following the TP2 pattern), avoiding the
 * generic symbol-builder path.
 *
 * Cached by text hash for performance - same text returns same result.
 */

import { CompletionItemKind, MarkupKind } from "vscode-languageserver/node";
import type { IndexedSymbol, CallableSymbol, ConstantSymbol, VariableSymbol } from "../core/symbol";
import { SourceType, ScopeLevel, SymbolKind } from "../core/symbol";
import { LANG_FALLOUT_SSL_TOOLTIP } from "../core/languages";
import { buildSignatureBlock } from "../shared/tooltip-format";
import { TextCache } from "../shared/text-cache";
import { parseWithCache, isInitialized } from "./parser";
import { extractProcedures, extractMacros, findPrecedingDocComment, makeRange, extractParams, buildProcedureSignature, buildTooltipBase } from "./utils";
import { buildMacroTooltip, buildMacroCompletion, buildSignatureFromJSDoc } from "./macro-utils";
import * as jsdoc from "../shared/jsdoc";
import type { SigInfoEx } from "../shared/signature";

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

    // Extract procedures - build language-specific hover/completion directly
    const procedures = extractProcedures(root);
    for (const [name, { node }] of procedures) {
        const range = makeRange(node);
        const docComment = findPrecedingDocComment(root, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;

        const astParams = extractParams(node);
        const sig = buildProcedureSignature(name, astParams, parsed);
        const hoverValue = buildTooltipBase(sig, parsed);

        const hoverContents = {
            kind: MarkupKind.Markdown,
            value: hoverValue,
        };

        // Build signature help from JSDoc if available.
        // SigInfoEx extends SignatureInformation so it can be used directly.
        const sigHelp: SigInfoEx | undefined = parsed && parsed.args.length > 0
            ? buildSignatureFromJSDoc(name, parsed, uri)
            : undefined;

        const symbol: CallableSymbol = {
            name,
            kind: SymbolKind.Procedure,
            location: { uri, range },
            scope: { level: ScopeLevel.File },
            source: { type: SourceType.Document, uri },
            completion: {
                label: name,
                kind: CompletionItemKind.Function,
                documentation: hoverContents,
            },
            hover: { contents: hoverContents },
            signature: sigHelp,
            callable: {
                parameters: astParams.map(p => {
                    const jsdocArg = parsed?.args.find(a => a.name === p.name);
                    return {
                        name: p.name,
                        type: jsdocArg?.type,
                        description: jsdocArg?.description,
                        defaultValue: p.defaultValue,
                    };
                }),
            },
        };

        symbols.push(symbol);
    }

    // Extract macros - already built with language-specific formatters
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
                    parameters: macro.params?.map(p => ({ name: p })),
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

    // Extract file-level variables and exports - use language-tagged code fence
    for (const node of root.children) {
        if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        symbols.push(buildVariableSymbol(nameNode.text, uri, makeRange(child)));
                    }
                }
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                symbols.push(buildVariableSymbol(nameNode.text, uri, makeRange(node), "export variable"));
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
 * Build a VariableSymbol with language-tagged code fence hover.
 */
function buildVariableSymbol(
    name: string,
    uri: string,
    range: { start: { line: number; character: number }; end: { line: number; character: number } },
    description?: string,
): VariableSymbol {
    const hoverValue = buildSignatureBlock(name, LANG_FALLOUT_SSL_TOOLTIP);
    const hoverContents = {
        kind: MarkupKind.Markdown,
        value: description
            ? hoverValue + "\n\n" + description
            : hoverValue,
    };

    return {
        name,
        kind: SymbolKind.Variable,
        location: { uri, range },
        scope: { level: ScopeLevel.File },
        source: { type: SourceType.Document, uri },
        completion: {
            label: name,
            kind: CompletionItemKind.Variable,
        },
        hover: { contents: hoverContents },
        signature: undefined,
        variable: {
            type: "unknown",
            description,
        },
    };
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
