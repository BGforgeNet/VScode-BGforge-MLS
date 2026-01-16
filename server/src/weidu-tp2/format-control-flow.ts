/**
 * Control flow formatting: IF, FOR, MATCH, TRY, WHILE, array definitions.
 * Handles BEGIN...END patterns with proper indentation and condition splitting.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import {
    type FormatContext,
    type ConditionOperand,
    type CollectedItem,
    KW_BEGIN,
    KW_END,
    KW_ELSE,
    KW_THEN,
    KW_WITH,
    KW_DEFAULT,
    KW_IN,
    KW_FOR,
    KW_OUTER_FOR,
    KW_PATCH_IF,
    KW_ACTION_IF,
    KW_PATCH_TRY,
    KW_ACTION_TRY,
    addFormatError,
    NODE_PATCH_TRY,
    NODE_ACTION_TRY,
} from "./format-types";
import {
    isComment,
    isKeyword,
    isForEach,
    isAssociativeArrayDef,
    isBodyContent,
    normalizeComment,
    normalizeWhitespace,
    handleComment,
    tryAppendInlineComment,
    outputAlignedAssignments,
    outputHeaderLines,
    lastElement,
    isControlFlowBodyContent,
} from "./format-utils";

// ============================================
// Types
// ============================================

/** State for control flow formatting - tracks where we are in the structure. */
interface ControlFlowParseState {
    /** Accumulated output lines */
    lines: string[];
    /** Header parts being collected (before BEGIN) */
    headerParts: string[];
    /** Whether we're inside the body (after BEGIN) */
    inBody: boolean;
    /** Whether we just saw ELSE keyword */
    afterElse: boolean;
    /** Row number of last content (for inline comments) */
    lastContentRow: number;
    /** Row number of BEGIN (for inline comments on same line) */
    beginRow: number;
    /** Whether THEN keyword was seen (for IF statements) */
    hasThen: boolean;
    /** Condition node for IF statements (for special formatting) */
    conditionNode: SyntaxNode | null;
    /** Keyword for condition (ACTION_IF/PATCH_IF) */
    conditionKeyword: string;
}

function createControlFlowState(): ControlFlowParseState {
    return {
        lines: [],
        headerParts: [],
        inBody: false,
        afterElse: false,
        lastContentRow: -1,
        beginRow: -1,
        hasThen: false,
        conditionNode: null,
        conditionKeyword: "",
    };
}

// ============================================
// Condition formatting (OR/AND splitting)
// ============================================

/**
 * Flatten a binary_expr tree with OR/AND into a list of operands.
 * Returns null if the expression doesn't use OR/AND at top level.
 */
function flattenOrAndExpr(node: SyntaxNode): ConditionOperand[] | null {
    const op = node.childForFieldName("op");
    if (!op) return null;

    const opText = op.text;
    if (opText !== "OR" && opText !== "AND") {
        return null;
    }

    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    if (!left || !right) return null;

    const result: ConditionOperand[] = [];

    // Recursively flatten left side (for chained OR/AND)
    if (left.type === "binary_expr") {
        const leftFlat = flattenOrAndExpr(left);
        if (leftFlat) {
            result.push(...leftFlat);
        } else {
            result.push({ operator: null, text: normalizeWhitespace(left.text) });
        }
    } else {
        result.push({ operator: null, text: normalizeWhitespace(left.text) });
    }

    // Add right side with the operator
    result.push({ operator: op.text, text: normalizeWhitespace(right.text) });

    return result;
}

/**
 * Format a condition expression, splitting at OR/AND boundaries if too long.
 */
