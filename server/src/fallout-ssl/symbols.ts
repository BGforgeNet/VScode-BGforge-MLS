/**
 * Document symbol provider for Fallout SSL files.
 * Extracts procedures and global variables from the current file only.
 */

import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";

function makeSymbol(node: Node, nameNode: Node, kind: SymbolKind): DocumentSymbol {
    return {
        name: nameNode.text,
        kind,
        range: {
            start: { line: node.startPosition.row, character: node.startPosition.column },
            end: { line: node.endPosition.row, character: node.endPosition.column },
        },
        selectionRange: {
            start: { line: nameNode.startPosition.row, character: nameNode.startPosition.column },
            end: { line: nameNode.endPosition.row, character: nameNode.endPosition.column },
        },
    };
}

export function getDocumentSymbols(text: string): DocumentSymbol[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return [];
    }

    const symbols: DocumentSymbol[] = [];

    for (const node of tree.rootNode.children) {
        if (node.type === "procedure") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                symbols.push(makeSymbol(node, nameNode, SymbolKind.Function));
            }
        } else if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        symbols.push(makeSymbol(child, nameNode, SymbolKind.Variable));
                    }
                }
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                symbols.push(makeSymbol(node, nameNode, SymbolKind.Variable));
            }
        }
    }

    return symbols;
}
