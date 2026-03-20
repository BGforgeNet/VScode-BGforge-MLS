/**
 * Semantic token extraction for WeiDU TP2 files.
 * Highlights function parameter references (INT_VAR, STR_VAR, RET, RET_ARRAY) in function bodies.
 */

import { SemanticTokenTypes } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { isInitialized, parseWithCache } from "./parser";
import { SyntaxType } from "./tree-sitter.d";
import { FUNCTION_DEF_TYPES, STRING_CONTENT_TYPES } from "./variable-symbols";
import type { SemanticTokenSpan } from "../shared/semantic-tokens";

/** Node types for function parameter declarations. */
const PARAM_DECL_TYPES: ReadonlySet<SyntaxType> = new Set([
    SyntaxType.IntVarDecl,
    SyntaxType.StrVarDecl,
    SyntaxType.RetDecl,
    SyntaxType.RetArrayDecl,
]);

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

function pushSpan(node: Node, out: SemanticTokenSpan[]): void {
    out.push({
        line: node.startPosition.row,
        startChar: node.startPosition.column,
        length: node.endPosition.column - node.startPosition.column,
        tokenType: SemanticTokenTypes.parameter,
        tokenModifiers: 0,
    });
}

function pushRawSpan(line: number, startChar: number, length: number, out: SemanticTokenSpan[]): void {
    out.push({
        line,
        startChar,
        length,
        tokenType: SemanticTokenTypes.parameter,
        tokenModifiers: 0,
    });
}

/**
 * Scan string content (tilde_content, double_content, five_tilde_content) for %var% references
 * matching parameter names. These are raw text nodes — the grammar does not parse %var% inside strings.
 */
function scanStringContentForParams(node: Node, paramNames: ReadonlySet<string>, out: SemanticTokenSpan[]): void {
    const text = node.text;
    const varPattern = /%([a-zA-Z_][a-zA-Z0-9_]*)%/g;
    let match: RegExpExecArray | null;

    while ((match = varPattern.exec(text)) !== null) {
        const varName = match[1]!;
        if (!paramNames.has(varName)) {
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

        pushRawSpan(row, col, varName.length, out);
    }
}

/**
 * Scan a function body for references to parameter names.
 * Handles both bare identifiers (e.g. `count` in `SET x = count`)
 * and percent_string references (e.g. `%name%` in string content).
 */
function visitFunctionBody(node: Node, paramNames: ReadonlySet<string>, out: SemanticTokenSpan[]): void {
    if (node.type === SyntaxType.Identifier && paramNames.has(node.text)) {
        if (!isInsideParamDecl(node)) {
            pushSpan(node, out);
        }
        return;
    }

    if (node.type === SyntaxType.PercentString) {
        // Grammar: percent_string = "%" percent_content "%", child(1) is the content
        const contentNode = node.child(1);
        if (contentNode && contentNode.type === SyntaxType.PercentContent && paramNames.has(contentNode.text)) {
            pushSpan(contentNode, out);
        }
        return;
    }

    // String content nodes contain raw text with %var% references that the grammar doesn't parse
    if (STRING_CONTENT_TYPES.has(node.type as SyntaxType)) {
        scanStringContentForParams(node, paramNames, out);
        return;
    }

    for (const child of node.children) {
        visitFunctionBody(child, paramNames, out);
    }
}

/**
 * Walk the top-level tree looking for function definitions,
 * then collect parameter reference spans from each function body.
 */
function visit(node: Node, out: SemanticTokenSpan[]): void {
    if (FUNCTION_DEF_TYPES.has(node.type as SyntaxType)) {
        const paramNames = collectParamNames(node);
        if (paramNames.size > 0) {
            visitFunctionBody(node, paramNames, out);
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
