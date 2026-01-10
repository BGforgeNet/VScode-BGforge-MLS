/**
 * Local signature help for Fallout SSL files.
 * Extracts procedure and macro signatures from the current file using tree-sitter.
 */

import { ParameterInformation, SignatureHelp, SignatureInformation } from "vscode-languageserver/node";
import { getParser, isInitialized } from "./parser";
import * as jsdoc from "../shared/jsdoc";
import { findProcedure, findPrecedingDocComment, extractMacros } from "./utils";
import { buildSignatureFromJSDoc } from "./macro-utils";

/**
 * Get signature help for a local procedure or function-like macro.
 * Returns null if the symbol is not found in the current file.
 */
export function getLocalSignature(text: string, symbol: string, paramIndex: number): SignatureHelp | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return null;
    }

    // Try procedure first
    const procNode = findProcedure(tree.rootNode, symbol);
    if (procNode) {
        // Extract parameters
        const params = procNode.childForFieldName("params");
        const paramNames: string[] = [];
        if (params) {
            for (const child of params.children) {
                if (child.type === "param") {
                    const nameNode = child.childForFieldName("name");
                    if (nameNode) {
                        paramNames.push(nameNode.text);
                    }
                }
            }
        }

        // Look for JSDoc
        const docComment = findPrecedingDocComment(tree.rootNode, procNode);
        let parsed: jsdoc.JSdoc | null = null;
        if (docComment) {
            parsed = jsdoc.parse(docComment);
        }

        // Build parameter information with types from JSDoc
        const parameters: ParameterInformation[] = paramNames.map((name, idx) => {
            const arg = parsed?.args[idx];
            let label = name;
            let documentation: string | undefined;

            if (arg) {
                // Include type in label if available
                if (arg.type) {
                    label = `${arg.type} ${name}`;
                }
                if (arg.description) {
                    documentation = arg.description;
                }
            }

            return {
                label,
                documentation,
            };
        });

        // Build signature label with types
        let label: string;
        if (parsed && parsed.args.length > 0) {
            // Use JSDoc types for params
            const paramLabels = parsed.args.map(arg => `${arg.type} ${arg.name}`);
            label = `${symbol}(${paramLabels.join(", ")})`;
            if (parsed.ret) {
                label = `${parsed.ret.type} ${label}`;
            }
        } else {
            // Fallback to just names
            label = `${symbol}(${paramNames.join(", ")})`;
        }

        const signature: SignatureInformation = {
            label,
            parameters,
        };

        if (parsed?.desc) {
            signature.documentation = parsed.desc;
        }

        return {
            signatures: [signature],
            activeSignature: 0,
            activeParameter: paramIndex,
        };
    }

    // Try macros
    const macros = extractMacros(tree.rootNode);
    const macro = macros.find(m => m.name === symbol && m.hasParams);

    if (macro && macro.jsdoc && macro.jsdoc.args.length > 0) {
        // Use shared builder for macros with JSDoc
        const sig = buildSignatureFromJSDoc(macro.name, macro.jsdoc, "");
        return {
            signatures: [sig],
            activeSignature: 0,
            activeParameter: paramIndex
        };
    }

    return null;
}
