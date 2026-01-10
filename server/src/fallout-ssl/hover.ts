/**
 * Local hover provider for Fallout SSL files.
 * Shows hover info for symbols defined in the current file using JSDoc comments.
 */

import { Hover, MarkupKind } from "vscode-languageserver/node";
import { getParser, isInitialized } from "./parser";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToMarkdown, jsdocToDetail } from "../shared/jsdoc-utils";
import { findDefinitionNode, findPrecedingDocComment, extractMacros } from "./utils";
import { LANG_FALLOUT_SSL_TOOLTIP } from "../core/languages";
import { buildMacroHover } from "./macro-utils";

/**
 * Get hover info for a locally defined symbol.
 * Returns null if the symbol is not defined in this file.
 */
export function getLocalHover(text: string, symbol: string, _uri: string): Hover | null {
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

    // Handle macros using shared builder
    if (defNode.type === "define") {
        const macros = extractMacros(tree.rootNode);
        const macro = macros.find(m => m.name === symbol);
        if (macro) {
            const contents = buildMacroHover(macro, "");
            return { contents };
        }
        return null;
    }

    // Look for doc comment
    const docComment = findPrecedingDocComment(tree.rootNode, defNode);
    const parsed = docComment ? jsdoc.parse(docComment) : null;

    // Build signature - always show it, even without JSDoc
    let detail = symbol;
    if (defNode.type === "procedure" || defNode.type === "procedure_forward") {
        const params = defNode.childForFieldName("params");
        const hasParams = params && params.namedChildren.length > 0;

        if (parsed && parsed.args.length > 0) {
            // Use JSDoc info to build signature (includes types)
            detail = jsdocToDetail(symbol, parsed, "proc");
        } else if (hasParams) {
            // No JSDoc but has params - extract param names from node
            const paramNames: string[] = [];
            for (const child of params.children) {
                if (child.type === "param") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        paramNames.push(nameNode.text);
                    }
                }
            }
            detail = `procedure ${symbol}(${paramNames.join(", ")})`;
        } else {
            // No params
            detail = `procedure ${symbol}()`;
        }
    }

    // Build hover content: signature in code block + JSDoc markdown if available
    let content = `\`\`\`${LANG_FALLOUT_SSL_TOOLTIP}\n${detail}\n\`\`\``;
    if (parsed) {
        content += jsdocToMarkdown(parsed, "fallout");
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: content,
        },
    };
}
