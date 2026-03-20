/**
 * Go to Definition for Fallout SSL files.
 * Finds local definitions (procedures, macros, variables) in the current file.
 * Returns null if not found locally, allowing fallback to header definitions.
 */

import { Location, Position } from "vscode-languageserver/node";
import { parseWithCache, isInitialized } from "./parser";
import { makeRange, findIdentifierNodeAtPosition } from "./utils";
import { resolveIdentifierDefinitionNode } from "./symbol-definitions";

/**
 * Get definition location for the symbol at the given position.
 * Returns null if not found locally (falls back to header definitions).
 */
export function getLocalDefinition(text: string, uri: string, position: Position): Location | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const symbolNode = findIdentifierNodeAtPosition(tree.rootNode, position);
    if (!symbolNode) {
        return null;
    }

    const definitionNode = resolveIdentifierDefinitionNode(tree.rootNode, symbolNode);
    if (!definitionNode) {
        return null;
    }

    return {
        uri,
        range: makeRange(definitionNode),
    };
}
