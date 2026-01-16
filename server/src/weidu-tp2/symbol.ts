/**
 * Document symbol provider for WeiDU TP2 files.
 * Extracts function and macro definitions for outline view.
 */

import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import { getParser, isInitialized } from "./parser";
import { isFunctionDef } from "./format-utils";

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
        if (isFunctionDef(node.type)) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                symbols.push({
                    name: nameNode.text,
                    kind: SymbolKind.Function,
                    range: {
                        start: { line: node.startPosition.row, character: node.startPosition.column },
                        end: { line: node.endPosition.row, character: node.endPosition.column },
                    },
                    selectionRange: {
                        start: { line: nameNode.startPosition.row, character: nameNode.startPosition.column },
                        end: { line: nameNode.endPosition.row, character: nameNode.endPosition.column },
                    },
                });
            }
        }
    }

    return symbols;
}
