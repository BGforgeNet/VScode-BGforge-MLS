/**
 * Document symbol provider for Fallout SSL files.
 * Extracts procedures and global variables from the current file only.
 */

import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";
import { extractProcedures, makeRange } from "./local-utils";

function makeSymbol(node: Node, nameNode: Node, kind: SymbolKind): DocumentSymbol {
    return {
        name: nameNode.text,
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
    // Extract procedures (already deduped)
    const procedures = extractProcedures(root);
    const procSymbols: DocumentSymbol[] = [];
    for (const { node } of procedures.values()) {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
            procSymbols.push(makeSymbol(node, nameNode, SymbolKind.Function));
        }
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
