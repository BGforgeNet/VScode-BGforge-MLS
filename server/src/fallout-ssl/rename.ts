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
import { findIdentifierAtPosition, findIdentifierNodeAtPosition, isLocalDefinition, findAllReferences, makeRange } from "./utils";

/** SSL identifiers: alphanumeric + underscore, must not be empty. */
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

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
    if (!isInitialized() || !VALID_IDENTIFIER.test(newName)) {
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

// =============================================================================
// Workspace-wide rename
// =============================================================================

/** Check if a macro with the given name is defined anywhere in the AST. */
function hasMacroDefinition(root: Node, symbolName: string): boolean {
    const stack: Node[] = [root];
    while (stack.length > 0) {
        const node = stack.pop()!; // stack is non-empty, safe to assert
        if (node.type === "preprocessor") {
            for (const child of node.children) {
                if (child.type === "define") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode?.text === symbolName) {
                        return true;
                    }
                }
            }
        }
        for (const child of node.children) {
            stack.push(child);
        }
    }
    return false;
}

/**
 * Check if a symbol is defined at file scope (shareable via includes).
 * File-scope: procedures, forward declarations, macros, exports.
 * Function-scope (NOT shareable): variables, params, for/foreach vars.
 */
function isFileScopeDefinition(rootNode: Node, symbolName: string): boolean {
    // Check procedures
    for (const child of rootNode.children) {
        if (child.type === "procedure" || child.type === "procedure_forward") {
            const nameNode = child.childForFieldName("name");
            if (nameNode?.text === symbolName) {
                return true;
            }
        }
    }

    // Check macros (inside preprocessor > define)
    if (hasMacroDefinition(rootNode, symbolName)) return true;

    // Check exports
    for (const child of rootNode.children) {
        if (child.type === "export_decl") {
            const nameNode = child.childForFieldName("name");
            if (nameNode?.text === symbolName) {
                return true;
            }
        }
    }

    return false;
}

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
        if (isFileScopeDefinition(currentRootNode, symbolName)) {
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

        const refs = findAllReferences(candidateTree.rootNode, symbolName);
        if (refs.length === 0) {
            continue;
        }

        // For the definition file: include all references (definition + usages)
        // For consuming files: only include references where the symbol is NOT
        // locally redefined (if a file redefines the same name, skip it)
        if (candidateUri !== definitionUri && isLocalDefinition(candidateTree.rootNode, symbolName)) {
            // This file has its own definition of the same name -- skip to avoid
            // renaming an unrelated symbol that shadows the included one
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
