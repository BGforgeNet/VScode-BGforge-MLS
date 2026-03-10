/**
 * Find References for Fallout SSL files.
 * Returns all locations referencing the symbol at the cursor position.
 *
 * Reuses getSymbolScope (scope determination) and findScopedReferences
 * (AST traversal) from the rename infrastructure.
 */

import { Location, Position } from "vscode-languageserver/node";
import { makeRange } from "../core/position-utils";
import type { ReferencesIndex } from "../shared/references-index";
import { parseWithCache } from "./parser";
import { getSymbolScope } from "./symbol-scope";
import { findScopedReferences } from "./reference-finder";
import { getLocalDefinition } from "./definition";

/**
 * Find all references to the symbol at the given position.
 * Returns empty array if the symbol is not locally defined or not found.
 *
 * When a ReferencesIndex is provided, cross-file references are included
 * for file-scoped symbols (procedures, macros, exports).
 */
export function findReferences(
    text: string,
    position: Position,
    uri: string,
    includeDeclaration: boolean,
    refsIndex?: ReferencesIndex,
): Location[] {
    const tree = parseWithCache(text);
    if (!tree) {
        return [];
    }

    const scopeInfo = getSymbolScope(tree.rootNode, position);
    if (!scopeInfo) {
        return [];
    }

    const refNodes = findScopedReferences(tree.rootNode, scopeInfo);
    if (refNodes.length === 0) {
        return [];
    }

    const localLocations = refNodes.map(node => ({
        uri,
        range: makeRange(node),
    }));

    // For file-scoped symbols, add cross-file references from the index
    let allLocations = localLocations;
    if (scopeInfo.scope === "file" && refsIndex) {
        const crossFileRefs = refsIndex.lookup(scopeInfo.name)
            .filter(loc => loc.uri !== uri);
        allLocations = [...localLocations, ...crossFileRefs];
    }

    if (includeDeclaration) {
        return allLocations;
    }

    // Find the definition location to exclude it
    const defLocation = getLocalDefinition(text, uri, position);
    if (!defLocation) {
        return allLocations;
    }

    // Guard on URI: cross-file refs at the same line/column must not be excluded
    return allLocations.filter(loc =>
        loc.uri !== uri ||
        loc.range.start.line !== defLocation.range.start.line ||
        loc.range.start.character !== defLocation.range.start.character
    );
}
