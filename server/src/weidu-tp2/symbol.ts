/**
 * Document symbol provider for WeiDU TP2 files.
 * Extracts function and macro definitions for outline view.
 */

import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { makeRange } from "../core/position-utils";
import { parseWithCache, isInitialized } from "./parser";
import { isFunctionDef } from "./format/utils";
import { SyntaxType } from "./tree-sitter.d";

/** Parameter declaration node types that carry a keyword + identifier. */
const PARAM_DECL_TYPES: ReadonlySet<string> = new Set([
    SyntaxType.IntVarDecl,
    SyntaxType.StrVarDecl,
    SyntaxType.RetDecl,
    SyntaxType.RetArrayDecl,
]);

/** Keyword node types inside parameter declarations. */
const PARAM_KEYWORDS: ReadonlySet<string> = new Set([
    "INT_VAR", "STR_VAR", "RET", "RET_ARRAY",
]);

/** Build detail string from function parameter declarations (e.g. "INT_VAR x STR_VAR name RET result"). */
function buildFunctionDetail(node: Node): string | undefined {
    const parts: string[] = [];
    for (const child of node.children) {
        if (!PARAM_DECL_TYPES.has(child.type)) continue;

        let keyword: string | undefined;
        let name: string | undefined;
        for (const gc of child.children) {
            if (PARAM_KEYWORDS.has(gc.type)) {
                keyword = gc.type;
            } else if (gc.type === SyntaxType.Identifier) {
                name = gc.text;
            }
        }
        if (keyword && name) {
            parts.push(`${keyword} ${name}`);
        }
    }
    return parts.length > 0 ? parts.join(" ") : undefined;
}

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
            if (nameNode && nameNode.text) {
                symbols.push({
                    name: nameNode.text,
                    detail: buildFunctionDetail(node),
                    kind: SymbolKind.Function,
                    range: makeRange(node),
                    selectionRange: makeRange(nameNode),
                });
            }
        }
    }

    return symbols;
}