function formatCondition(
    conditionNode: SyntaxNode | null,
    prefix: string,
    indent: string,
    contIndent: string,
    lineLimit: number
): string[] {
    if (!conditionNode) {
        return [indent + prefix];
    }

    const condText = normalizeWhitespace(conditionNode.text);
    const fullLine = indent + prefix + " " + condText;

    if (fullLine.length <= lineLimit) {
        return [fullLine];
    }

    // Find the actual expression to split - may be wrapped in paren_expr
    let exprNode = conditionNode;
    let hasOuterParens = false;
    if (exprNode.type === "paren_expr" && exprNode.children.length > 0) {
        for (const child of exprNode.children) {
            if (child.type === "binary_expr") {
                exprNode = child;
                hasOuterParens = true;
                break;
            }
        }
    }

    // Try to flatten OR/AND expressions
    if (exprNode.type === "binary_expr") {
        const operands = flattenOrAndExpr(exprNode);
        if (operands && operands.length > 1) {
            const lines: string[] = [];
            const openParen = hasOuterParens ? "(" : "";
            const closeParen = hasOuterParens ? ")" : "";
            for (let i = 0; i < operands.length; i++) {
                const op = operands[i];
                if (!op) continue;
                if (i === 0) {
                    lines.push(indent + prefix + " " + openParen + op.text);
                } else if (i === operands.length - 1) {
                    lines.push(contIndent + op.operator + " " + op.text + closeParen);
                } else {
                    lines.push(contIndent + op.operator + " " + op.text);
                }
            }
            return lines;
        }
    }

    return [fullLine];
}

// ============================================
// FOR loop formatting
// ============================================

/** Format FOR loop header: FOR (init; condition; increment) */
function formatForLoopHeader(node: SyntaxNode): string | null {
    if (node.type !== "for_patch" && node.type !== "outer_for") {
        return null;
    }

    const parts: string[] = [];
    let inParens = false;
    const parenContent: string[] = [];

    for (const child of node.children) {
        if (child.text === KW_FOR || child.text === KW_OUTER_FOR) {
            parts.push(child.text);
            continue;
        }
        if (child.text === "(") {
            inParens = true;
            continue;
        }
        if (child.text === ")") {
            inParens = false;
            parts.push("(" + parenContent.join("; ") + ")");
            continue;
        }
        if (isKeyword(child, KW_BEGIN)) {
            break;
        }
        if (inParens) {
            if (child.text === ";") {
                continue;
            }
            if (!isComment(child)) {
                parenContent.push(normalizeWhitespace(child.text));
            }
        }
    }

    return parts.join(" ");
}

/** Format FOR loop with pre-formatted header. */
function formatForLoop(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    header: string,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [indent + header + " " + KW_BEGIN];
    let lastEndRow = -1;

    let inBody = false;
    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            inBody = true;
            continue;
        }
        if (isKeyword(child, KW_END)) {
            break;
        }
        if (!inBody) continue;

        if (isComment(child)) {
            handleComment(lines, child, bodyIndent, lastEndRow);
        } else if (isBodyContent(child.type)) {
            lines.push(formatNode(child, ctx, depth + 1));
            lastEndRow = child.endPosition.row;
        }
    }

    lines.push(indent + KW_END);
    return lines.join("\n");
}

// ============================================
// FOR_EACH formatting
// ============================================

/** Format FOR_EACH style loop. */
function formatForEach(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);

    // Collect header parts before BEGIN
    const headerParts: string[] = [];
    const itemsAfterIN: string[] = [];
    let seenIN = false;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            break;
        }
        if (isKeyword(child, KW_IN)) {
            seenIN = true;
            headerParts.push(KW_IN);
            continue;
        }
        if (isComment(child)) {
            continue;
        }
        if (seenIN) {
            itemsAfterIN.push(child.text);
        } else {
            headerParts.push(child.text);
        }
    }

    // Build header lines
    const headerLines: string[] = [];
    const allItemsLength = itemsAfterIN.join(" ").length;
    const headerLength = indent.length + headerParts.join(" ").length + 1 + allItemsLength;
    const oneItemPerLine = itemsAfterIN.length > 1 && headerLength > ctx.lineLimit;

    if (oneItemPerLine) {
        headerLines.push(indent + headerParts.join(" "));
        for (const item of itemsAfterIN) {
            headerLines.push(bodyIndent + item);
        }
        headerLines.push(indent + KW_BEGIN);
    } else {
        const fullHeader = headerParts.join(" ") + " " + itemsAfterIN.join(" ");
        headerLines.push(indent + fullHeader + " " + KW_BEGIN);
    }

    // Format body
    const bodyLines: string[] = [];
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            inBody = true;
            continue;
        }
        if (isKeyword(child, KW_END)) {
            break;
        }
        if (!inBody) continue;

        if (isComment(child)) {
            handleComment(bodyLines, child, bodyIndent, lastEndRow);
        } else if (isBodyContent(child.type)) {
            bodyLines.push(formatNode(child, ctx, depth + 1));
            lastEndRow = child.endPosition.row;
        }
    }

    return [...headerLines, ...bodyLines, indent + KW_END].join("\n");
}

