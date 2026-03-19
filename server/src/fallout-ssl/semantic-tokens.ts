import { SemanticTokenTypes } from "vscode-languageserver/node";
import type { Node } from "web-tree-sitter";
import { parseMacroParams } from "./macro-utils";
import { isInitialized, parseWithCache } from "./parser";
import { SyntaxType } from "./tree-sitter.d";
import type { SemanticTokenSpan } from "../shared/semantic-tokens";

function pushIdentifierSpan(node: Node, out: SemanticTokenSpan[]): void {
    if (node.type !== SyntaxType.Identifier) {
        return;
    }
    out.push({
        line: node.startPosition.row,
        startChar: node.startPosition.column,
        length: node.endPosition.column - node.startPosition.column,
        tokenType: SemanticTokenTypes.parameter,
        tokenModifiers: 0,
    });
}

function visitProcedureBody(node: Node, paramNames: ReadonlySet<string>, out: SemanticTokenSpan[]): void {
    if (node.type === SyntaxType.Identifier && paramNames.has(node.text)) {
        pushIdentifierSpan(node, out);
    }

    for (const child of node.children) {
        visitProcedureBody(child, paramNames, out);
    }
}

function collectProcedureParameterReferences(procedureNode: Node, out: SemanticTokenSpan[]): void {
    const paramsNode = procedureNode.childForFieldName("params");
    const nameNode = procedureNode.childForFieldName("name");
    if (!paramsNode) {
        return;
    }

    const paramNames = new Set<string>();
    for (const child of paramsNode.children) {
        if (child.type !== SyntaxType.Param) {
            continue;
        }
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
            paramNames.add(nameNode.text);
        }
    }
    if (paramNames.size === 0) {
        return;
    }

    for (const child of procedureNode.children) {
        if (child.type === SyntaxType.ParamList) {
            continue;
        }
        if (nameNode && child.type === SyntaxType.Identifier && child.startIndex === nameNode.startIndex && child.endIndex === nameNode.endIndex) {
            continue;
        }
        visitProcedureBody(child, paramNames, out);
    }
}

function collectMacroParameterReferences(defineNode: Node, out: SemanticTokenSpan[]): void {
    const paramsNode = defineNode.childForFieldName("params");
    const bodyNode = defineNode.childForFieldName("body");
    if (!paramsNode || !bodyNode) {
        return;
    }

    const paramNames = new Set(parseMacroParams(paramsNode.text));
    if (paramNames.size === 0) {
        return;
    }

    visitProcedureBody(bodyNode, paramNames, out);
}

function visit(node: Node, out: SemanticTokenSpan[]): void {
    if (node.type === SyntaxType.Procedure) {
        collectProcedureParameterReferences(node, out);
        return;
    }

    if (node.type === SyntaxType.Define) {
        collectMacroParameterReferences(node, out);
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
