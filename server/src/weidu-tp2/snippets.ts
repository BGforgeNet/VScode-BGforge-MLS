/**
 * Snippet generation for WeiDU TP2 function calls.
 * Builds VS Code snippets with tab stops for required parameters.
 */

import type { CallableInfo } from "../core/symbol";

/**
 * Build a snippet for function call with required parameters.
 * Returns null if no required params exist.
 *
 * @param callable - CallableInfo from Symbols (has JSDoc data merged into params)
 * @param name - Function name
 * @param prefix - Optional prefix to add before function name (e.g., "LAF" or "LPF")
 */
export function buildFunctionCallSnippet(callable: CallableInfo, name: string, prefix?: string): string | null {
    if (!callable.params) {
        return null;
    }

    // CallableParams already have `required` field from JSDoc
    const requiredIntParams = callable.params.intVar.filter(p => p.required).map(p => p.name);
    const requiredStrParams = callable.params.strVar.filter(p => p.required).map(p => p.name);

    // If no required params, return null
    if (requiredIntParams.length === 0 && requiredStrParams.length === 0) {
        return null;
    }

    // Build snippet with tab stops
    const firstLine = prefix ? `${prefix} ${name}` : name;
    const lines: string[] = [firstLine];
    let tabStop = 1;

    // Add INT_VAR block if there are required int params
    if (requiredIntParams.length > 0) {
        lines.push("    INT_VAR");
        for (const paramName of requiredIntParams) {
            lines.push(`        ${paramName} = $${tabStop}`);
            tabStop++;
        }
    }

    // Add STR_VAR block if there are required str params
    if (requiredStrParams.length > 0) {
        lines.push("    STR_VAR");
        for (const paramName of requiredStrParams) {
            lines.push(`        ${paramName} = $${tabStop}`);
            tabStop++;
        }
    }

    // Add END with final tab stop
    lines.push("END$0");

    return lines.join("\n");
}
