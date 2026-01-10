/**
 * Local completion for Fallout SSL files.
 * Extracts procedures, variables, exports from the current file using tree-sitter.
 */

import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import { getParser, isInitialized } from "./parser";
import { extractProcedures } from "./local-utils";

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
    const procItems: CompletionItem[] = Array.from(procedures.keys()).map((name) => ({
        label: name,
        kind: CompletionItemKind.Function,
    }));

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
