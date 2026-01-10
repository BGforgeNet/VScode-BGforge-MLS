/**
 * Go to Definition for Fallout SSL files.
 * Finds local definitions (procedures, macros, variables) in the current file.
 * Returns null if not found locally, allowing fallback to header definitions.
 */

import { Location, Position } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";
import { extractProcedures, makeRange, findIdentifierAtPosition } from "./utils";

interface LocalDef {
    name: string;
    range: { start: Position; end: Position };
}

/**
 * Find all local definitions including params and for-loop vars.
 * More comprehensive than extractSymbols (which is for document outline).
 * Prefers procedure definitions over forward declarations.
 */
function findAllLocalDefinitions(root: Node): LocalDef[] {
    const defs: LocalDef[] = [];

    // Extract procedures (already deduped)
    const procedures = extractProcedures(root);
    for (const [name, { node }] of procedures) {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
            defs.push({
                name,
                range: makeRange(nameNode),
            });
        }
    }

    // Extract macros
    function visitForMacros(node: Node): void {
        if (node.type === "preprocessor") {
            for (const child of node.children) {
                if (child.type === "define") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        defs.push({
                            name: nameNode.text,
                            range: makeRange(nameNode),
                        });
                    }
                }
            }
        }
        for (const c of node.children) {
            visitForMacros(c);
        }
    }
    visitForMacros(root);

    function search(node: Node): void {
        if (node.type === "procedure") {
            // Check parameters
            const params = node.childForFieldName("params");
            if (params) {
                for (const child of params.children) {
                    if (child.type === "param") {
                        const paramName = child.childForFieldName("name");
                        if (paramName) {
                            defs.push({ name: paramName.text, range: makeRange(paramName) });
                        }
                    }
                }
            }
        } else if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        defs.push({ name: nameNode.text, range: makeRange(nameNode) });
                    }
                }
            }
        } else if (node.type === "for_var_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                defs.push({ name: nameNode.text, range: makeRange(nameNode) });
            }
        } else if (node.type === "foreach_stmt") {
            const varNode = node.childForFieldName("var");
            if (varNode) {
                defs.push({ name: varNode.text, range: makeRange(varNode) });
            }
            const keyNode = node.childForFieldName("key");
            if (keyNode) {
                defs.push({ name: keyNode.text, range: makeRange(keyNode) });
            }
            const valueNode = node.childForFieldName("value");
            if (valueNode) {
                defs.push({ name: valueNode.text, range: makeRange(valueNode) });
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                defs.push({ name: nameNode.text, range: makeRange(nameNode) });
            }
        }

        for (const child of node.children) {
            search(child);
        }
    }

    for (const node of root.children) {
        search(node);
    }

    return defs;
}

/**
 * Get definition location for the symbol at the given position.
 * Returns null if not found locally (falls back to header definitions).
 */
export function getLocalDefinition(text: string, uri: string, position: Position): Location | null {
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

    const defs = findAllLocalDefinitions(tree.rootNode);
    const def = defs.find(d => d.name === symbol);
    if (!def) {
        return null;
    }

    return {
        uri,
        range: def.range,
    };
}
