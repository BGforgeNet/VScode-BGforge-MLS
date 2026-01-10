/**
 * Local completion for Fallout SSL files.
 * Extracts procedures, variables, exports from the current file using tree-sitter.
 */

import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import { getParser, isInitialized } from "./parser";
import { extractProcedures, findPrecedingDocComment } from "./local-utils";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToDetail } from "../shared/jsdoc-utils";

/**
 * Extract completion items from the current file.
 * Includes: procedures, forward declarations, variables, exports.
 * Does NOT include: params, for-loop vars, foreach vars (too local).
 * Deduplicates: if both forward declaration and definition exist, only shows definition.
 */
export function getLocalCompletions(text: string): CompletionItem[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return [];
    }

    const procedures = extractProcedures(tree.rootNode);
    const procItems: CompletionItem[] = [];

    for (const [name, { node }] of procedures) {
        // Build detail with signature - same logic as fallout.ts header parsing
        const params = node.childForFieldName("params");
        const hasParams = params && params.namedChildren.length > 0;

        // Look for JSDoc
        const docComment = findPrecedingDocComment(tree.rootNode, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;

        let detail = name;
        if (parsed && parsed.args.length > 0) {
            // Use JSDoc to build signature with types
            detail = jsdocToDetail(name, parsed, "proc");
        } else if (hasParams) {
            // No JSDoc but has params - extract param names
            const paramNames: string[] = [];
            for (const child of params.children) {
                if (child.type === "param") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        paramNames.push(nameNode.text);
                    }
                }
            }
            detail = `procedure ${name}(${paramNames.join(", ")})`;
        } else {
            // No params
            detail = `procedure ${name}()`;
        }

        procItems.push({
            label: name,
            detail,
            kind: CompletionItemKind.Function,
        });
    }

    const variables: CompletionItem[] = [];

    for (const node of tree.rootNode.children) {
        if (node.type === "variable_decl") {
            for (const child of node.children) {
                if (child.type === "var_init") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        variables.push({
                            label: nameNode.text,
                            kind: CompletionItemKind.Variable,
                        });
                    }
                }
            }
        } else if (node.type === "export_decl") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                variables.push({
                    label: nameNode.text,
                    kind: CompletionItemKind.Variable,
                });
            }
        }
    }

    return [...procItems, ...variables];
}