// ============================================
// Associative array formatting
// ============================================

/** Parse associative array entry for alignment. */
function parseAssocEntry(node: SyntaxNode): { name: string; value: string } | null {
    let arrowIdx = -1;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child && child.text === "=>") {
            arrowIdx = i;
            break;
        }
    }

    if (arrowIdx < 0 || arrowIdx >= node.children.length - 1) {
        return null;
    }

    const keyParts: string[] = [];
    for (let i = 0; i < arrowIdx; i++) {
        const child = node.children[i];
        if (child) {
            keyParts.push(child.text);
        }
    }

    const valueParts: string[] = [];
    for (let i = arrowIdx + 1; i < node.children.length; i++) {
        const child = node.children[i];
        if (child) {
            valueParts.push(child.text);
        }
    }

    return {
        name: keyParts.join(" "),
        value: valueParts.join(" "),
    };
}

/** Format associative array with aligned => operators. */
function formatAssociativeArray(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    const headerParts: string[] = [];
    const items: CollectedItem[] = [];
    let inBody = false;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            lines.push(indent + headerParts.join(" ") + " " + KW_BEGIN);
            inBody = true;
            continue;
        }

        if (isKeyword(child, KW_END)) {
            break;
        }

        if (!inBody) {
            headerParts.push(child.text);
            continue;
        }

        if (isComment(child)) {
            items.push({ type: "comment", text: normalizeComment(child.text), startRow: child.startPosition.row, endRow: child.endPosition.row });
            continue;
        }

        if (child.type === "assoc_entry") {
            const parsed = parseAssocEntry(child);
            if (parsed) {
                items.push({ type: "assignment", name: parsed.name, value: parsed.value, endRow: child.endPosition.row });
            }
        }
    }

    const entryLines = outputAlignedAssignments(items, "", indent, bodyIndent, " => ");
    lines.push(...entryLines);
    lines.push(indent + KW_END);

    return lines.join("\n");
}

// ============================================
// Main control flow formatting
// ============================================

/** Output BEGIN and transition to body state. */
function outputBeginAndEnterBody(
    state: ControlFlowParseState,
    child: SyntaxNode,
    indent: string,
    contIndent: string,
    lineLimit: number
): void {
    // Handle ELSE BEGIN case
    if (state.afterElse && state.lines.length > 0) {
        const lastLine = lastElement(state.lines);
        if (lastLine && lastLine.trimEnd().endsWith(KW_ELSE)) {
            state.lines[state.lines.length - 1] = lastLine + " " + KW_BEGIN;
            state.headerParts = [];
            state.conditionNode = null;
            state.conditionKeyword = "";
            state.inBody = true;
            state.afterElse = false;
            return;
        }
    }
    state.afterElse = false;

    // Handle IF with condition
    if (state.conditionNode && state.conditionKeyword) {
        const condLines = formatCondition(state.conditionNode, state.conditionKeyword, indent, contIndent, lineLimit);
        state.lines.push(...condLines);
        const thenKeyword = state.hasThen ? KW_THEN + " " : "";
        if (condLines.length > 1) {
            state.lines.push(indent + thenKeyword + KW_BEGIN);
        } else {
            const lastIdx = state.lines.length - 1;
            if (lastIdx >= 0) {
                state.lines[lastIdx] += " " + thenKeyword + KW_BEGIN;
            }
        }
        state.headerParts = [];
        state.conditionNode = null;
        state.conditionKeyword = "";
        state.hasThen = false;
        state.inBody = true;
        state.beginRow = child.startPosition.row;
        return;
    }

    // Output collected header parts
    const hasMultipleLines = state.headerParts.some((p) => p.includes("//"));
    outputHeaderLines([state.headerParts], state.lines, indent, contIndent);

    const lastLine = lastElement(state.lines) ?? "";
    const endsWithComment = lastLine.includes("//");

    if (hasMultipleLines || state.headerParts.length === 0 || endsWithComment) {
        state.lines.push(indent + KW_BEGIN);
    } else {
        const lastIdx = state.lines.length - 1;
        if (lastIdx >= 0) {
            state.lines[lastIdx] += " " + KW_BEGIN;
        } else {
            state.lines.push(indent + KW_BEGIN);
        }
    }
    state.headerParts = [];
    state.inBody = true;
    state.beginRow = child.startPosition.row;
}

