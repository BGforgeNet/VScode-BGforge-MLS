/**
 * Shared table rendering for tooltip markdown.
 * Produces identical output for both built-in (YAML via generate-data.ts)
 * and JSDoc-parsed (hover.ts / jsdoc-format.ts) tooltip paths.
 */

import { formatTypeLink } from "./weidu-types";

export interface VarRow {
    readonly type: string;
    readonly name: string;
    readonly default?: string;
    readonly required?: boolean;
    readonly description?: string;
}

export interface VarSection {
    readonly label: string;
    readonly rows: readonly VarRow[];
}

/**
 * WeiDU: single 4-column table with bold section label rows.
 *
 * Output format:
 *   | | | | |
 *   |-:|:-|:-|:-|
 *   |**INT**|**vars**|||
 *   |[int](url)|name|=&nbsp;default|&nbsp;&nbsp;desc|
 *   |**RET**|**vars**|||
 *   |[string](url)|name||&nbsp;&nbsp;desc|
 */
export function buildWeiduTable(sections: readonly VarSection[]): string {
    const nonEmpty = sections.filter((s) => s.rows.length > 0);
    if (nonEmpty.length === 0) {
        return "";
    }

    const rows: string[] = [
        "| | | | |",
        "|-:|:-|:-|:-|",
    ];

    for (const section of nonEmpty) {
        const [word1, word2] = section.label.split(" ");
        rows.push(`|**${word1}**|**${word2}**|||`);

        for (const row of section.rows) {
            const type = formatTypeLink(row.type);
            const defCell = formatDefault(row);
            const descCell = row.description ? `&nbsp;&nbsp;${row.description}` : "";
            rows.push(`|${type}|${row.name}|${defCell}|${descCell}|`);
        }
    }

    return rows.join("\n");
}

/**
 * Format default/required column value for a WeiDU table row.
 * Required rows show "_required_", rows with defaults show "=&nbsp;value",
 * otherwise empty.
 */
function formatDefault(row: VarRow): string {
    if (row.required) return "_required_";
    if (row.default !== undefined) return `=&nbsp;${row.default}`;
    return "";
}

/**
 * Fallout: headerless 2-column table (name in backticks + description).
 * Only includes args that have descriptions.
 *
 * Output format:
 *   |||
 *   |:-|:-|
 *   |`name`|&nbsp;&nbsp;desc|
 */
export function buildFalloutArgsTable(args: readonly { readonly name: string; readonly description?: string }[]): string {
    const described = args.filter((a) => a.description);
    if (described.length === 0) {
        return "";
    }

    const rows: string[] = [
        "|||",
        "|:-|:-|",
    ];

    for (const arg of described) {
        rows.push(`|\`${arg.name}\`|&nbsp;&nbsp;${arg.description}|`);
    }

    return rows.join("\n");
}
