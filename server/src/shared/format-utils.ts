/**
 * Shared formatting utilities.
 */

import { TextEdit } from "vscode-languageserver/node";

/** Function that strips comments from text while respecting string literals. */
export type CommentStripper = (text: string) => string;

/**
 * Creates a TextEdit that replaces the entire document.
 */
export function createFullDocumentEdit(originalText: string, newText: string): TextEdit[] {
    const lines = originalText.split("\n");
    const lastLine = lines[lines.length - 1] ?? "";

    return [TextEdit.replace({
        start: { line: 0, character: 0 },
        end: { line: lines.length - 1, character: lastLine.length },
    }, newText)];
}

/**
 * Strip comments from WeiDU text, respecting string literals.
 * Handles: ~string~, "string", ~~~~~string~~~~~
 */
export function stripCommentsWeidu(text: string): string {
    let result = "";
    let i = 0;
    while (i < text.length) {
        // Tilde strings: WeiDU uses 1 tilde or 5 tildes as delimiters
        // ~content~ or ~~~~~content~~~~~
        if (text[i] === "~") {
            const start = i;
            let tildeCount = 0;
            while (i < text.length && text[i] === "~") {
                tildeCount++;
                i++;
            }
            // WeiDU only recognizes 1 or 5 tildes as delimiters
            // If we see ~~, it's ~~ = ~ + empty + ~ (two single-tilde strings)
            // If we see ~~~, it's ~ + ~ + ~ (single tilde delimiters)
            // Only 5+ consecutive tildes use multi-tilde mode
            const delimiterCount = tildeCount >= 5 ? 5 : 1;
            // Rewind: we consumed all tildes but may need to re-parse some
            i = start + delimiterCount;
            result += text.slice(start, i);
            // Find matching closing tildes
            const closer = "~".repeat(delimiterCount);
            const end = text.indexOf(closer, i);
            if (end !== -1) {
                result += text.slice(i, end + delimiterCount);
                i = end + delimiterCount;
            }
            continue;
        }
        // Double-quoted strings
        if (text[i] === '"') {
            const start = i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === "\\") i++; // Skip escaped char
                i++;
            }
            result += text.slice(start, ++i);
            continue;
        }
        // Block comments
        if (text[i] === "/" && text[i + 1] === "*") {
            const end = text.indexOf("*/", i + 2);
            i = end !== -1 ? end + 2 : text.length;
            continue;
        }
        // Line comments
        if (text[i] === "/" && text[i + 1] === "/") {
            while (i < text.length && text[i] !== "\n") i++;
            continue;
        }
        result += text[i++];
    }
    return result;
}

/**
 * Strip comments from Fallout SSL text, respecting string literals.
 * Handles: "string" only
 */
export function stripCommentsFalloutSsl(text: string): string {
    let result = "";
    let i = 0;
    while (i < text.length) {
        // Double-quoted strings
        if (text[i] === '"') {
            const start = i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === "\\") i++; // Skip escaped char
                i++;
            }
            result += text.slice(start, ++i);
            continue;
        }
        // Block comments
        if (text[i] === "/" && text[i + 1] === "*") {
            const end = text.indexOf("*/", i + 2);
            i = end !== -1 ? end + 2 : text.length;
            continue;
        }
        // Line comments
        if (text[i] === "/" && text[i + 1] === "/") {
            while (i < text.length && text[i] !== "\n") i++;
            continue;
        }
        result += text[i++];
    }
    return result;
}

/**
 * Validate that formatting only changed whitespace, not content.
 * Returns error message if content changed, null if OK.
 * @param stripComments Language-specific function to strip comments while respecting strings
 */
export function validateFormatting(
    original: string,
    formatted: string,
    stripComments: CommentStripper
): string | null {
    const normalize = (text: string) => stripComments(text).replace(/\s+/g, "");
    const normalizedOriginal = normalize(original);
    const normalizedFormatted = normalize(formatted);

    if (normalizedOriginal !== normalizedFormatted) {
        // Find first difference for debugging
        const minLen = Math.min(normalizedOriginal.length, normalizedFormatted.length);
        let diffPos = 0;
        while (diffPos < minLen && normalizedOriginal[diffPos] === normalizedFormatted[diffPos]) {
            diffPos++;
        }
        const context = 20;
        const origSnippet = normalizedOriginal.slice(Math.max(0, diffPos - context), diffPos + context);
        const fmtSnippet = normalizedFormatted.slice(Math.max(0, diffPos - context), diffPos + context);
        return `Formatter changed content at position ${diffPos}: "${origSnippet}" vs "${fmtSnippet}"`;
    }
    return null;
}
