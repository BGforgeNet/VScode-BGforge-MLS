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
import { SyntaxType } from "./tree-sitter.d";

/**
 * Scope information for a symbol at a given cursor position.
 *
 * - "file": defined at file scope (procedure name, macro, export, top-level variable)
 * - "procedure": defined locally in a procedure (parameter, variable, for/foreach var)
 * - "external": identifier exists at cursor but is not defined in any scope of the current file
 *   (e.g., a macro from an included header)
 */
export interface SslSymbolScope {
    name: string;
    scope: "file" | "procedure" | "external";
    procedureNode?: Node;
}

/**
 * Walk ancestors to find the containing procedure node.
 * Returns null if the node is not inside a procedure.
 */
export function findContainingProcedure(node: Node): Node | null {
    let current: Node | null = node.parent;
    while (current) {
        if (current.type === SyntaxType.Procedure) {
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
            if (child.type === SyntaxType.Param) {
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
    if (node.type === SyntaxType.VariableDecl) {
        for (const child of node.children) {
            if (child.type === SyntaxType.VarInit) {
                const nameNode = child.childForFieldName("name");
                if (nameNode?.text === symbolName) {
                    return true;
                }
            }
        }
    } else if (node.type === SyntaxType.ForVarDecl) {
        const nameNode = node.childForFieldName("name");
        if (nameNode?.text === symbolName) {
            return true;
        }
    } else if (node.type === SyntaxType.ForeachStmt) {
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
        if (child.type === SyntaxType.Procedure || child.type === SyntaxType.ProcedureForward) {
            const nameNode = child.childForFieldName("name");
            if (nameNode?.text === symbolName) {
                return true;
            }
        }
        if (child.type === SyntaxType.ExportDecl) {
            const nameNode = child.childForFieldName("name");
            if (nameNode?.text === symbolName) {
                return true;
            }
        }
    }

    // Check top-level variable declarations (outside any procedure)
    for (const child of rootNode.children) {
        if (child.type === SyntaxType.VariableDecl) {
            for (const varInit of child.children) {
                if (varInit.type === SyntaxType.VarInit) {
                    const nameNode = varInit.childForFieldName("name");
                    if (nameNode?.text === symbolName) {
                        return true;
                    }
                }
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
 * 4. Otherwise -> external (identifier exists but not defined in this file)
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

    // Symbol exists at cursor but is not defined in this file (e.g., from an included header)
    return { name: symbolName, scope: "external" };
}
