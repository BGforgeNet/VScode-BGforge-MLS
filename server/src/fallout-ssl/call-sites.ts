/**
 * Call-site extractor for Fallout SSL files.
 *
 * Walks the AST and collects all identifier nodes grouped by name,
 * producing a Map<symbolName, Location[]> for the cross-file references index.
 *
 * Collects all identifiers regardless of scope for simplicity.
 * The references query filters by scope at lookup time, so procedure-local
 * variables in the index produce no cross-file results.
 */

import { Location } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { makeRange } from "../core/position-utils";
import { SyntaxType } from "./tree-sitter.d";
import { parseWithCache, isInitialized } from "./parser";

/**
 * Extract all identifier call sites from an SSL file.
 * Returns a map of symbolName -> Location[] for cross-file indexing.
 *
 * Collects all Identifier nodes at any depth — the references query
 * handles scoping and filtering. This gives us a simple, complete index.
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

    function visit(node: Node): void {
        if (node.type === SyntaxType.Identifier) {
            const name = node.text;
            let locs = refs.get(name);
            if (!locs) {
                locs = [];
                refs.set(name, locs);
            }
            locs.push({ uri, range: makeRange(node) });
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(tree.rootNode);
    return refs;
}
