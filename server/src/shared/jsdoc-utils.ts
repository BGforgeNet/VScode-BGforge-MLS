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

    // Named returns (rets[]) - for WeiDU RET/RET_ARRAY variables
    if (jsd.rets && jsd.rets.length > 0 && format === "weidu") {
        md += formatWeiduRets(jsd.rets);
    } else if (jsd.ret?.description) {
        md += `\n\n**Returns** ${jsd.ret.description}`;
    }

    md += formatDeprecated(jsd.deprecated);

    return md;
}

/**
 * Fallout format: space-padded plain text with name and description.
 * Names are padded to align descriptions, with a minimum 2-space gap.
 * Type and default values are shown in the signature.
 */
function formatFalloutArgs(args: JSdoc["args"]): string {
    // Only list args that have descriptions (type/name already shown in signature)
    const described = args.filter((a) => a.description);
    if (described.length === 0) {
        return "";
    }

    // Headerless table, arg names in inline code, dash before description.
    let md = "\n\n|||\n|:-|:-|";
    for (const arg of described) {
        md += `\n|\`${arg.name}\`|&nbsp;&nbsp;${arg.description}|`;
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

    const addSection = (sectionName: string, vars: JSdoc["args"]) => {
        if (vars.length === 0) return;

        md += `\n\n**${sectionName}**\n\n||||\n|-:|:-|:-|`;
        for (const arg of vars) {
            const desc = arg.description ? `&nbsp;&nbsp;${arg.description}` : "";
            md += `\n|\`${arg.type}\`|${arg.name}|${desc}|`;
        }
    };

    addSection("INT vars", intVars);
    addSection("STR vars", strVars);

    return md;
}

/**
 * WeiDU format: table for named RET/RET_ARRAY variables.
 * The actual RET vs RET_ARRAY distinction comes from the AST, not from JSDoc.
 */
function formatWeiduRets(rets: JSdoc["rets"]): string {
    if (!rets || rets.length === 0) {
        return "";
    }

    let md = "\n\n**RET vars**\n\n||||\n|-:|:-|:-|";
    for (const ret of rets) {
        const desc = ret.description ? `&nbsp;&nbsp;${ret.description}` : "";
        md += `\n|\`${ret.type}\`|${ret.name}|${desc}|`;
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
