/**
 * Shared formatting utilities.
 */

import { TextEdit } from "vscode-languageserver/node";

/**
 * Creates a TextEdit that replaces the entire document.
 */
export function createFullDocumentEdit(originalText: string, newText: string): TextEdit[] {
    const lines = originalText.split("\n");
    const lastLine = lines[lines.length - 1];

    return [TextEdit.replace({
        start: { line: 0, character: 0 },
        end: { line: lines.length - 1, character: lastLine.length },
    }, newText)];
}

/**
 * Strip comments from text (line and block comments).
 */
function stripComments(text: string): string {
    // Remove block comments first (they can span lines)
    let result = text.replace(/\/\*[\s\S]*?\*\//g, "");
    // Remove line comments
    result = result.replace(/\/\/[^\n]*/g, "");
    return result;
}

/**
 * Normalize text by stripping comments and all whitespace.
 * Used to verify formatter preserves content.
 */
function normalizeForComparison(text: string): string {
    return stripComments(text).replace(/\s+/g, "");
}

/**
 * Validate that formatting only changed whitespace, not content.
 * Returns error message if content changed, null if OK.
 */
export function validateFormatting(original: string, formatted: string): string | null {
    const normalizedOriginal = normalizeForComparison(original);
    const normalizedFormatted = normalizeForComparison(formatted);

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
