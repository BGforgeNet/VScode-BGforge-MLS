/**
 * Snippet generation for WeiDU TP2 function calls.
 * Builds VS Code snippets with tab stops for required parameters.
 */

import { buildParamInfoMap } from "../shared/jsdoc";
import type { FunctionInfo } from "./header-parser";

/**
 * Build a snippet for function call with required parameters.
 * Returns null if no required params exist.
 *
 * @param funcInfo - Function information from header
 * @param prefix - Optional prefix to add before function name (e.g., "LAF" or "LPF")
 */
export function buildFunctionCallSnippet(funcInfo: FunctionInfo, prefix?: string): string | null {
    if (!funcInfo.params) {
        return null;
    }

    const paramInfoMap = buildParamInfoMap(funcInfo.jsdoc);
    const requiredIntParams: string[] = [];
    const requiredStrParams: string[] = [];

    // Collect required INT_VAR params
    for (const param of funcInfo.params.intVar) {
        const info = paramInfoMap.get(param.name);
        if (info?.required) {
            requiredIntParams.push(param.name);
        }
    }

    // Collect required STR_VAR params
    for (const param of funcInfo.params.strVar) {
        const info = paramInfoMap.get(param.name);
        if (info?.required) {
            requiredStrParams.push(param.name);
        }
    }

    // If no required params, return null
    if (requiredIntParams.length === 0 && requiredStrParams.length === 0) {
        return null;
    }

    // Build snippet with tab stops
    const firstLine = prefix ? `${prefix} ${funcInfo.name}` : funcInfo.name;
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
