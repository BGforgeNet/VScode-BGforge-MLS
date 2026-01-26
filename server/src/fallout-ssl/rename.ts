/**
 * Rename symbol for Fallout SSL files.
 * Only renames locally defined symbols (procedures, variables, exports).
 */

import { Position, TextEdit, WorkspaceEdit } from "vscode-languageserver/node";
import { parseWithCache, isInitialized } from "./parser";
import { findIdentifierAtPosition, findIdentifierNodeAtPosition, isLocalDefinition, findAllReferences, makeRange } from "./utils";

/**
 * Prepare for rename by validating the position and returning the range and placeholder.
 * Returns null if rename is not allowed at this position.
 */
export function prepareRenameSymbol(
    text: string,
    position: Position
): { range: { start: Position; end: Position }; placeholder: string } | null {
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

    // Only allow rename for locally defined symbols
    if (!isLocalDefinition(tree.rootNode, symbolNode.text)) {
        return null;
    }

    return {
        range: {
            start: { line: symbolNode.startPosition.row, character: symbolNode.startPosition.column },
            end: { line: symbolNode.endPosition.row, character: symbolNode.endPosition.column },
        },
        placeholder: symbolNode.text,
    };
}

/**
 * Rename a locally defined symbol.
 * Returns null if the symbol at position is not locally defined.
 */
export function renameSymbol(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const symbol = findIdentifierAtPosition(tree.rootNode, position);
    if (!symbol) {
        return null;
    }

    // Only rename locally defined symbols
    if (!isLocalDefinition(tree.rootNode, symbol)) {
        return null;
    }

    const refs = findAllReferences(tree.rootNode, symbol);
    if (refs.length === 0) {
        return null;
    }

    const edits: TextEdit[] = refs.map((node) => ({
        range: makeRange(node),
        newText: newName,
    }));

    return {
        changes: {
            [uri]: edits,
        },
    };
}
