/**
 * Shared utilities for macro handling.
 * Used by both header-parser.ts (regex-based) and tree-sitter-based features.
 */

import { CompletionItem, CompletionItemKind, ParameterInformation } from "vscode-languageserver/node";
import { MarkupKind } from "vscode-languageserver/node";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToDetail, jsdocToMarkdown } from "../shared/jsdoc-utils";
import * as signature from "../shared/signature";
import { LANG_FALLOUT_SSL_TOOLTIP } from "../core/languages";

const tooltipLangId = LANG_FALLOUT_SSL_TOOLTIP;

/**
 * Check if macro name looks like a constant (all uppercase).
 * Examples: MAX_VALUE, LEFT_HAND, HOOK_GAMEMODECHANGE
 */
export function isConstantMacro(name: string): boolean {
    return /^[A-Z][A-Z0-9_]+$/.test(name);
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
        let doc = ["```" + `${tooltipLangId}`, `${arg.type} ${arg.name}`, "```"].join("\n");
        if (arg.description) {
            doc += "\n";
            doc += arg.description;
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

    let detail: string;
    if (macro.jsdoc) {
        detail = jsdocToDetail(macro.name, macro.jsdoc, "macro");
    } else if (isConstant && macro.firstline) {
        detail = macro.firstline;
    } else if (macro.hasParams) {
        detail = `macro ${macro.name}(${macro.params!.join(", ")})`;
    } else {
        detail = `macro ${macro.name}`;
    }

    // Build markdown hover content
    let markdownValue = [
        "```" + `${tooltipLangId}`,
        `${detail}`,
        "```",
        "\n```bgforge-mls-comment\n",
        `${filePath}`,
        "```",
    ].join("\n");

    // For non-constant macros (with or without params), show body on second line if not already in detail
    if (!isConstant && !macro.multiline && macro.firstline && !macro.jsdoc) {
        markdownValue += ["\n```" + `${tooltipLangId}`, `${macro.firstline}`, "```"].join("\n");
    }

    if (macro.jsdoc) {
        markdownValue += jsdocToMarkdown(macro.jsdoc, "fallout");
    }

    const kind = isConstant
        ? CompletionItemKind.Constant
        : CompletionItemKind.Field;  // No good icon for function-like macros

    const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };

    const item: CompletionItem = {
        label: macro.name,
        kind,
        detail,
        documentation: markdownContents,
        labelDetails: { description: filePath },
    };

    if (macro.jsdoc?.deprecated !== undefined) {
        const COMPLETION_TAG_deprecated = 1;
        item.tags = [COMPLETION_TAG_deprecated];
    }

    return item;
}

/**
 * Build hover content for a macro.
 */
export function buildMacroHover(
    macro: MacroData,
    filePath: string
): { kind: typeof MarkupKind.Markdown; value: string } {
    const isConstant = !macro.hasParams && isConstantMacro(macro.name);

    let detail: string;
    if (macro.jsdoc) {
        detail = jsdocToDetail(macro.name, macro.jsdoc, "macro");
    } else if (isConstant && macro.firstline) {
        detail = macro.firstline;
    } else if (macro.hasParams) {
        detail = `macro ${macro.name}(${macro.params!.join(", ")})`;
    } else {
        detail = `macro ${macro.name}`;
    }

    let markdownValue = [
        "```" + `${tooltipLangId}`,
        `${detail}`,
        "```",
        "\n```bgforge-mls-comment\n",
        `${filePath}`,
        "```",
    ].join("\n");

    // For non-constant macros, show body on second line if not already in detail
    if (!isConstant && !macro.multiline && macro.firstline && !macro.jsdoc) {
        markdownValue += ["\n```" + `${tooltipLangId}`, `${macro.firstline}`, "```"].join("\n");
    }

    if (macro.jsdoc) {
        markdownValue += jsdocToMarkdown(macro.jsdoc, "fallout");
    }

    return { kind: MarkupKind.Markdown, value: markdownValue };
}
