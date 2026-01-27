/**
 * Local hover provider for Fallout SSL files.
 * Shows hover info for symbols defined in the current file using JSDoc comments.
 */

import { Hover, MarkupKind } from "vscode-languageserver/node";
import { parseWithCache, isInitialized } from "./parser";
import * as jsdoc from "../shared/jsdoc";
import { findDefinitionNode, findPrecedingDocComment, extractMacros, extractParams, buildProcedureSignature, buildTooltipBase } from "./utils";
import { buildMacroTooltip } from "./macro-utils";
import { LANG_FALLOUT_SSL_TOOLTIP } from "../core/languages";

/**
 * Get hover info for a locally defined symbol.
 * Returns null if the symbol is not defined in this file.
 */
export function getLocalHover(text: string, symbol: string, _uri: string): Hover | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
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
            const contents = {
                kind: MarkupKind.Markdown,
                value: buildMacroTooltip(macro, ""),
            };
            return { contents };
        }
        return null;
    }

    // Look for doc comment
    const docComment = findPrecedingDocComment(tree.rootNode, defNode);
    const parsed = docComment ? jsdoc.parse(docComment) : null;

    // Build hover content using shared function
    if (defNode.type === "procedure" || defNode.type === "procedure_forward") {
        const params = extractParams(defNode);
        const signature = buildProcedureSignature(symbol, params, parsed);
        const content = buildTooltipBase(signature, parsed);

        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: content,
            },
        };
    }

    // Fallback for other definition types (variables, exports, etc.)
    let content = `\`\`\`${LANG_FALLOUT_SSL_TOOLTIP}\n${symbol}\n\`\`\``;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: content,
        },
    };
}
