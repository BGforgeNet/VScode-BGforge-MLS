/**
 * Shared utilities for local symbol extraction.
 */

import type { Node } from "web-tree-sitter";
import { Position } from "vscode-languageserver/node";
import { MacroData, parseMacroParams } from "./macro-utils";
import * as jsdoc from "../shared/jsdoc";

/**
 * Create a Position from a tree-sitter point.
 */
function makePosition(row: number, col: number): Position {
    return { line: row, character: col };
}

/**
 * Create a range from a tree-sitter node.
 */
export function makeRange(node: Node) {
    return {
        start: makePosition(node.startPosition.row, node.startPosition.column),
        end: makePosition(node.endPosition.row, node.endPosition.column),
    };
}

/**
 * Find doc comment immediately preceding a node.
 * Comments are siblings in the tree.
 */
export function findPrecedingDocComment(root: Node, defNode: Node): string | null {
    const defLine = defNode.startPosition.row;

    for (const node of root.children) {
        if (node.type === "comment") {
            const text = node.text;
            if (!text.startsWith("/**")) {
                continue;
            }
            const commentEndLine = node.endPosition.row;
            if (commentEndLine === defLine - 1 || commentEndLine === defLine) {
                return text;
            }
        }
    }
    return null;
}

/**
 * Extract all procedures from root, deduplicating by name.
 * Definition takes precedence over forward declaration.
 * Returns Map<name, { node, isForward }>.
 */
export function extractProcedures(root: Node): Map<string, { node: Node; isForward: boolean }> {
    const procedures = new Map<string, { node: Node; isForward: boolean }>();

    for (const node of root.children) {
        if (node.type === "procedure") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                // Definition always wins
                procedures.set(nameNode.text, { node, isForward: false });
            }
        } else if (node.type === "procedure_forward") {
            const nameNode = node.childForFieldName("name");
            if (nameNode && !procedures.has(nameNode.text)) {
                // Only add forward if definition doesn't exist
                procedures.set(nameNode.text, { node, isForward: true });
            }
        }
    }

    return procedures;
}

/**
 * Find a procedure by name, preferring definition over forward.
 */
export function findProcedure(root: Node, symbol: string): Node | null {
    const procedures = extractProcedures(root);
    const proc = procedures.get(symbol);
    return proc?.node ?? null;
}

/**
 * Find the identifier at the given position.
 * Used by go-to-definition and rename.
 */
export function findIdentifierAtPosition(root: Node, position: Position): string | null {
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
 * Find the definition node for a symbol by name.
 * Handles: procedures, forward declarations, macros, variables, exports, params, for-loop vars, foreach vars.
 * Prefers procedure definitions over forward declarations.
 */
export function findDefinitionNode(root: Node, symbol: string): Node | null {
    // Check procedures first (with deduplication)
    const procedures = extractProcedures(root);
    const proc = procedures.get(symbol);
    if (proc) {
        return proc.node;
    }

    // Check macros
    const macroNode = findMacroDefinition(root, symbol);
    if (macroNode) {
        return macroNode;
    }

    // Check inside procedures for params and local vars
    function search(node: Node): Node | null {
        if (node.type === "procedure") {
            // Check parameters
            const params = node.childForFieldName("params");
            if (params) {
                for (const child of params.children) {
                    if (child.type === "param") {
                        const paramName = child.childForFieldName("name");
                        if (paramName?.text === symbol) {
                            return child;
                        }
                    }
                }
            }
            // Check inside procedure body
            for (const child of node.children) {
                const result = search(child);
                if (result) return result;
            }
        } else if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode?.text === symbol) {
                        return child;
                    }
                }
            }
        } else if (node.type === "for_var_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode?.text === symbol) {
                return node;
            }
        } else if (node.type === "foreach_stmt") {
            const varNode = node.childForFieldName("var");
            if (varNode?.text === symbol) {
                return varNode;
            }
            const keyNode = node.childForFieldName("key");
            if (keyNode?.text === symbol) {
                return keyNode;
            }
            const valueNode = node.childForFieldName("value");
            if (valueNode?.text === symbol) {
                return valueNode;
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode?.text === symbol) {
                return node;
            }
        }
        return null;
    }

    for (const node of root.children) {
        const result = search(node);
        if (result) return result;
    }

    return null;
}

/**
 * Check if a symbol is defined locally.
 * Reuses findDefinitionNode for consistency.
 */
export function isLocalDefinition(root: Node, symbol: string): boolean {
    return findDefinitionNode(root, symbol) !== null;
}

/**
 * Find all identifier nodes with the given name.
 * Used by rename to find all references.
 */
export function findAllReferences(root: Node, symbol: string): Node[] {
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
 * Extract all macros from tree-sitter AST.
 * Returns MacroData objects with name, params, body, jsdoc, etc.
 */
export function extractMacros(root: Node): MacroData[] {
    const macros: MacroData[] = [];

    function visit(node: Node) {
        if (node.type === "preprocessor") {
            // Check if it's a define
            for (const child of node.children) {
                if (child.type === "define") {
                    const nameNode = child.childForFieldName("name");
                    const paramsNode = child.childForFieldName("params");
                    const bodyNode = child.childForFieldName("body");

                    if (nameNode) {
                        const name = nameNode.text;
                        const bodyText = bodyNode?.text || "";

                        // Extract params - paramsNode should always be captured by grammar now
                        let params: string[] | undefined;
                        let hasParams = false;
                        let actualBody = bodyText.trimStart();

                        if (paramsNode) {
                            params = parseMacroParams(paramsNode.text);
                            hasParams = true;
                        }
                        // Note: No fallback needed - grammar with token.immediate always captures params correctly

                        // Extract body info
                        const multiline = actualBody.includes("\n");
                        const firstline = multiline ? (actualBody.split("\n")[0] || "").trim() : actualBody.trim();

                        // Extract JSDoc (search for preceding comment in parent's siblings)
                        const docComment = findPrecedingDocComment(root, node);
                        const parsedJsdoc = docComment ? jsdoc.parse(docComment) : undefined;

                        macros.push({
                            name,
                            params,
                            hasParams,
                            body: actualBody.trim(),
                            firstline,
                            multiline,
                            jsdoc: parsedJsdoc,
                        });
                    }
                }
            }
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
    return macros;
}

/**
 * Find macro definition by name.
 * Returns the 'define' node or null.
 */
function findMacroDefinition(root: Node, symbol: string): Node | null {
    let result: Node | null = null;

    function visit(node: Node) {
        if (result) return;

        if (node.type === "preprocessor") {
            for (const child of node.children) {
                if (child.type === "define") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode?.text === symbol) {
                        result = child;
                        return;
                    }
                }
            }
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
    return result;
}
