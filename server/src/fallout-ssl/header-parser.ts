/**
 * Fallout SSL header parsing utilities.
 * Handles tree-sitter-based parsing of .h files for procedures, macros,
 * variables, and exports.
 *
 * Main API: parseHeaderToSymbols() - Returns IndexedSymbol[] for unified storage.
 *
 * Symbol-building pattern: Tree-sitter AST with SSL-specific formatting.
 * Parses .h header files using the same SSL tree-sitter grammar and builds
 * IndexedSymbol with SSL-specific tooltip formatting (buildTooltipBase,
 * buildMacroTooltip, buildVariableSymbol). Follows the same approach as
 * local-symbols.ts but with Workspace scope/source instead of Document scope.
 */

import { CompletionItemKind } from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver/node";
import { computeDisplayPath } from "../core/location-utils";
import type { CallableSymbol, ConstantSymbol, IndexedSymbol } from "../core/symbol";
import { ScopeLevel, SourceType, SymbolKind } from "../core/symbol";
import * as jsdoc from "../shared/jsdoc";
import { type MacroData, buildMacroCompletion, buildMacroTooltip, buildSignatureFromJSDoc } from "./macro-utils";
import { buildTooltipBase, buildVariableSymbol, extractMacros, extractParams, extractProcedures, findPrecedingDocComment, makeRange, buildProcedureSignature } from "./utils";
import { isInitialized, parseWithCache } from "./parser";

// =============================================================================
// Unified Symbol API
// =============================================================================

/**
 * Parse a header file and return symbols for the unified index.
 * This is the preferred API - returns IndexedSymbol[] ready for Symbols storage.
 *
 * Uses tree-sitter AST parsing (same grammar as .ssl files) to extract
 * procedures and macros, including those indented inside #ifdef/#ifndef guards.
 *
 * @param uri File URI
 * @param text File content
 * @param workspaceRoot Workspace root for computing relative displayPath
 */
export function parseHeaderToSymbols(
    uri: string,
    text: string,
    workspaceRoot?: string,
): IndexedSymbol[] {
    const displayPath = computeDisplayPath(uri, workspaceRoot);

    // If tree-sitter is not initialized, return empty (graceful degradation)
    if (!isInitialized()) {
        return [];
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return [];
    }

    const root = tree.rootNode;
    const result: IndexedSymbol[] = [];

    // Extract procedures via tree-sitter AST
    const procedures = extractProcedures(root);
    for (const [name, { node }] of procedures) {
        const range = makeRange(node);
        const docComment = findPrecedingDocComment(root, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;

        const astParams = extractParams(node);
        const sig = buildProcedureSignature(name, astParams, parsed);
        const hoverValue = buildTooltipBase(sig, parsed, displayPath);

        const hoverContents = {
            kind: MarkupKind.Markdown,
            value: hoverValue,
        };

        const sigHelp = parsed && parsed.args.length > 0
            ? buildSignatureFromJSDoc(name, parsed, uri)
            : undefined;

        const symbol: CallableSymbol = {
            name,
            kind: SymbolKind.Procedure,
            location: { uri, range },
            scope: { level: ScopeLevel.Workspace },
            source: {
                type: SourceType.Workspace,
                uri,
                displayPath,
            },
            completion: {
                label: name,
                kind: CompletionItemKind.Function,
                labelDetails: { description: displayPath },
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
        result.push(symbol);
    }

    // Extract macros via tree-sitter AST
    const macros = extractMacros(root);
    for (const macro of macros) {
        const location = macro.node ? { uri, range: makeRange(macro.node) } : null;

        const macroData: MacroData = {
            name: macro.name,
            params: macro.params,
            hasParams: macro.hasParams,
            firstline: macro.firstline,
            multiline: macro.multiline,
            jsdoc: macro.jsdoc,
        };

        const hoverContents = {
            kind: MarkupKind.Markdown,
            value: buildMacroTooltip(macroData, displayPath),
        };
        const completionItem = buildMacroCompletion(macroData, uri, displayPath);

        const sig = macro.jsdoc && macro.jsdoc.args.length > 0
            ? buildSignatureFromJSDoc(macro.name, macro.jsdoc, uri)
            : undefined;

        if (macro.hasParams) {
            const symbol: CallableSymbol = {
                name: macro.name,
                kind: SymbolKind.Macro,
                location,
                scope: { level: ScopeLevel.Workspace },
                source: {
                    type: SourceType.Workspace,
                    uri,
                    displayPath,
                },
                completion: completionItem,
                hover: { contents: hoverContents },
                signature: sig,
                callable: { parameters: macro.params?.map(p => ({ name: p })) },
            };
            result.push(symbol);
        } else {
            const symbol: ConstantSymbol = {
                name: macro.name,
                kind: SymbolKind.Constant,
                location,
                scope: { level: ScopeLevel.Workspace },
                source: {
                    type: SourceType.Workspace,
                    uri,
                    displayPath,
                },
                completion: completionItem,
                hover: { contents: hoverContents },
                signature: sig,
                constant: { value: macro.firstline ?? "" },
            };
            result.push(symbol);
        }
    }

    // Extract top-level variables and exports
    for (const node of root.children) {
        if (node.type === "variable_decl") {
            const docComment = findPrecedingDocComment(root, node);
            const parsed = docComment ? jsdoc.parse(docComment) : null;
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        result.push(buildVariableSymbol(nameNode.text, uri, makeRange(child), undefined, parsed, displayPath));
                    }
                }
            }
        } else if (node.type === "export_decl") {
            const docComment = findPrecedingDocComment(root, node);
            const parsed = docComment ? jsdoc.parse(docComment) : null;
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                result.push(buildVariableSymbol(nameNode.text, uri, makeRange(node), "export variable", parsed, displayPath));
            }
        }
    }

    return result;
}