/** Handle comment in control flow context. */
function handleControlFlowComment(
    child: SyntaxNode,
    state: ControlFlowParseState,
    indent: string,
    bodyIndent: string
): void {
    if (state.inBody) {
        const rowToCheck = state.beginRow >= 0 ? state.beginRow : state.lastContentRow;
        if (tryAppendInlineComment(state.lines, child, rowToCheck)) {
            state.beginRow = -1;
            return;
        }
        state.lines.push(bodyIndent + normalizeComment(child.text));
        state.beginRow = -1;
    } else if (state.afterElse) {
        state.lines.push(indent + normalizeComment(child.text));
    } else {
        state.headerParts.push(normalizeComment(child.text));
    }
}

// ============================================
// TRY block formatting (no BEGIN keyword)
// ============================================

/**
 * Format TRY blocks (PATCH_TRY, ACTION_TRY).
 * Structure: KEYWORD <body> WITH [DEFAULT] <default_body> END
 * Note: TRY blocks have no BEGIN keyword - body starts immediately.
 */
function formatTryBlock(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];
    let lastEndRow = -1;

    for (const child of node.children) {
        // TRY keyword (PATCH_TRY or ACTION_TRY)
        if (child.text === KW_PATCH_TRY || child.text === KW_ACTION_TRY) {
            lines.push(indent + child.text);
            continue;
        }

        // WITH keyword - switch to default section
        if (isKeyword(child, KW_WITH)) {
            lines.push(indent + KW_WITH);
            continue;
        }

        // DEFAULT keyword
        if (isKeyword(child, KW_DEFAULT)) {
            // Append DEFAULT to WITH line if it's the last line
            const lastLine = lastElement(lines);
            if (lastLine && lastLine.trimEnd().endsWith(KW_WITH)) {
                lines[lines.length - 1] = lastLine + " " + KW_DEFAULT;
            } else {
                lines.push(indent + KW_DEFAULT);
            }
            continue;
        }

        // END keyword
        if (isKeyword(child, KW_END)) {
            lines.push(indent + KW_END);
            continue;
        }

        // Comments
        if (isComment(child)) {
            handleComment(lines, child, bodyIndent, lastEndRow);
            continue;
        }

        // Body content (both main body and default body)
        if (isBodyContent(child.type)) {
            lines.push(formatNode(child, ctx, depth + 1));
            lastEndRow = child.endPosition.row;
        }
    }

    return lines.join("\n");
}

/**
 * Format control flow constructs (IF, MATCH, TRY, FOR, WHILE, array definitions).
 */
