/**
 * Rename symbol for Fallout SSL files.
 *
 * Single-file rename: renames locally defined symbols (procedures, variables, exports).
 * Workspace-wide rename: renames symbols defined in workspace headers across all
 * consuming files, using the include graph to determine scope.
 */

import { fileURLToPath } from "node:url";
import type { Node } from "web-tree-sitter";
import { OptionalVersionedTextDocumentIdentifier, Position, TextDocumentEdit, TextEdit, WorkspaceEdit } from "vscode-languageserver/node";
import type { IncludeGraph } from "../core/include-graph";
import { isWithinBase } from "../core/include-resolver";
import { SourceType } from "../core/symbol";
import type { Symbols } from "../core/symbol-index";
import { parseWithCache, isInitialized } from "./parser";
import { findIdentifierAtPosition, findIdentifierNodeAtPosition, isLocalDefinition, makeRange } from "./utils";
import { getSymbolScope, isFileScopeDef } from "./symbol-scope";
import type { SslSymbolScope } from "./symbol-scope";
import { findScopedReferences } from "./reference-finder";

/** SSL identifiers: alphanumeric + underscore, must not be empty. */
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Prepare for rename by validating the position and returning the range and placeholder.
 * Returns null if rename is not allowed at this position.
 *
 * Scope-aware: only allows rename if the symbol is defined in an accessible scope
 * (the current procedure for locals, or file scope for procedures/macros/exports).
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

    // Determine scope -- returns null if the symbol is not defined in any accessible scope
    const scopeInfo = getSymbolScope(tree.rootNode, position);
    if (!scopeInfo) {
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
 * Rename a locally defined symbol with scope awareness.
 * Procedure-scoped symbols are renamed only within their procedure.
 * File-scoped symbols are renamed across the file, skipping procedure-local shadows.
 * Returns null if the symbol at position is not defined in an accessible scope.
 */
export function renameSymbol(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
    if (!isInitialized() || !VALID_IDENTIFIER.test(newName)) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const scopeInfo = getSymbolScope(tree.rootNode, position);
    if (!scopeInfo) {
        return null;
    }

    const refs = findScopedReferences(tree.rootNode, scopeInfo);
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

// =============================================================================
// Workspace-wide rename
// =============================================================================

/**
 * Determine the definition URI for a symbol.
 * Returns the URI where the symbol is defined, or null if it can't be determined
 * or if the symbol is from an external/static source (not renameable).
 */
function findDefinitionUri(
    symbolName: string,
    currentUri: string,
    currentRootNode: Node,
    symbolStore: Symbols,
    workspaceRoot: string | undefined,
): { uri: string; isExternal: boolean } | null {
    // Check if defined locally in current file
    if (isLocalDefinition(currentRootNode, symbolName)) {
        if (isFileScopeDef(currentRootNode, symbolName)) {
            return { uri: currentUri, isExternal: false };
        }
        // Function-scoped: not shareable, handled by single-file rename
        return null;
    }

    // Check symbol store (workspace headers, external headers, static)
    const indexed = symbolStore.lookup(symbolName);
    if (!indexed) {
        return null;
    }

    if (indexed.source.type === SourceType.Static) {
        // Built-in symbol, not renameable
        return null;
    }

    if (indexed.source.type === SourceType.Workspace) {
        const defUri = indexed.location?.uri;
        if (!defUri) return null;

        // Check if the definition is inside the workspace (renameable)
        // vs external headersDirectory (read-only)
        if (workspaceRoot && defUri.startsWith("file://")) {
            const defPath = fileURLToPath(defUri);
            return { uri: defUri, isExternal: !isWithinBase(defPath, workspaceRoot) };
        }
        return { uri: defUri, isExternal: false };
    }

    if (indexed.source.type === SourceType.External) {
        const extUri = indexed.location?.uri;
        if (!extUri) return null;
        return { uri: extUri, isExternal: true };
    }

    return null;
}

/**
 * Prepare for workspace-wide rename.
 * Allows rename for symbols defined in workspace headers (not just current file).
 * Returns null if the symbol is not workspace-renameable (falls back to single-file).
 */
export function prepareRenameSymbolWorkspace(
    text: string,
    position: Position,
    symbolStore: Symbols,
    workspaceRoot: string | undefined,
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

    // If locally defined, let single-file prepare handle it
    if (isLocalDefinition(tree.rootNode, symbolNode.text)) {
        return null;
    }

    // Check if it's a workspace-defined symbol (renameable across files)
    const indexed = symbolStore.lookup(symbolNode.text);
    if (!indexed) {
        return null;
    }

    // Only allow rename for workspace symbols (not static/external)
    if (indexed.source.type !== SourceType.Workspace) {
        return null;
    }

    // Check if definition is inside workspace (not external headersDirectory)
    const defUri = indexed.location?.uri;
    if (!defUri) {
        return null;
    }

    if (workspaceRoot && defUri.startsWith("file://")) {
        const defPath = fileURLToPath(defUri);
        if (!isWithinBase(defPath, workspaceRoot)) {
            return null;
        }
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
 * Rename a symbol across workspace files using the include graph.
 *
 * Algorithm:
 * 1. Find symbol at position, determine definition URI
 * 2. Get all files that transitively include the definition file
 * 3. For each candidate file, find all identifier references matching the symbol
 * 4. Collect edits into a WorkspaceEdit
 *
 * Returns null if the symbol is not workspace-renameable (caller falls back to single-file).
 */
export function renameSymbolWorkspace(
    text: string,
    position: Position,
    newName: string,
    uri: string,
    includeGraph: IncludeGraph,
    symbolStore: Symbols,
    getFileText: (uri: string) => string | null,
    workspaceRoot: string | undefined,
): WorkspaceEdit | null {
    if (!isInitialized() || !VALID_IDENTIFIER.test(newName)) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const symbolName = findIdentifierAtPosition(tree.rootNode, position);
    if (!symbolName) {
        return null;
    }

    // Determine where the symbol is defined
    const defInfo = findDefinitionUri(symbolName, uri, tree.rootNode, symbolStore, workspaceRoot);
    if (!defInfo) {
        // Not a workspace-scope symbol (e.g., function-scoped variable)
        return null;
    }

    if (defInfo.isExternal) {
        // Symbol defined in external headers (read-only): not renameable
        return null;
    }

    const definitionUri = defInfo.uri;

    // Collect all files to rename in:
    // - The definition file itself
    // - All files that transitively include the definition file
    const dependants = includeGraph.getTransitiveDependants(definitionUri);
    const candidateUris = new Set([definitionUri, ...dependants]);

    // Also include the current file (in case it's not in the graph yet)
    candidateUris.add(uri);

    // Build edits for each candidate file
    // Uses documentChanges format (TextDocumentEdit[]) so VS Code treats the
    // entire rename as a single atomic undo operation across all files.
    const documentChanges: TextDocumentEdit[] = [];
    const fileScopeInfo: SslSymbolScope = { name: symbolName, scope: "file" };

    for (const candidateUri of candidateUris) {
        const candidateText = candidateUri === uri
            ? text
            : getFileText(candidateUri);

        if (!candidateText) {
            continue;
        }

        const candidateTree = parseWithCache(candidateText);
        if (!candidateTree) {
            continue;
        }

        // For consuming files: skip entirely if the symbol is redefined at file scope
        // (a different procedure/macro/export with the same name). Procedure-local
        // shadows are handled by findScopedReferences (it skips those subtrees).
        if (candidateUri !== definitionUri && isFileScopeDef(candidateTree.rootNode, symbolName)) {
            continue;
        }

        // Use file-scoped reference finding with shadow exclusion:
        // skips into procedures that have a local definition of the same name
        const refs = findScopedReferences(candidateTree.rootNode, fileScopeInfo);
        if (refs.length === 0) {
            continue;
        }

        const edits: TextEdit[] = refs.map((node) => ({
            range: makeRange(node),
            newText: newName,
        }));

        documentChanges.push(TextDocumentEdit.create(
            // version: null means "apply regardless of current version"
            OptionalVersionedTextDocumentIdentifier.create(candidateUri, null),
            edits,
        ));
    }

    if (documentChanges.length === 0) {
        return null;
    }

    return { documentChanges };
}
