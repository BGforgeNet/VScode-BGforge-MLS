/**
 * Shared JSDoc formatting utilities.
 * Extracts common JSDoc-to-markdown conversion logic used by both Fallout SSL and WeiDU modules.
 */

import type { JSdoc } from "./jsdoc";
import { formatSignature, type SignatureParam } from "./signature-format";

export type JsdocFormat = "fallout" | "weidu";

/**
 * Convert JSDoc to markdown documentation.
 * @param jsd Parsed JSDoc object
 * @param format Output format - "fallout" uses a single table, "weidu" separates INT_VAR/STR_VAR
 * @returns Markdown string
 */
export function jsdocToMarkdown(jsd: JSdoc, format: JsdocFormat = "fallout"): string {
    let md = "\n---\n";

    if (jsd.desc) {
        md += `\n${jsd.desc}`;
    }

    if (jsd.args.length > 0) {
        if (format === "weidu") {
            md += formatWeiduArgs(jsd.args);
        } else {
            md += formatFalloutArgs(jsd.args);
        }
    }

    if (jsd.ret) {
        if (format === "weidu") {
            md += `\n\n Returns \`${jsd.ret.type}\``;
        } else {
            md += `\n\n**Returns** \`${jsd.ret.type}\``;
        }
    }

    md += formatDeprecated(jsd.deprecated);

    return md;
}

/**
 * Fallout format: simple table with name and description.
 * Type and default values are shown in the signature.
 */
function formatFalloutArgs(args: JSdoc["args"]): string {
    let md = "\n\n|name|description|\n|:-|:-|";
    for (const arg of args) {
        md += `\n|${arg.name}|${arg.description ?? ""}|`;
    }
    return md;
}

/**
 * WeiDU format: separate tables for INT_VAR (bool, int) and STR_VAR (ids, resref, filename, string).
 */
function formatWeiduArgs(args: JSdoc["args"]): string {
    let md = "";

    const intVars = args.filter((item) => {
        switch (item.type) {
            case "bool":
            case "int":
                return true;
            default:
                return false;
        }
    });

    const strVars = args.filter((item) => {
        switch (item.type) {
            case "ids":
            case "resref":
            case "filename":
            case "string":
                return true;
            default:
                return false;
        }
    });

    if (intVars.length > 0) {
        md += "\n\n|INT_VAR|Name|Default|Description|\n|:-|:-|:-:|:-|";
        for (const arg of intVars) {
            md += `\n| \`${arg.type}\` | ${arg.name} |`;
            if (arg.default) {
                md += `${arg.default}`;
            }
            md += "|";
            if (arg.description) {
                md += `${arg.description}`;
            }
            md += "|";
        }
    }

    if (strVars.length > 0) {
        if (intVars.length === 0) {
            md += "\n\n|STR_VAR|Name|Default|Description|\n|:-|:-|:-:|:-|";
        } else {
            md += "\n|**STR_VAR**||||";
        }
        for (const arg of strVars) {
            md += `\n| \`${arg.type}\` | ${arg.name} |`;
            if (arg.default) {
                md += `${arg.default}`;
            }
            md += "|";
            if (arg.description) {
                md += `${arg.description}`;
            }
            md += "|";
        }
    }

    return md;
}

/**
 * Format deprecation notice.
 */
function formatDeprecated(deprecated: JSdoc["deprecated"]): string {
    if (deprecated === undefined) {
        return "";
    }
    if (deprecated === true) {
        return "\n\n---\n\nDeprecated.";
    }
    return `\n\n---\n\nDeprecated: ${deprecated}`;
}

/**
 * Create detail string from JSDoc (used in completion items).
 * For procedures: "int myFunc(int a, string b)"
 * For macros: "MY_MACRO(a, b)" (no return type, no parens if no args)
 *
 * @param label Symbol name
 * @param jsd Parsed JSDoc
 * @param tokenType "proc" adds void return, "macro" has no prefix
 */
export function jsdocToDetail(
    label: string,
    jsd: JSdoc,
    tokenType: "proc" | "macro" = "proc",
): string {
    // Determine prefix: return type for procs, empty for macros
    let prefix = "";
    if (jsd.ret) {
        prefix = `${jsd.ret.type} `;
    } else if (tokenType === "proc") {
        prefix = "void ";
    }

    // Build params from JSDoc (no default values - those come from AST)
    const params: SignatureParam[] = jsd.args.map(({ type, name }) => ({
        name,
        type,
    }));

    return formatSignature({ name: label, prefix, params });
}
