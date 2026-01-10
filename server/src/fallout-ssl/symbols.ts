/**
 * Document symbol provider for Fallout SSL files.
 * Extracts procedures and global variables from the current file only.
 */

import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";
import { extractProcedures, makeRange, findPrecedingDocComment } from "./utils";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToDetail } from "../shared/jsdoc-utils";

function makeSymbol(node: Node, nameNode: Node, kind: SymbolKind, detail?: string): DocumentSymbol {
    return {
        name: nameNode.text,
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

        // Build detail with signature - same logic as completion/hover
        const params = node.childForFieldName("params");
        const hasParams = params && params.namedChildren.length > 0;

        // Look for JSDoc
        const docComment = findPrecedingDocComment(root, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;

        let detail: string | undefined;
        if (parsed && parsed.args.length > 0) {
            // Use JSDoc to build signature with types
            detail = jsdocToDetail(name, parsed, "proc");
        } else if (hasParams) {
            // No JSDoc but has params - extract param names
            const paramNames: string[] = [];
            for (const child of params.children) {
                if (child.type === "param") {
                    const pNameNode = child.childForFieldName("name");
                    if (pNameNode) {
                        paramNames.push(pNameNode.text);
                    }
                }
            }
            detail = `procedure ${name}(${paramNames.join(", ")})`;
        } else {
            // No params
            detail = `procedure ${name}()`;
        }

        procSymbols.push(makeSymbol(node, nameNode, SymbolKind.Function, detail));
    }

    const variables: DocumentSymbol[] = [];

    for (const node of root.children) {
        if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        variables.push(makeSymbol(child, nameNode, SymbolKind.Variable));
                    }
                }
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                variables.push(makeSymbol(node, nameNode, SymbolKind.Variable));
            }
        }
    }

    return [...procSymbols, ...variables];
}

/** Parse text and extract document symbols. */
export function getDocumentSymbols(text: string): DocumentSymbol[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return [];
    }

    return extractSymbols(tree.rootNode);
}
