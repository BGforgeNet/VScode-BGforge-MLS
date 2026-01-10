/**
 * Rename symbol for Fallout SSL files.
 * Only renames locally defined symbols (procedures, variables, exports).
 */

import { Position, TextEdit, WorkspaceEdit } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";

/**
 * Check if a symbol is defined locally.
 * Handles: procedures, forward declarations, variables, exports, params, for-loop vars.
 */
function isLocalDefinition(root: Node, symbol: string): boolean {
    function checkNode(node: Node): boolean {
        if (node.type === "procedure") {
            const nameNode = node.childForFieldName("name");
            if (nameNode?.text === symbol) {
                return true;
            }
            // Check parameters
            const params = node.childForFieldName("params");
            if (params) {
                for (const child of params.children) {
                    if (child.type === "param") {
                        const paramName = child.childForFieldName("name");
                        if (paramName?.text === symbol) {
                            return true;
                        }
                    }
                }
            }
            // Check local variables and for-loop vars inside procedure
            for (const child of node.children) {
                if (checkNode(child)) {
                    return true;
                }
            }
        } else if (node.type === "procedure_forward") {
            const nameNode = node.childForFieldName("name");
            if (nameNode?.text === symbol) {
                return true;
            }
        } else if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode?.text === symbol) {
                        return true;
                    }
                }
            }
        } else if (node.type === "for_var_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode?.text === symbol) {
                return true;
            }
        } else if (node.type === "foreach_stmt") {
            const varNode = node.childForFieldName("var");
            if (varNode?.text === symbol) {
                return true;
            }
            const keyNode = node.childForFieldName("key");
            if (keyNode?.text === symbol) {
                return true;
            }
            const valueNode = node.childForFieldName("value");
            if (valueNode?.text === symbol) {
                return true;
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode?.text === symbol) {
                return true;
            }
        }
        return false;
    }

    for (const node of root.children) {
        if (checkNode(node)) {
            return true;
        }
    }
    return false;
}

/**
 * Find all identifier nodes with the given name.
 */
function findAllReferences(root: Node, symbol: string): Node[] {
    const refs: Node[] = [];

    function visit(node: Node): void {
        if (node.type === "identifier" && node.text === symbol) {
            refs.push(node);
        }
        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
    return refs;
}

/**
 * Find the identifier at the given position.
 */
function findIdentifierAtPosition(root: Node, position: Position): string | null {
    function visit(node: Node): string | null {
        const startRow = node.startPosition.row;
        const endRow = node.endPosition.row;
        const startCol = node.startPosition.column;
        const endCol = node.endPosition.column;

        const inRange =
            (position.line > startRow || (position.line === startRow && position.character >= startCol)) &&
            (position.line < endRow || (position.line === endRow && position.character <= endCol));

        if (!inRange) {
            return null;
        }

        if (node.type === "identifier") {
            return node.text;
        }

        for (const child of node.children) {
            const result = visit(child);
            if (result) return result;
        }

        return null;
    }

    return visit(root);
}

/**
 * Rename a locally defined symbol.
 * Returns null if the symbol at position is not locally defined.
 */
export function renameSymbol(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
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
        range: {
            start: { line: node.startPosition.row, character: node.startPosition.column },
            end: { line: node.endPosition.row, character: node.endPosition.column },
        },
        newText: newName,
    }));

    return {
        changes: {
            [uri]: edits,
        },
    };
}
