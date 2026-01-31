/**
 * Snippet generation for WeiDU TP2 function calls.
 * Builds VS Code snippets with tab stops for required parameters.
 */

import type { CallableInfo } from "../core/symbol";

/**
 * Build a snippet for a function/macro call.
 * Always returns a snippet when prefix is provided (wraps in LPF/LAF ... END).
 * Without prefix, only returns a snippet when there are required parameters.
 *
 * @param callable - CallableInfo from Symbols (has JSDoc data merged into params)
 * @param name - Function name
 * @param prefix - Optional prefix to add before function name (e.g., "LAF" or "LPF")
 */
export function buildFunctionCallSnippet(callable: CallableInfo, name: string, prefix?: string): string | null {
    // When params info is available, check if any params exist.
    // When params is undefined (static symbols from YAML), assume params may exist.
    const paramsKnown = callable.params !== undefined;
    const hasParams = paramsKnown
        && ((callable.params!.intVar.length > 0) || (callable.params!.strVar.length > 0));
    const mayHaveParams = !paramsKnown || hasParams;

    // Without prefix (lafName/lpfName context), only generate snippet if may have params
    if (!prefix && !mayHaveParams) {
        return null;
    }

    // Macro launch (LAM/LPM) is a simple statement — no params, no END
    if (prefix === "LAM" || prefix === "LPM") {
        return `${prefix} ${name}\n$0`;
    }

    const firstLine = prefix ? `${prefix} ${name}` : name;

    // No params: single-line "LAF name END", cursor on next line
    if (!mayHaveParams) {
        return `${firstLine} END\n$0`;
    }

    // Has params: cursor between name and END, indented one level for param block
    return `${firstLine}\n    $0\nEND`;
}
