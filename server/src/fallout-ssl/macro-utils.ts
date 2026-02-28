/**
 * Shared utilities for macro handling.
 * Used by both header-parser.ts (regex-based) and tree-sitter-based features.
 */

import { CompletionItem, CompletionItemKind, ParameterInformation } from "vscode-languageserver/node";
import { MarkupKind } from "vscode-languageserver/node";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToDetail } from "./jsdoc-format";
import { formatSignature } from "../shared/signature-format";
import * as signature from "../shared/signature";
import { LANG_FALLOUT_SSL_TOOLTIP } from "../core/languages";
import { buildSignatureBlock } from "../shared/tooltip-format";
import { buildTooltipBase } from "./utils";

/**
 * Check if macro name looks like a constant (all uppercase).
 * Examples: MAX_VALUE, LEFT_HAND, HOOK_GAMEMODECHANGE
 */
export function isConstantMacro(name: string): boolean {
    return /^[A-Z][A-Z0-9_]+$/.test(name);
}

/**
 * Check if a value is a simple numeric constant.
 * Matches: 123, (123), -123, (-123), 0x1F, (0x1F)
 * Strips inline comments before checking.
 */
function isNumericValue(value: string): boolean {
    // Strip inline comment (// or /* */)
    const stripped = value.replace(/\/\/.*$/, "").replace(/\/\*.*\*\//, "").trim();
    return /^\(?-?(?:0x[0-9a-fA-F]+|\d+)\)?$/.test(stripped);
}

/**
 * Parse macro parameters from string.
 * Input: "msg" or "critter, slot" or "(msg)" or "(critter, slot)"
 * Output: ["msg"] or ["critter", "slot"]
 */
export function parseMacroParams(params: string): string[] {
    // Remove parentheses if present
    const cleaned = params.replace(/^\(|\)$/g, "").trim();
    if (!cleaned) return [];

    return cleaned.split(",").map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Macro data interface (used by both header-parser and tree-sitter).
 */
export interface MacroData {
    name: string;
    params?: string[];       // ["msg"] or ["critter", "slot"] or undefined
    hasParams: boolean;
    body?: string;           // Macro body text (if available)
    firstline?: string;      // First line of body (for display)
    multiline?: boolean;     // Has line continuations
    jsdoc?: jsdoc.JSdoc;
    /** AST node for the define directive (for location extraction). Only present when extracted from tree-sitter. */
    node?: import("web-tree-sitter").Node;
}

/**
 * Build the signature/detail line for a macro.
 * Returns: value for numeric constants, signature for others.
 */
function buildMacroSignature(macro: MacroData): string {
    const isNumeric = !macro.hasParams && macro.firstline !== undefined && isNumericValue(macro.firstline);

    if (isNumeric) {
        // Numeric constants just show the value
        return macro.firstline!;
    } else if (macro.jsdoc) {
        // Use JSDoc for typed signature
        return jsdocToDetail(macro.name, macro.jsdoc, "macro");
    } else {
        // No JSDoc - build signature from params
        const params = macro.hasParams && macro.params
            ? macro.params.map(name => ({ name }))
            : [];
        return formatSignature({ name: macro.name, prefix: "macro ", params });
    }
}

/**
 * Build tooltip content for a macro.
 * Uses shared buildTooltipBase, then appends body for function-like macros without JSDoc.
 * Used by: hover (contents.value), completion (documentation.value).
 */
export function buildMacroTooltip(macro: MacroData, filePath: string): string {
    const sig = buildMacroSignature(macro);

    // If has JSDoc, use base tooltip (signature + path + jsdoc)
    if (macro.jsdoc) {
        return buildTooltipBase(sig, macro.jsdoc, filePath || undefined);
    }

    // No JSDoc - use base tooltip without jsdoc, then maybe append body
    let markdown = buildTooltipBase(sig, null, filePath || undefined);

    // For non-constant, non-numeric, non-multiline macros, show body as fallback
    const isConstant = !macro.hasParams && isConstantMacro(macro.name);
    const isNumeric = !macro.hasParams && macro.firstline !== undefined && isNumericValue(macro.firstline);
    if (!isConstant && !isNumeric && !macro.multiline && macro.firstline) {
        markdown += "\n" + buildSignatureBlock(macro.firstline, LANG_FALLOUT_SSL_TOOLTIP);
    }

    return markdown;
}

/**
 * Build signature help from JSDoc (works for procedures and macros).
 * Extracted from header-parser.ts jsdocToSig().
 */
export function buildSignatureFromJSDoc(
    label: string,
    jsd: jsdoc.JSdoc,
    uri: string
): signature.SigInfoEx {
    const argNames = jsd.args.map(item => item.name);
    const sigLabel = label + "(" + argNames.join(", ") + ")";

    const sig: signature.SigInfoEx = { label: sigLabel, uri: uri };

    if (jsd.desc) {
        sig.documentation = {
            kind: "markdown",
            value: "\n---\n" + jsd.desc,
        };
    }

    const parameters: ParameterInformation[] = [];
    for (const arg of jsd.args) {
        const info: ParameterInformation = { label: arg.name };
        let doc = buildSignatureBlock(`${arg.type} ${arg.name}`, LANG_FALLOUT_SSL_TOOLTIP);
        if (arg.description) {
            doc += "\n" + arg.description;
        }
        info.documentation = { kind: "markdown", value: doc };
        parameters.push(info);
    }
    sig.parameters = parameters;

    return sig;
}

/**
 * Build completion item for a macro.
 * Used by both header-parser (regex) and tree-sitter approaches.
 */
export function buildMacroCompletion(
    macro: MacroData,
    _uri: string,
    filePath: string
): CompletionItem {
    const isConstant = !macro.hasParams && isConstantMacro(macro.name);
    const markdownValue = buildMacroTooltip(macro, filePath);

    const kind = isConstant
        ? CompletionItemKind.Constant
        : CompletionItemKind.Field;  // No good icon for function-like macros

    const item: CompletionItem = {
        label: macro.name,
        kind,
        documentation: { kind: MarkupKind.Markdown, value: markdownValue },
    };

    if (filePath) {
        item.labelDetails = { description: filePath };
    }

    if (macro.jsdoc?.deprecated !== undefined) {
        const COMPLETION_TAG_deprecated = 1;
        item.tags = [COMPLETION_TAG_deprecated];
    }

    return item;
}
