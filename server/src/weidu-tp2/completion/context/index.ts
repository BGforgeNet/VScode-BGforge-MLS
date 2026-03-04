/**
 * Barrel module for TP2 completion context detection.
 * Re-exports the two public APIs: getContextAtPosition and getFuncParamsContext.
 *
 * Context detection uses tree-sitter to parse the document and walk the AST
 * from the cursor position upward, with a text-based fallback for incomplete
 * function/macro calls that tree-sitter cannot parse.
 */

import type { Position } from "vscode-languageserver/node";
import { SyntaxType } from "../../tree-sitter.d";
import { getUtf8ByteOffset } from "../../../shared/completion-context";
import { getLinePrefix } from "../../../common";
import { getParser, isInitialized } from "../../parser";
import { CompletionContext } from "../types";
import { ASSIGNMENT_SITE_PATTERN, DEFINITION_SITE_PATTERN, FUNC_CALL_KEYWORDS } from "./constants";
import { getDefaultContext } from "./position";
import { detectContextFromNode } from "./detectors";

export { getFuncParamsContext } from "./function-call";

/**
 * Result of declaration site detection.
 * - "assignment": cursor is on a variable name after SET/SPRINT - show local variable completions
 * - "definition": cursor is on a name after DEFINE_* / FOR_EACH / etc - suppress all completions
 * - false: not a declaration site - normal completions
 */
export type DeclarationSiteResult = "assignment" | "definition" | false;

/**
 * Check if the cursor is at a declaration site where the user is naming a new symbol.
 * Returns "assignment" for variable SET/SPRINT sites, "definition" for function/macro/array/loop
 * definition sites, or false if not at a declaration site.
 */
export function isAtDeclarationSite(text: string, position: Position): DeclarationSiteResult {
    const prefix = getLinePrefix(text, position);
    if (ASSIGNMENT_SITE_PATTERN.test(prefix)) {
        return "assignment";
    }
    if (DEFINITION_SITE_PATTERN.test(prefix)) {
        return "definition";
    }
    return false;
}

/**
 * Text-based fallback for detecting lafName/lpfName/lamName/lpmName context.
 * Used when tree-sitter can't parse incomplete function/macro calls.
 * Returns the context or null if not at a function/macro name position.
 */
function detectFuncNameFromLineText(text: string, line: number, character: number): CompletionContext | null {
    // Get the current line text up to cursor
    const lines = text.split("\n");
    if (line >= lines.length) return null;
    const currentLine = lines[line];
    if (!currentLine) return null;
    const lineText = currentLine.substring(0, character);

    const match = lineText.match(FUNC_CALL_KEYWORDS);
    if (!match || !match[1]) return null;

    const keyword = match[1].toUpperCase();
    switch (keyword) {
        case "LAF":
        case "LAUNCH_ACTION_FUNCTION":
            return CompletionContext.LafName;
        case "LPF":
        case "LAUNCH_PATCH_FUNCTION":
            return CompletionContext.LpfName;
        case "LAM":
        case "LAUNCH_ACTION_MACRO":
            return CompletionContext.LamName;
        case "LPM":
        case "LAUNCH_PATCH_MACRO":
            return CompletionContext.LpmName;
        default:
            return null;
    }
}

/**
 * Determine the completion context at a given position.
 * Uses tree-sitter to parse the text and walk up from cursor position.
 *
 * Returns an array of contexts because multiple contexts can be active simultaneously
 * (e.g., after BEGIN with no actions, both componentFlag and action are valid).
 *
 * @param text Document text
 * @param line 0-based line number
 * @param character 0-based character offset
 * @param fileExtension File extension (e.g., ".tp2", ".tpa", ".tpp")
 * @returns Array of detected contexts, or [CompletionContext.Unknown] if detection fails
 */
export function getContextAtPosition(
    text: string,
    line: number,
    character: number,
    fileExtension: string
): CompletionContext[] {
    // Fallback based on file extension
    const extLower = fileExtension.toLowerCase();
    const defaultContext = getDefaultContext(extLower);

    if (!isInitialized()) {
        return [defaultContext];
    }

    const parser = getParser();
    const tree = parser.parse(text);
    if (!tree) {
        return [defaultContext];
    }

    // Compute cursor byte offset from line/character (UTF-8 safe)
    const cursorOffset = getUtf8ByteOffset(text, line, character);

    // Find node at cursor position
    const node = tree.rootNode.descendantForPosition({ row: line, column: character });
    if (!node) {
        return [defaultContext];
    }

    // No code completions inside comments; offer JSDoc tags inside /** */ comments
    if (node.type === SyntaxType.Comment) {
        const commentText = node.text.trimStart();
        if (commentText.startsWith("/**")) {
            return [CompletionContext.Jsdoc];
        }
        return [CompletionContext.Comment];
    }
    if (node.type === SyntaxType.LineComment) {
        return [CompletionContext.Comment];
    }

    // Walk up the tree to find context-defining ancestor
    const contexts = detectContextFromNode(node, extLower, cursorOffset);

    // Text-based fallback: detect lafName/lpfName for incomplete function calls
    // When tree-sitter can't parse incomplete function calls, it may return various generic
    // contexts depending on file type and position. Check for function call keywords in line text.
    // Only override when we're reasonably sure tree-sitter missed the function call
    // (single generic context that allows function calls).
    const canHaveFunctionCalls = contexts.length === 1 && (
        contexts[0] === CompletionContext.Patch ||
        contexts[0] === CompletionContext.Action ||
        contexts[0] === CompletionContext.PatchKeyword ||
        contexts[0] === CompletionContext.ActionKeyword ||
        contexts[0] === CompletionContext.Flag  // Top-level .tp2 with incomplete structure
    );

    if (canHaveFunctionCalls) {
        const funcNameContext = detectFuncNameFromLineText(text, line, character);
        if (funcNameContext !== null) {
            return [funcNameContext];
        }
    }

    return contexts;
}
