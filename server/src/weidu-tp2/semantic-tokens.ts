/**
 * Semantic token extraction for WeiDU TP2 files.
 * Highlights function parameter references (INT_VAR, STR_VAR, RET, RET_ARRAY) in function bodies,
 * and loop variable references (PHP_EACH key/value, FOR_EACH var) in loop bodies.
 *
 * Unlike SSL (which resolves each identifier via the go-to-definition chain),
 * TP2 uses collect-then-scan: parameter and loop variable names are gathered
 * into a set per scope, then the body is scanned for matching identifiers
 * and %var% references in string content. This is because TP2 lacks a unified
 * symbol resolution chain — variable, callable, and parameter resolution are
 * separate subsystems. The set-based approach avoids coupling to any one of them.
 */

import { SemanticTokenTypes } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { isInitialized, parseWithCache } from "./parser";
import { SyntaxType } from "./tree-sitter.d";
import { collectLoopVarNames, FUNCTION_DEF_TYPES, LOOP_TYPES, PARAM_DECL_TYPES, STRING_CONTENT_TYPES } from "./variable-symbols";
import type { SemanticTokenSpan } from "../shared/semantic-tokens";

/**
 * Collect parameter names declared in a function definition node.
 * Parameter names appear as Identifier children of INT_VAR/STR_VAR/RET/RET_ARRAY decl nodes.
 */
function collectParamNames(functionNode: Node): ReadonlySet<string> {
    const names = new Set<string>();

    for (const child of functionNode.children) {
        if (!PARAM_DECL_TYPES.has(child.type as SyntaxType)) {
            continue;
        }
        for (const declChild of child.children) {
            if (declChild.type === SyntaxType.Identifier) {
                names.add(declChild.text);
            }
        }
    }

    return names;
}

/**
 * Check whether a node is inside a parameter declaration (not in the body).
 * Parameter declarations appear before "BEGIN" in the function definition.
 */
function isInsideParamDecl(node: Node): boolean {
    let current = node.parent;
    while (current) {
        if (PARAM_DECL_TYPES.has(current.type as SyntaxType)) {
            return true;
        }
        if (FUNCTION_DEF_TYPES.has(current.type as SyntaxType)) {
            return false;
        }
        current = current.parent;
    }
    return false;
}

function pushSpan(node: Node, tokenType: string, out: SemanticTokenSpan[]): void {
    out.push({
        line: node.startPosition.row,
        startChar: node.startPosition.column,
        length: node.endPosition.column - node.startPosition.column,
        tokenType,
        tokenModifiers: 0,
    });
}

function pushRawSpan(line: number, startChar: number, length: number, tokenType: string, out: SemanticTokenSpan[]): void {
    out.push({
        line,
        startChar,
        length,
        tokenType,
        tokenModifiers: 0,
    });
}

/**
 * Scan string content (tilde_content, double_content, five_tilde_content) for %var% references
 * matching known names. These are raw text nodes — the grammar does not parse %var% inside strings.
 */
function scanStringContentForNames(
    node: Node,
    names: ReadonlySet<string>,
    tokenType: string,
    out: SemanticTokenSpan[],
): void {
    const text = node.text;
    const varPattern = /%([a-zA-Z_][a-zA-Z0-9_]*)%/g;
    let match: RegExpExecArray | null;

    while ((match = varPattern.exec(text)) !== null) {
        const varName = match[1]!;
        if (!names.has(varName)) {
            continue;
        }

        // Calculate position of the variable name (between the % delimiters)
        const nameOffset = match.index + 1; // skip leading %
        const baseRow = node.startPosition.row;
        const baseCol = node.startPosition.column;

        // Convert text offset to row/col, accounting for multiline strings
        let row = baseRow;
        let col = baseCol;
        for (let i = 0; i < nameOffset; i++) {
            if (text[i] === "\n") {
                row++;
                col = 0;
            } else {
                col++;
            }
        }

        pushRawSpan(row, col, varName.length, tokenType, out);
    }
}

/**
 * Scan a subtree for references to named variables, emitting spans with the given token type.
 * When skipParamDecls is true, skips identifiers inside parameter declarations (for function params).
 */
function visitBodyForNames(
    node: Node,
    names: ReadonlySet<string>,
    tokenType: string,
    out: SemanticTokenSpan[],
    skipParamDecls: boolean,
): void {
    if (node.type === SyntaxType.Identifier && names.has(node.text)) {
        if (!skipParamDecls || !isInsideParamDecl(node)) {
            pushSpan(node, tokenType, out);
        }
        return;
    }

    if (node.type === SyntaxType.PercentString) {
        // Grammar: percent_string = "%" percent_content "%", child(1) is the content
        const contentNode = node.child(1);
        if (contentNode && contentNode.type === SyntaxType.PercentContent && names.has(contentNode.text)) {
            pushSpan(contentNode, tokenType, out);
        }
        return;
    }

    // String content nodes contain raw text with %var% references that the grammar doesn't parse
    if (STRING_CONTENT_TYPES.has(node.type as SyntaxType)) {
        scanStringContentForNames(node, names, tokenType, out);
        return;
    }

    for (const child of node.children) {
        visitBodyForNames(child, names, tokenType, out, skipParamDecls);
    }
}

/**
 * Walk the tree collecting semantic token spans.
 * Handles function definitions (parameter refs) and loop constructs (loop variable refs).
 */
function visit(node: Node, out: SemanticTokenSpan[]): void {
    if (FUNCTION_DEF_TYPES.has(node.type as SyntaxType)) {
        const paramNames = collectParamNames(node);
        if (paramNames.size > 0) {
            visitBodyForNames(node, paramNames, SemanticTokenTypes.parameter, out, true);
        }
        // Still recurse into function body for loop variables
        for (const child of node.children) {
            visit(child, out);
        }
        return;
    }

    if (LOOP_TYPES.has(node.type as SyntaxType)) {
        const loopVarNames = collectLoopVarNames(node);
        if (loopVarNames.size > 0) {
            visitBodyForNames(node, loopVarNames, SemanticTokenTypes.variable, out, false);
        }
        // Recurse for nested loops
        for (const child of node.children) {
            visit(child, out);
        }
        return;
    }

    for (const child of node.children) {
        visit(child, out);
    }
}

export function getSemanticTokenSpans(text: string): SemanticTokenSpan[] {
    if (!isInitialized()) {
        return [];
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return [];
    }

    const spans: SemanticTokenSpan[] = [];
    visit(tree.rootNode, spans);
    return spans;
}