export function formatControlFlow(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    // Report if control flow node has no children (malformed)
    if (node.children.length === 0) {
        addFormatError(ctx, `Empty control flow node '${node.type}'`, node.startPosition.row + 1, node.startPosition.column + 1);
    }
    // Handle FOR loops specially
    const forHeader = formatForLoopHeader(node);
    if (forHeader !== null) {
        return formatForLoop(node, ctx, depth, forHeader, formatNode);
    }

    // Handle FOR_EACH loops
    if (isForEach(node.type)) {
        return formatForEach(node, ctx, depth, formatNode);
    }

    // Handle associative arrays
    if (isAssociativeArrayDef(node.type)) {
        return formatAssociativeArray(node, ctx, depth);
    }

    // Handle TRY blocks (no BEGIN keyword - body starts immediately)
    if (node.type === NODE_PATCH_TRY || node.type === NODE_ACTION_TRY) {
        return formatTryBlock(node, ctx, depth, formatNode);
    }

    const indent = ctx.indent.repeat(depth);
    const contIndent = indent + ctx.indent;
    const bodyIndent = ctx.indent.repeat(depth + 1);

    const state = createControlFlowState();

    for (const child of node.children) {
        // BEGIN keyword
        if (isKeyword(child, KW_BEGIN)) {
            outputBeginAndEnterBody(state, child, indent, contIndent, ctx.lineLimit);
            continue;
        }

        // END keyword
        if (isKeyword(child, KW_END)) {
            state.inBody = false;
            state.lines.push(indent + KW_END);
            continue;
        }

        // ELSE keyword
        if (isKeyword(child, KW_ELSE)) {
            const lastLine = lastElement(state.lines);
            if (lastLine && lastLine.trimEnd().endsWith(KW_END)) {
                state.lines[state.lines.length - 1] = lastLine + " " + KW_ELSE;
            } else {
                state.lines.push(indent + KW_ELSE);
            }
            state.afterElse = true;
            continue;
        }

        // THEN keyword
        if (isKeyword(child, KW_THEN)) {
            state.hasThen = true;
            state.headerParts.push(KW_THEN);
            continue;
        }

        // WITH keyword (MATCH statements)
        if (isKeyword(child, KW_WITH)) {
            outputHeaderLines([state.headerParts], state.lines, indent, contIndent);
            state.headerParts = [];
            state.lines.push(indent + KW_WITH);
            state.inBody = true;
            continue;
        }

        // DEFAULT keyword
        if (isKeyword(child, KW_DEFAULT)) {
            state.lines.push(indent + KW_DEFAULT);
            continue;
        }

        // ELSE IF chaining
        if (state.afterElse && (child.type === "action_if" || child.type === "patch_if")) {
            state.lines.push(formatNode(child, ctx, depth));
            state.afterElse = false;
            continue;
        }

        // Comments
        if (isComment(child)) {
            handleControlFlowComment(child, state, indent, bodyIndent);
            continue;
        }

        // Body content
        if (state.inBody) {
            if (isControlFlowBodyContent(child.type)) {
                state.lines.push(formatNode(child, ctx, depth + 1));
                state.lastContentRow = child.endPosition.row;
                state.beginRow = -1;
            }
        } else {
            // Header collection
            if (child.text === KW_PATCH_IF || child.text === KW_ACTION_IF) {
                state.conditionKeyword = child.text;
                state.conditionNode = node.childForFieldName("condition") ?? null;
                continue;
            }
            if (state.conditionNode && child === state.conditionNode) {
                continue;
            }
            state.headerParts.push(child.text);
        }
    }

    // Output any remaining header parts
    outputHeaderLines([state.headerParts], state.lines, indent, contIndent);

    return state.lines.join("\n");
}

// ============================================
// Match case formatting
// ============================================

/** Format match_case: values BEGIN body END */
export function formatMatchCase(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    const headerParts: string[] = [];
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            const header = normalizeWhitespace(headerParts.join(" "));
            if (header.includes("//")) {
                lines.push(indent + header);
                lines.push(indent + KW_BEGIN);
            } else {
                lines.push(indent + header + " " + KW_BEGIN);
            }
            inBody = true;
            continue;
        }

        if (isKeyword(child, KW_END)) {
            lines.push(indent + KW_END);
            inBody = false;
            continue;
        }

        if (isComment(child)) {
            if (inBody) {
                handleComment(lines, child, bodyIndent, lastEndRow);
            } else {
                headerParts.push(normalizeComment(child.text));
            }
            continue;
        }

        if (inBody) {
            if (isBodyContent(child.type)) {
                lines.push(formatNode(child, ctx, depth + 1));
                lastEndRow = child.endPosition.row;
            }
        } else {
            headerParts.push(child.text);
        }
    }

    return lines.join("\n");
}

// Re-export formatCondition for use in predicate formatting
export { formatCondition };
