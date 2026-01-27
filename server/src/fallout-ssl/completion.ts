/**
 * Local completion for Fallout SSL files.
 * Extracts procedures, macros, variables, exports from the current file using tree-sitter.
 */

import { CompletionItem, CompletionItemKind, MarkupKind } from "vscode-languageserver/node";
import { parseWithCache, isInitialized } from "./parser";
import { extractProcedures, extractMacros, findPrecedingDocComment, extractParams, buildProcedureSignature, buildTooltipBase } from "./utils";
import * as jsdoc from "../shared/jsdoc";
import { buildMacroCompletion } from "./macro-utils";

/**
 * Extract completion items from the current file.
 * Includes: procedures, forward declarations, macros, variables, exports.
 * Does NOT include: params, for-loop vars, foreach vars (too local).
 * Deduplicates: if both forward declaration and definition exist, only shows definition.
 */
export function getLocalCompletions(text: string): CompletionItem[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return [];
    }

    const procedures = extractProcedures(tree.rootNode);
    const macros = extractMacros(tree.rootNode);
    const procItems: CompletionItem[] = [];

    for (const [name, { node }] of procedures) {
        // Look for JSDoc
        const docComment = findPrecedingDocComment(tree.rootNode, node);
        const parsed = docComment ? jsdoc.parse(docComment) : null;
        const params = extractParams(node);

        // Build markdown documentation using shared function
        const signature = buildProcedureSignature(name, params, parsed);
        const markdownValue = buildTooltipBase(signature, parsed);

        procItems.push({
            label: name,
            kind: CompletionItemKind.Function,
            documentation: {
                kind: MarkupKind.Markdown,
                value: markdownValue,
            },
        });
    }

    // Extract macros using shared builder
    const macroItems: CompletionItem[] = [];
    for (const macro of macros) {
        // Use dummy URI for local completions (filePath is for display only)
        macroItems.push(buildMacroCompletion(macro, "", ""));
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

    return [...procItems, ...macroItems, ...variables];
}
