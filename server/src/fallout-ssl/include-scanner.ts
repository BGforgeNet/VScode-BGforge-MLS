/**
 * Extract #include paths from Fallout SSL tree-sitter AST.
 * Language-specific -- walks the SSL AST for `include` nodes inside `preprocessor` blocks.
 *
 * Records ALL includes regardless of #ifdef/#ifndef guards (superset for rename safety).
 */

import type { Node } from "web-tree-sitter";
import { stripIncludeDelimiters } from "../core/include-resolver";

/**
 * Extract all #include paths from a tree-sitter root node.
 * Returns raw paths with delimiters already stripped.
 */
export function extractIncludes(rootNode: Node): readonly string[] {
    const includes: string[] = [];

    function visit(node: Node): void {
        if (node.type === "include") {
            const pathNode = node.childForFieldName("path");
            if (pathNode) {
                const stripped = stripIncludeDelimiters(pathNode.text);
                if (stripped) {
                    includes.push(stripped);
                }
            }
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(rootNode);
    return includes;
}
