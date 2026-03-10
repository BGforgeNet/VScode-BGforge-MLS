/**
 * Fallout SSL header parsing utilities.
 * Handles tree-sitter-based parsing of .h files for procedures, macros,
 * variables, and exports.
 *
 * Main API: parseHeaderToSymbols() - Returns IndexedSymbol[] for unified storage.
 *
 * Delegates to shared symbol builders in utils.ts (buildProcedureSymbol,
 * buildMacroSymbol, buildVariableSymbol) with workspace scope via displayPath.
 */

import { computeDisplayPath } from "../core/location-utils";
import { type IndexedSymbol, SourceType } from "../core/symbol";
import * as jsdoc from "../shared/jsdoc";
import { buildProcedureSymbol, buildMacroSymbol, buildVariableSymbol, extractMacros, extractParams, extractProcedures, findPrecedingDocComment, makeRange } from "./utils";
import { isInitialized, parseWithCache } from "./parser";
import { SyntaxType } from "./tree-sitter.d";

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
    sourceType?: SourceType,
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
        const docComment = findPrecedingDocComment(root, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;
        const astParams = extractParams(node);
        result.push(buildProcedureSymbol(name, uri, node, astParams, parsed, displayPath));
    }

    // Extract macros via tree-sitter AST
    const macros = extractMacros(root);
    for (const macro of macros) {
        result.push(buildMacroSymbol(macro, uri, displayPath));
    }

    // Extract top-level variables and exports
    for (const node of root.children) {
        if (node.type === SyntaxType.VariableDecl) {
            const docComment = findPrecedingDocComment(root, node);
            const parsed = docComment ? jsdoc.parse(docComment) : null;
            for (const child of node.children) {
                if (child.type === SyntaxType.VarInit) {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        result.push(buildVariableSymbol(nameNode.text, uri, makeRange(child), undefined, parsed, displayPath));
                    }
                }
            }
        } else if (node.type === SyntaxType.ExportDecl) {
            const docComment = findPrecedingDocComment(root, node);
            const parsed = docComment ? jsdoc.parse(docComment) : null;
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                result.push(buildVariableSymbol(nameNode.text, uri, makeRange(node), "export variable", parsed, displayPath));
            }
        }
    }

    // Remap source type when called for non-header files (e.g., Navigation for Ctrl+T)
    if (sourceType !== undefined && sourceType !== SourceType.Workspace) {
        return result.map(s => ({
            ...s,
            source: { ...s.source, type: sourceType },
        }));
    }

    return result;
}
