/**
 * Local signature help for Fallout SSL files.
 * Extracts procedure and macro signatures from the current file using tree-sitter.
 */

import { ParameterInformation, SignatureHelp, SignatureInformation } from "vscode-languageserver/node";
import { parseWithCache, isInitialized } from "./parser";
import * as jsdoc from "../shared/jsdoc";
import { findProcedure, findPrecedingDocComment, extractMacros, extractParams } from "./utils";
import { buildSignatureFromJSDoc } from "./macro-utils";

/**
 * Get signature help for a local procedure or function-like macro.
 * Returns null if the symbol is not found in the current file.
 */
export function getLocalSignature(text: string, symbol: string, paramIndex: number): SignatureHelp | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    // Try procedure first
    const procNode = findProcedure(tree.rootNode, symbol);
    if (procNode) {
        // Extract parameters with defaults from AST
        const params = extractParams(procNode);

        // Look for JSDoc
        const docComment = findPrecedingDocComment(tree.rootNode, procNode);
        let parsed: jsdoc.JSdoc | null = null;
        if (docComment) {
            parsed = jsdoc.parse(docComment);
        }

        // Build parameter information with types from JSDoc and defaults from AST only
        const parameters: ParameterInformation[] = params.map((p, idx) => {
            const arg = parsed?.args[idx];
            let label = p.name;
            let documentation: string | undefined;

            if (arg) {
                // Include type in label if available from JSDoc
                if (arg.type) {
                    label = `${arg.type} ${p.name}`;
                }
                if (arg.description) {
                    documentation = arg.description;
                }
            }
            // Include default from AST only
            if (p.defaultValue) {
                label = `${label} = ${p.defaultValue}`;
            }

            return {
                label,
                documentation,
            };
        });

        // Build signature label with types from JSDoc and defaults from AST
        let label: string;
        if (parsed && parsed.args.length > 0) {
            // Use JSDoc types for params, with defaults from AST only
            const paramLabels = parsed.args.map((arg, idx) => {
                const def = params[idx]?.defaultValue;
                const base = `${arg.type} ${arg.name}`;
                return def ? `${base} = ${def}` : base;
            });
            label = `${symbol}(${paramLabels.join(", ")})`;
            if (parsed.ret) {
                label = `${parsed.ret.type} ${label}`;
            }
        } else {
            // Fallback to names with defaults from AST
            const paramLabels = params.map(p =>
                p.defaultValue ? `${p.name} = ${p.defaultValue}` : p.name
            );
            label = `${symbol}(${paramLabels.join(", ")})`;
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
