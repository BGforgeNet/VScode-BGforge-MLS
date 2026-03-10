/**
 * Call-site extractor for WeiDU TP2 files.
 *
 * Walks the AST and collects function/macro definition and call sites,
 * producing a Map<symbolName, Location[]> for the cross-file references index.
 *
 * TP2 symbol names are case-sensitive, so keys are stored as-is.
 */

import { Location } from "vscode-languageserver/node";
import type { Node as SyntaxNode } from "web-tree-sitter";
import { makeRange } from "../core/position-utils";
import { SyntaxType } from "./tree-sitter.d";
import { FUNCTION_DEF_TYPES } from "./variable-symbols";
import { FUNCTION_CALL_TYPES } from "./symbol-discovery";
import { stripStringDelimiters } from "./tree-utils";
import { parseWithCache, isInitialized } from "./parser";

/**
 * Extract function/macro call sites from a TP2 file.
 * Returns a map of symbolName -> Location[] for cross-file indexing.
 *
 * Collects both definitions and call sites for function/macro names.
 * Variable references are not indexed — they are scoped to functions/loops
 * and handled by single-file findReferences.
 */
export function extractCallSites(text: string, uri: string): ReadonlyMap<string, readonly Location[]> {
    if (!isInitialized()) {
        return new Map();
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return new Map();
    }

    const refs = new Map<string, Location[]>();

    function addRef(name: string, loc: Location): void {
        let locs = refs.get(name);
        if (!locs) {
            locs = [];
            refs.set(name, locs);
        }
        locs.push(loc);
    }

    function visit(node: SyntaxNode): void {
        // Function/macro definitions
        if (FUNCTION_DEF_TYPES.has(node.type as SyntaxType)) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const name = stripStringDelimiters(nameNode.text);
                addRef(name, { uri, range: makeRange(nameNode) });
            }
        }

        // Function/macro calls
        if (FUNCTION_CALL_TYPES.has(node.type as SyntaxType)) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const name = stripStringDelimiters(nameNode.text);
                addRef(name, { uri, range: makeRange(nameNode) });
            }
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(tree.rootNode);
    return refs;
}
