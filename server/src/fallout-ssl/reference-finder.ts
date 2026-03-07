/**
 * Scope-restricted reference finding for Fallout SSL rename operations.
 *
 * For procedure-scoped symbols: walks only the containing procedure subtree.
 * For file-scoped symbols: walks the entire file but skips into procedures
 * that shadow the symbol with a procedure-local definition.
 */

import type { Node } from "web-tree-sitter";
import type { SslSymbolScope } from "./symbol-scope";
import { isLocalToProc } from "./symbol-scope";

/**
 * Find all identifier references to a symbol within its correct scope.
 *
 * - procedure scope: searches only within symbolInfo.procedureNode
 * - file scope: searches entire tree, skipping procedures that shadow the name
 *
 * Uses recursive descent for consistency with utils.ts traversals.
 * SSL ASTs are shallow (no nested procedures), so stack depth is not a concern.
 */
export function findScopedReferences(rootNode: Node, symbolInfo: SslSymbolScope): Node[] {
    // Guard: procedure scope requires a procedureNode to restrict the search
    if (symbolInfo.scope === "procedure" && !symbolInfo.procedureNode) {
        return [];
    }

    const refs: Node[] = [];
    const searchRoot = symbolInfo.scope === "procedure" && symbolInfo.procedureNode
        ? symbolInfo.procedureNode
        : rootNode;

    function visit(node: Node): void {
        // Shadow exclusion: when searching file-scope, skip entire procedure
        // subtree if the procedure defines a local with the same name
        if (
            symbolInfo.scope === "file" &&
            node.type === "procedure" &&
            isLocalToProc(node, symbolInfo.name)
        ) {
            return;
        }

        if (node.type === "identifier" && node.text === symbolInfo.name) {
            refs.push(node);
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(searchRoot);
    return refs;
}
