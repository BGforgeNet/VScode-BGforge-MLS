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

/** WeiDU token types for formatting. */
export enum WeiduTokenType {
    Code,
    String,
    Comment,
}

/** WeiDU token for formatting. */
export interface WeiduToken {
    type: WeiduTokenType;
    text: string;
}

/**
 * Tokenize WeiDU text into code and literals (strings, comments).
 * Handles: ~string~, "string", %string%, ~~~~~string~~~~~, /* comments * /, // comments.
 */
export function tokenizeWeidu(text: string): WeiduToken[] {
    const tokens: WeiduToken[] = [];
    let i = 0;
    let lastCodeStart = 0;

    const flushCode = (end: number) => {
        if (end > lastCodeStart) {
            tokens.push({
                type: WeiduTokenType.Code,
                text: text.slice(lastCodeStart, end),
            });
        }
    };

    while (i < text.length) {
        // Tilde strings: WeiDU uses 1 tilde or 5 tildes as delimiters
        if (text[i] === "~") {
            const start = i;
            let tildeCount = 0;
            while (i < text.length && text[i] === "~") {
                tildeCount++;
                i++;
            }
            const delimiterCount = tildeCount >= 5 ? 5 : 1;
            i = start + delimiterCount;
            const closer = "~".repeat(delimiterCount);
            const end = text.indexOf(closer, i);
            if (end !== -1) {
                flushCode(start);
                tokens.push({
                    type: WeiduTokenType.String,
                    text: text.slice(start, end + delimiterCount),
                });
                i = end + delimiterCount;
                lastCodeStart = i;
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
            if (i < text.length) i++; // consume closing quote
            flushCode(start);
            tokens.push({
                type: WeiduTokenType.String,
                text: text.slice(start, i),
            });
            lastCodeStart = i;
            continue;
        }
        // Percent strings/variables
        if (text[i] === "%") {
            const start = i++;
            const end = text.indexOf("%", i);
            if (end !== -1) {
                flushCode(start);
                tokens.push({
                    type: WeiduTokenType.String,
                    text: text.slice(start, end + 1),
                });
                i = end + 1;
                lastCodeStart = i;
            }
            continue;
        }
        // Block comments
        if (text[i] === "/" && text[i + 1] === "*") {
            const start = i;
            const end = text.indexOf("*/", i + 2);
            i = end !== -1 ? end + 2 : text.length;
            flushCode(start);
            tokens.push({
                type: WeiduTokenType.Comment,
                text: text.slice(start, i),
            });
            lastCodeStart = i;
            continue;
        }
        // Line comments
        if (text[i] === "/" && text[i + 1] === "/") {
            const start = i;
            while (i < text.length && text[i] !== "\n") i++;
            flushCode(start);
            tokens.push({
                type: WeiduTokenType.Comment,
                text: text.slice(start, i),
            });
            lastCodeStart = i;
            continue;
        }
        i++;
    }
    flushCode(text.length);
    return tokens;
}

/**
 * Normalizes whitespace in WeiDU text while preserving strings and comments.
 * Collapses multiple spaces into one, trims outer whitespace.
 *
 * Important: line-based formatters must never split string/comment tokens by newlines.
 */
export function normalizeWhitespaceWeidu(text: string): string {
    const tokens = tokenizeWeidu(text);
    const parts: string[] = [];

    for (const token of tokens) {
        if (token.type === WeiduTokenType.Code) {
            // Collapse whitespace in code parts
            const normalized = token.text.replace(/\s+/g, " ");
            parts.push(normalized);
        } else {
            // Preserve strings and comments exactly
            parts.push(token.text);
        }
    }

    // Join parts directly (no separator) — whitespace is already in Code tokens
    return parts.join("").trim();
}

/**
 * Strip comments from WeiDU text, respecting string literals.
 * Handles: ~string~, "string", %string%, ~~~~~string~~~~~
 */
export function stripCommentsWeidu(text: string): string {
    return tokenizeWeidu(text)
        .filter((t) => t.type !== WeiduTokenType.Comment)
        .map((t) => t.text)
        .join("");
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
