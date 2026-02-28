/**
 * Shared utilities for local symbol extraction.
 */

import type { Node } from "web-tree-sitter";
import { Position } from "vscode-languageserver/node";
import { makeRange } from "../core/position-utils";
import { MacroData, parseMacroParams } from "./macro-utils";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToMarkdown } from "./jsdoc-format";
import { buildSignatureBlock } from "../shared/tooltip-format";
import { LANG_FALLOUT_SSL_TOOLTIP } from "../core/languages";

// Re-export for existing consumers
export { makeRange };

/** Parameter data extracted from AST. */
export interface ParamInfo {
    name: string;
    defaultValue?: string;
}

/**
 * Extract parameters with default values from a procedure/forward node.
 * Parses "variable x = 0" to { name: "x", defaultValue: "0" }.
 */
export function extractParams(procNode: Node): ParamInfo[] {
    const params = procNode.childForFieldName("params");
    if (!params) return [];

    const result: ParamInfo[] = [];
    for (const child of params.children) {
        if (child.type === "param") {
            const nameNode = child.childForFieldName("name");
            const defaultNode = child.childForFieldName("default");
            if (nameNode) {
                result.push({
                    name: nameNode.text,
                    defaultValue: defaultNode?.text,
                });
            }
        }
    }
    return result;
}

import { type SignatureParam, formatSignature } from "../shared/signature-format";

/**
 * Build procedure signature string from AST params and optional JSDoc.
 * Uses JSDoc types if available, AST defaults only.
 */
export function buildProcedureSignature(
    name: string,
    params: ParamInfo[],
    parsed: jsdoc.JSdoc | null
): string {
    if (parsed && parsed.args.length > 0) {
        // Use JSDoc types with AST defaults
        const sigParams: SignatureParam[] = parsed.args.map((arg, idx) => ({
            name: arg.name,
            type: arg.type,
            defaultValue: params[idx]?.defaultValue,
        }));
        const prefix = parsed.ret ? `${parsed.ret.type} ` : "void ";
        return formatSignature({ name, prefix, params: sigParams });
    } else if (params.length > 0) {
        // No JSDoc but has params - extract param names with defaults from AST
        const sigParams: SignatureParam[] = params.map(p => ({
            name: p.name,
            defaultValue: p.defaultValue,
        }));
        return formatSignature({ name, prefix: "procedure ", params: sigParams });
    } else {
        // No params
        return formatSignature({ name, prefix: "procedure ", params: [] });
    }
}

/**
 * Build base tooltip content: signature block + optional file path + optional JSDoc.
 * Shared by procedures and macros.
 * Used by: hover (contents.value), completion (documentation.value), header symbols.
 */
export function buildTooltipBase(
    signature: string,
    jsdoc: jsdoc.JSdoc | null,
    filePath?: string
): string {
    let markdown = buildSignatureBlock(signature, LANG_FALLOUT_SSL_TOOLTIP, filePath);
    if (jsdoc) {
        markdown += jsdocToMarkdown(jsdoc);
    }
    return markdown;
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
    const node = findIdentifierNodeAtPosition(root, position);
    return node?.text ?? null;
}

/**
 * Find the identifier node at the given position.
 * Returns the full Node object for access to position information.
 */
export function findIdentifierNodeAtPosition(root: Node, position: Position): Node | null {
    function visit(node: Node): Node | null {
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
            return node;
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
                            node: child, // Include AST node for location extraction
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
