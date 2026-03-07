/**
 * Symbol scope determination for Fallout SSL rename operations.
 *
 * Fallout SSL has exactly two scopes:
 * - File scope: procedures, macros (#define), exports, forward declarations
 * - Procedure scope: params, variables, for/foreach vars
 *
 * Given a cursor position, determines which scope the symbol belongs to
 * and provides the procedure node for procedure-scoped symbols.
 */

import type { Node } from "web-tree-sitter";
import { Position } from "vscode-languageserver/node";
import { findIdentifierNodeAtPosition, findMacroDefinition } from "./utils";

/** Scope information for a symbol at a given cursor position. */
export interface SslSymbolScope {
    name: string;
    scope: "file" | "procedure";
    procedureNode?: Node;
}

/**
 * Walk ancestors to find the containing procedure node.
 * Returns null if the node is not inside a procedure.
 */
export function findContainingProcedure(node: Node): Node | null {
    let current: Node | null = node.parent;
    while (current) {
        if (current.type === "procedure") {
            return current;
        }
        current = current.parent;
    }
    return null;
}

/**
 * Check if a procedure defines a symbol as a procedure-local construct:
 * parameters, variable declarations, for loop vars, foreach vars.
 * Does NOT match the procedure's own name (that's file-scoped).
 */
export function isLocalToProc(procedureNode: Node, symbolName: string): boolean {
    // Check parameters
    const params = procedureNode.childForFieldName("params");
    if (params) {
        for (const child of params.children) {
            if (child.type === "param") {
                const nameNode = child.childForFieldName("name");
                if (nameNode?.text === symbolName) {
                    return true;
                }
            }
        }
    }

    // Check variable_decl, for_var_decl, foreach_stmt within procedure body
    return searchProcBody(procedureNode, symbolName);
}

/**
 * Recursively search procedure body for local variable definitions.
 * Uses recursive descent (not iterative stack) for consistency with the rest of
 * the codebase (findDefinitionNode, extractProcedures in utils.ts).
 * SSL procedure bodies are shallow (no nested procedures, typical nesting <10 levels),
 * so stack overflow is not a practical concern.
 */
function searchProcBody(node: Node, symbolName: string): boolean {
    if (node.type === "variable_decl") {
        for (const child of node.children) {
            if (child.type === "var_init") {
                const nameNode = child.childForFieldName("name");
                if (nameNode?.text === symbolName) {
                    return true;
                }
            }
        }
    } else if (node.type === "for_var_decl") {
        const nameNode = node.childForFieldName("name");
        if (nameNode?.text === symbolName) {
            return true;
        }
    } else if (node.type === "foreach_stmt") {
        for (const field of ["var", "key", "value"] as const) {
            const fieldNode = node.childForFieldName(field);
            if (fieldNode?.text === symbolName) {
                return true;
            }
        }
    }

    for (const child of node.children) {
        if (searchProcBody(child, symbolName)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a symbol is defined at file scope: procedure names, forward
 * declarations, macros, exports.
 */
export function isFileScopeDef(rootNode: Node, symbolName: string): boolean {
    for (const child of rootNode.children) {
        if (child.type === "procedure" || child.type === "procedure_forward") {
            const nameNode = child.childForFieldName("name");
            if (nameNode?.text === symbolName) {
                return true;
            }
        }
        if (child.type === "export_decl") {
            const nameNode = child.childForFieldName("name");
            if (nameNode?.text === symbolName) {
                return true;
            }
        }
    }

    // Check macros (reuse findMacroDefinition from utils.ts)
    return findMacroDefinition(rootNode, symbolName) !== null;
}

/**
 * Determine the scope of a symbol at the given cursor position.
 *
 * Logic:
 * 1. Find identifier at position
 * 2. If inside a procedure and the procedure defines it locally -> procedure scope
 * 3. If defined at file scope (procedure name, macro, export) -> file scope
 * 4. Otherwise -> null (not renameable in current file)
 */
export function getSymbolScope(rootNode: Node, position: Position): SslSymbolScope | null {
    const symbolNode = findIdentifierNodeAtPosition(rootNode, position);
    if (!symbolNode) {
        return null;
    }

    const symbolName = symbolNode.text;
    const containingProc = findContainingProcedure(symbolNode);

    if (containingProc && isLocalToProc(containingProc, symbolName)) {
        return { name: symbolName, scope: "procedure", procedureNode: containingProc };
    }

    if (isFileScopeDef(rootNode, symbolName)) {
        return { name: symbolName, scope: "file" };
    }

    // Symbol not defined in any accessible scope
    return null;
}
