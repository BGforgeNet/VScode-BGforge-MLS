/**
 * Local hover provider for Fallout SSL files.
 * Shows hover info for symbols defined in the current file using JSDoc comments.
 */

import { Hover, MarkupKind } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToMarkdown } from "../shared/jsdoc-utils";
import { extractProcedures, findPrecedingDocComment } from "./local-utils";

/**
 * Find the definition node for a symbol by name.
 * Handles: procedures, forward declarations, variables, exports, params, for-loop vars.
 * Prefers procedure definitions over forward declarations.
 */
function findDefinitionNode(root: Node, symbol: string): Node | null {
    // Check procedures first (with deduplication)
    const procedures = extractProcedures(root);
    const proc = procedures.get(symbol);
    if (proc) {
        return proc.node;
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
 * Get hover info for a locally defined symbol.
 * Returns null if the symbol is not defined in this file.
 */
export function getLocalHover(text: string, symbol: string): Hover | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return null;
    }

    const defNode = findDefinitionNode(tree.rootNode, symbol);
    if (!defNode) {
        return null;
    }

    // Look for doc comment
    const docComment = findPrecedingDocComment(tree.rootNode, defNode);
    if (!docComment) {
        // Symbol is local but has no JSDoc - return empty hover to prevent fallback
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: "",
            },
        };
    }

    const parsed = jsdoc.parse(docComment);
    const content = `\`\`\`ssl\n${symbol}\n\`\`\`` + jsdocToMarkdown(parsed, "fallout");

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: content,
        },
    };
}
