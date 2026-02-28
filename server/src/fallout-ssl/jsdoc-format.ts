/**
 * Fallout SSL JSDoc-to-markdown formatting utilities.
 * Converts parsed JSDoc objects to markdown for hover tooltips and completion items.
 */

import type { JSdoc } from "../shared/jsdoc";
import { formatSignature, type SignatureParam } from "../shared/signature-format";

/**
 * Convert JSDoc to markdown documentation (Fallout SSL format).
 * Produces a headerless 2-column table for args and a Returns line.
 */
export function jsdocToMarkdown(jsd: JSdoc): string {
    let md = "\n---\n";

    if (jsd.desc) {
        md += `\n${jsd.desc}`;
    }

    if (jsd.args.length > 0) {
        md += formatArgs(jsd.args);
    }

    if (jsd.ret?.description) {
        md += `\n\n**Returns** ${jsd.ret.description}`;
    }

    md += formatDeprecated(jsd.deprecated);

    return md;
}

/**
 * Fallout format: headerless 2-column table with name and description.
 * Type and default values are shown in the signature, not here.
 */
function formatArgs(args: JSdoc["args"]): string {
    const described = args.filter((a) => a.description);
    if (described.length === 0) {
        return "";
    }

    let md = "\n\n|||\n|:-|:-|";
    for (const arg of described) {
        md += `\n|\`${arg.name}\`|&nbsp;&nbsp;${arg.description}|`;
    }
    return md;
}

/** Format deprecation notice. */
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
    let prefix = "";
    if (jsd.ret) {
        prefix = `${jsd.ret.type} `;
    } else if (tokenType === "proc") {
        prefix = "void ";
    }

    const params: SignatureParam[] = jsd.args.map(({ type, name }) => ({
        name,
        type,
    }));

    return formatSignature({ name: label, prefix, params });
}
