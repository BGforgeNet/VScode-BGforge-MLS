/**
 * Snippet generation for WeiDU TP2 function calls.
 * Builds VS Code snippets with tab stops for required parameters.
 * Indent size is shared with the formatter via DEFAULT_OPTIONS.
 */

import type { CallableInfo, CallableParam } from "../core/symbol";
import { DEFAULT_OPTIONS } from "./format/types";

const INDENT_UNIT = " ".repeat(DEFAULT_OPTIONS.indentSize);
const KEYWORD_INDENT = INDENT_UNIT;
const ASSIGN_INDENT = INDENT_UNIT.repeat(2);

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
    const params = callable.params;
    const hasParams = params !== undefined
        && (params.intVar.length > 0 || params.strVar.length > 0);
    const mayHaveParams = params === undefined || hasParams;

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

    // If any required params exist, build explicit param blocks
    const requiredInt = params?.intVar.filter(p => p.required) ?? [];
    const requiredStr = params?.strVar.filter(p => p.required) ?? [];

    if (requiredInt.length > 0 || requiredStr.length > 0) {
        const lines = [firstLine];
        let tabStop = 1;
        tabStop = appendParamBlock(lines, "INT_VAR", requiredInt, tabStop);
        appendParamBlock(lines, "STR_VAR", requiredStr, tabStop);
        lines.push("END");
        return lines.join("\n") + "\n$0";
    }

    // Has params but none required: cursor between name and END for manual entry
    return `${firstLine}\n${INDENT_UNIT}$0\nEND`;
}

/**
 * Append a param keyword block (INT_VAR or STR_VAR) with aligned assignments.
 * Names are padded to the longest name in the block so `=` signs align vertically.
 * Returns the next tab stop number.
 *
 * NOTE: This mirrors the alignment logic in outputAlignedAssignments() in format/utils.ts.
 * If formatting rules change (indentation, alignment, separator), update both places.
 */
function appendParamBlock(
    lines: string[],
    keyword: string,
    params: readonly CallableParam[],
    tabStop: number,
): number {
    if (params.length === 0) {
        return tabStop;
    }
    const maxNameLen = Math.max(...params.map(p => p.name.length));
    lines.push(`${KEYWORD_INDENT}${keyword}`);
    for (const p of params) {
        const padding = " ".repeat(maxNameLen - p.name.length);
        lines.push(`${ASSIGN_INDENT}${p.name}${padding} = \${${tabStop++}}`);
    }
    return tabStop;
}
