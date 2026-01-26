/**
 * Document symbol provider for WeiDU TP2 files.
 * Extracts function and macro definitions for outline view.
 */

import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import { makeRange } from "../core/position-utils";
import { parseWithCache, isInitialized } from "./parser";
import { isFunctionDef } from "./format/utils";

export function getDocumentSymbols(text: string): DocumentSymbol[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = parseWithCache(text);
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
                    range: makeRange(node),
                    selectionRange: makeRange(nameNode),
                });
            }
        }
    }

    return symbols;
}
