/**
 * Document symbol provider for Fallout SSL files.
 * Extracts procedures, macros, and global variables from the current file only.
 */

import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { parseWithCache, isInitialized } from "./parser";
import { extractProcedures, makeRange, findPrecedingDocComment, extractMacros, extractParams, buildProcedureSignature } from "./utils";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToDetail } from "./jsdoc-format";
import { isConstantMacro } from "./macro-utils";
import { SyntaxType } from "./tree-sitter.d";

function makeSymbol(node: Node, nameNode: Node, kind: SymbolKind, detail?: string): DocumentSymbol | null {
    const name = nameNode.text;
    if (!name) {
        return null;
    }
    return {
        name,
        detail,
        kind,
        range: makeRange(node),
        selectionRange: makeRange(nameNode),
    };
}

/**
 * Extract symbols from a pre-parsed AST root node.
 * Prefers procedure definitions over forward declarations.
 */
function extractSymbols(root: Node): DocumentSymbol[] {
    // Extract procedures (already deduped) with signatures
    const procedures = extractProcedures(root);
    const procSymbols: DocumentSymbol[] = [];
    for (const [name, { node }] of procedures) {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) continue;

        // Look for JSDoc
        const docComment = findPrecedingDocComment(root, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;
        const params = extractParams(node);

        // Build signature using shared function
        const detail = buildProcedureSignature(name, params, parsed);

        const sym = makeSymbol(node, nameNode, SymbolKind.Function, detail);
        if (sym) procSymbols.push(sym);
    }

    // Extract macros
    const macros = extractMacros(root);
    const macroSymbols: DocumentSymbol[] = [];

    // Iterate over tree to find define nodes and match with MacroData
    function visitForMacros(node: Node): void {
        if (node.type === SyntaxType.Preprocessor) {
            for (const child of node.children) {
                if (child.type === SyntaxType.Define) {
                    const nameNode = child.childForFieldName("name");
                    if (!nameNode) continue;

                    const name = nameNode.text;
                    const macro = macros.find(m => m.name === name);
                    if (!macro) continue;

                    // Determine symbol kind
                    const kind = macro.hasParams
                        ? SymbolKind.Function
                        : SymbolKind.Constant;

                    // Build detail - use same format as hover/completion
                    const isConstant = !macro.hasParams && isConstantMacro(macro.name);
                    let detail: string | undefined;
                    if (macro.jsdoc && macro.jsdoc.args.length > 0) {
                        // Use JSDoc to build signature with types
                        detail = jsdocToDetail(name, macro.jsdoc, "macro");
                    } else if (isConstant && macro.firstline) {
                        // Constant: just the value
                        detail = macro.firstline;
                    } else if (macro.hasParams && macro.params) {
                        // Function-like macro
                        detail = `macro ${name}(${macro.params.join(", ")})`;
                    } else {
                        // Other macro
                        detail = `macro ${name}`;
                    }

                    const sym = makeSymbol(child, nameNode, kind, detail);
                    if (sym) macroSymbols.push(sym);
                }
            }
        }

        for (const c of node.children) {
            visitForMacros(c);
        }
    }

    visitForMacros(root);

    const variables: DocumentSymbol[] = [];

    for (const node of root.children) {
        if (node.type === SyntaxType.VariableDecl) {
            for (const child of node.children) {
                if (child.type === SyntaxType.VarInit) {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        const sym = makeSymbol(child, nameNode, SymbolKind.Variable);
                        if (sym) variables.push(sym);
                    }
                }
            }
        } else if (node.type === SyntaxType.ExportDecl) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const sym = makeSymbol(node, nameNode, SymbolKind.Variable);
                if (sym) variables.push(sym);
            }
        }
    }

    return [...procSymbols, ...macroSymbols, ...variables];
}

/** Parse text and extract document symbols. */
export function getDocumentSymbols(text: string): DocumentSymbol[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return [];
    }

    return extractSymbols(tree.rootNode);
}
