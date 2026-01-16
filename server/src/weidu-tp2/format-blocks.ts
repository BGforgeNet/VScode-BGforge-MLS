/**
 * Formatting for block constructs: control flow, loops, functions, COPY actions.
 * Handles BEGIN...END patterns with proper indentation.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import {
    type FormatContext,
    type ControlFlowState,
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
    KW_LPF,
    KW_LAF,
    KW_LPM,
    KW_LAM,
    KW_PATCH_IF,
    KW_ACTION_IF,
    KW_BUT_ONLY,
    KW_BUT_ONLY_IF_IT_CHANGES,
    KW_IF_EXISTS,
    KW_UNLESS,
    KW_IF,
} from "./format-types";
import {
    isComment,
    isKeyword,
    isForEach,
    isAssociativeArrayDef,
    isBodyContent,
    isPatch,
    isControlFlow,
    isControlFlowBodyContent,
    isParamKeyword,
    normalizeComment,
    normalizeWhitespace,
    withNormalizedComment,
    handleComment,
    tryAppendInlineComment,
    outputAlignedAssignments,
    outputHeaderLines,
    lastElement,
} from "./format-utils";

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

    // Only split on OR/AND, not other binary operators
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

    // Add right side with the operator (preserve original case)
    result.push({ operator: op.text, text: normalizeWhitespace(right.text) });

    return result;
}

/**
 * Format a condition expression, splitting at OR/AND boundaries if too long.
 *
 * @param conditionNode - The condition AST node (may be null)
 * @param prefix - Keyword prefix like "ACTION_IF" or "PATCH_IF"
 * @param indent - Base indentation for the first line
 * @param contIndent - Continuation indentation for split lines
 * @param lineLimit - Maximum line length before splitting
 * @returns Array of formatted lines
 */
export function formatCondition(
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

    // Can't split - return as single line
    return [fullLine];
}

// ============================================
// Generic block formatting helpers
// ============================================

/**
 * Format a generic BEGIN...END block body.
 * Extracts and formats body content between BEGIN and END keywords.
 *
 * @param node - The parent node containing BEGIN...END structure
 * @param ctx - Formatting context with indent settings
 * @param depth - Current nesting depth
 * @param formatChild - Callback to format child nodes
 * @returns Object with formatted lines array and last content row number
 */
export function formatBlockBody(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatChild: (child: SyntaxNode, ctx: FormatContext, depth: number) => string
): { lines: string[]; lastEndRow: number } {
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            inBody = true;
            continue;
        }
        if (isKeyword(child, KW_END)) {
            inBody = false;
            continue;
        }
        if (!inBody) continue;

        if (isComment(child)) {
            handleComment(lines, child, bodyIndent, lastEndRow);
        } else if (isBodyContent(child.type)) {
            lines.push(formatChild(child, ctx, depth + 1));
            lastEndRow = child.endPosition.row;
        }
    }

    return { lines, lastEndRow };
}

// ============================================
// FOR loop formatting
// ============================================

/** Format FOR loop with pre-formatted header. */
export function formatForLoop(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    header: string,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const { lines: bodyLines } = formatBlockBody(node, ctx, depth, formatNode);

    return [indent + header + " " + KW_BEGIN, ...bodyLines, indent + KW_END].join("\n");
}

/** Format FOR loop header: FOR (init; condition; increment) */
export function formatForLoopHeader(node: SyntaxNode): string | null {
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

/** Format FOR_EACH style loop. */
export function formatForEach(
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

    // Format body using shared helper
    const { lines: bodyLines } = formatBlockBody(node, ctx, depth, formatNode);

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
export function formatAssociativeArray(node: SyntaxNode, ctx: FormatContext, depth: number): string {
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
            items.push({ type: "comment", text: normalizeComment(child.text), endRow: child.endPosition.row });
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
// Control flow formatting
// ============================================

/** Handle BEGIN keyword in control flow. */
function handleControlFlowBegin(
    child: SyntaxNode,
    state: ControlFlowState,
    indent: string,
    contIndent: string,
    lineLimit: number
): void {
    const wasAfterELSE = state.afterELSE;
    state.afterELSE = false;

    if (wasAfterELSE && state.lines.length > 0) {
        const lastLine = lastElement(state.lines);
        if (lastLine && lastLine.trimEnd().endsWith(KW_ELSE)) {
            state.lines[state.lines.length - 1] = lastLine + " " + KW_BEGIN;
            state.headerLines = [[]];
            state.conditionNode = null;
            state.headerKeyword = "";
            state.inBody = true;
            return;
        }
    }

    if (state.conditionNode && state.headerKeyword) {
        const condLines = formatCondition(state.conditionNode, state.headerKeyword, indent, contIndent, lineLimit);
        state.lines.push(...condLines);
        if (condLines.length > 1) {
            state.lines.push(indent + KW_BEGIN);
        } else {
            const lastIdx = state.lines.length - 1;
            if (lastIdx >= 0) {
                state.lines[lastIdx] += " " + KW_BEGIN;
            }
        }
        state.headerLines = [[]];
        state.conditionNode = null;
        state.headerKeyword = "";
        state.inBody = true;
        state.beginRow = child.startPosition.row;
        return;
    }

    let nonEmptyCount = 0;
    for (const lineParts of state.headerLines) {
        if (lineParts.length > 0) nonEmptyCount++;
    }

    const multiLine = nonEmptyCount > 1;
    outputHeaderLines(state.headerLines, state.lines, indent, contIndent);

    const lastLine = lastElement(state.lines) ?? "";
    const endsWithComment = lastLine.includes("//");

    if (multiLine || nonEmptyCount === 0 || endsWithComment) {
        state.lines.push(indent + KW_BEGIN);
    } else {
        const lastIdx = state.lines.length - 1;
        if (lastIdx >= 0) {
            state.lines[lastIdx] += " " + KW_BEGIN;
        } else {
            state.lines.push(indent + KW_BEGIN);
        }
    }
    state.headerLines = [[]];
    state.inBody = true;
    state.beginRow = child.startPosition.row;
}

/** Handle comment in control flow formatting. */
function handleControlFlowComment(
    child: SyntaxNode,
    state: ControlFlowState,
    indent: string,
    bodyIndent: string
): void {
    if (state.inBody) {
        const rowToCheck = state.beginRow >= 0 ? state.beginRow : state.lastEndRow;
        if (tryAppendInlineComment(state.lines, child, rowToCheck)) {
            state.beginRow = -1;
            return;
        }
        state.lines.push(bodyIndent + normalizeComment(child.text));
        state.beginRow = -1;
    } else if (state.afterELSE) {
        state.lines.push(indent + normalizeComment(child.text));
    } else {
        const currentLine = lastElement(state.headerLines);
        if (currentLine) {
            currentLine.push(normalizeComment(child.text));
        }
        if (child.type === "line_comment") {
            state.headerLines.push([]);
        }
    }
}

/**
 * Format control flow constructs (IF, MATCH, TRY, FOR, WHILE, array definitions).
 *
 * Handles various patterns:
 * - ACTION_IF/PATCH_IF with condition splitting for long lines
 * - FOR loops (outer_for, for_patch) with (init; cond; incr) header
 * - FOR_EACH loops with IN keyword and item lists
 * - MATCH/TRY blocks with case handling
 * - Array definitions (ACTION_DEFINE_ARRAY, associative arrays)
 *
 * @param node - Control flow AST node
 * @param ctx - Formatting context
 * @param depth - Current nesting depth
 * @param formatNode - Callback to format child nodes recursively
 * @returns Formatted control flow construct
 */
export function formatControlFlow(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const forHeader = formatForLoopHeader(node);
    if (forHeader !== null) {
        return formatForLoop(node, ctx, depth, forHeader, formatNode);
    }

    if (isForEach(node.type)) {
        return formatForEach(node, ctx, depth, formatNode);
    }

    if (isAssociativeArrayDef(node.type)) {
        return formatAssociativeArray(node, ctx, depth);
    }

    const indent = ctx.indent.repeat(depth);
    const contIndent = indent + ctx.indent;
    const bodyDepth = depth + 1;
    const bodyIndent = ctx.indent.repeat(bodyDepth);

    const state: ControlFlowState = {
        lines: [],
        headerLines: [[]],
        conditionNode: null,
        headerKeyword: "",
        inBody: false,
        afterELSE: false,
        lastEndRow: -1,
        beginRow: -1,
    };

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            handleControlFlowBegin(child, state, indent, contIndent, ctx.lineLimit);
            continue;
        }

        if (isKeyword(child, KW_END)) {
            state.inBody = false;
            state.lines.push(indent + KW_END);
            continue;
        }

        if (isKeyword(child, KW_ELSE)) {
            const lastLine = lastElement(state.lines);
            if (lastLine && lastLine.trimEnd().endsWith(KW_END)) {
                state.lines[state.lines.length - 1] = lastLine + " " + KW_ELSE;
            } else {
                state.lines.push(indent + KW_ELSE);
            }
            state.afterELSE = true;
            continue;
        }

        if (isKeyword(child, KW_THEN)) {
            const currentLine = lastElement(state.headerLines);
            if (currentLine) {
                currentLine.push(KW_THEN);
            }
            continue;
        }

        if (isKeyword(child, KW_WITH)) {
            outputHeaderLines(state.headerLines, state.lines, indent, contIndent);
            state.headerLines = [[]];
            state.lines.push(indent + KW_WITH);
            state.inBody = true;
            continue;
        }

        if (isKeyword(child, KW_DEFAULT)) {
            state.lines.push(indent + KW_DEFAULT);
            continue;
        }

        if (state.afterELSE && (child.type === "action_if" || child.type === "patch_if")) {
            state.lines.push(formatNode(child, ctx, depth));
            state.afterELSE = false;
            continue;
        }

        if (isComment(child)) {
            handleControlFlowComment(child, state, indent, bodyIndent);
            continue;
        }

        if (state.inBody) {
            if (isControlFlowBodyContent(child.type)) {
                state.lines.push(formatNode(child, ctx, bodyDepth));
                state.lastEndRow = child.endPosition.row;
                state.beginRow = -1;
            }
        } else {
            if (child.text === KW_PATCH_IF || child.text === KW_ACTION_IF) {
                state.headerKeyword = child.text;
                state.conditionNode = node.childForFieldName("condition") ?? null;
                continue;
            }
            if (state.conditionNode && child === state.conditionNode) {
                continue;
            }
            const currentLine = lastElement(state.headerLines);
            if (currentLine) {
                currentLine.push(child.text);
            }
        }
    }

    outputHeaderLines(state.headerLines, state.lines, indent, contIndent);

    return state.lines.join("\n");
}

// ============================================
// COPY action formatting
// ============================================

/**
 * Format COPY-style actions (COPY, COPY_EXISTING, COPY_LARGE, etc.).
 *
 * Structure: KEYWORD file_pairs [patches] [BUT_ONLY]
 * - Multiple file pairs are placed on separate lines
 * - Patches are indented inside the COPY block
 * - Special handling for patch_block (BEGIN...END wrapped patches)
 * - Suffix keywords (BUT_ONLY, IF_EXISTS) placed at end
 *
 * @param node - COPY action AST node
 * @param ctx - Formatting context
 * @param depth - Current nesting depth
 * @param formatNode - Callback to format child nodes recursively
 * @returns Formatted COPY action
 */
export function formatCopyAction(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const patchIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    let keyword = "";
    const filePairs: string[] = [];
    const patches: SyntaxNode[] = [];
    const suffix: string[] = [];
    let inPatchArea = false;

    for (const child of node.children) {
        if (
            child.type === "file_pair" ||
            child.type === "copy_random_item" ||
            child.type === "copy_large_item" ||
            child.type === "copy_2da_item"
        ) {
            filePairs.push(normalizeWhitespace(child.text));
        } else if (child.type === "identifier" && !keyword) {
            keyword = child.text;
        } else if (child.text.startsWith("COPY") || child.text === "INNER_ACTION") {
            keyword = child.text;
        } else if (
            isPatch(child.type) ||
            isControlFlow(child.type) ||
            isComment(child) ||
            child.type === "patch_block" ||
            child.type === "if_filter"
        ) {
            inPatchArea = true;
            patches.push(child);
        } else if (
            isKeyword(child, KW_BUT_ONLY) ||
            isKeyword(child, KW_BUT_ONLY_IF_IT_CHANGES) ||
            isKeyword(child, KW_IF_EXISTS) ||
            isKeyword(child, KW_UNLESS) ||
            (isKeyword(child, KW_IF) && inPatchArea) ||
            child.type === "_but_only"
        ) {
            inPatchArea = true;
            suffix.push(child.text);
        }
    }

    // Format header with file pairs
    if (filePairs.length <= 1) {
        const firstPair = filePairs[0] ?? "";
        const header = keyword + " " + firstPair;
        const totalLen = indent.length + header.length;
        if (totalLen <= ctx.lineLimit || filePairs.length === 0) {
            lines.push(indent + header);
        } else {
            lines.push(indent + keyword);
            lines.push(patchIndent + firstPair);
        }
    } else {
        lines.push(indent + keyword);
        for (const pair of filePairs) {
            lines.push(patchIndent + pair);
        }
    }

    // Format patches
    let lastPatchEndRow = -1;
    for (const patch of patches) {
        if (isComment(patch)) {
            handleComment(lines, patch, patchIndent, lastPatchEndRow);
        } else if (patch.type === "patch_block") {
            lines.push(patchIndent + KW_BEGIN);
            let lastBlockPatchEndRow = -1;
            for (const patchChild of patch.children) {
                if (isKeyword(patchChild, KW_BEGIN) || isKeyword(patchChild, KW_END)) {
                    continue;
                }
                if (isComment(patchChild)) {
                    handleComment(lines, patchChild, ctx.indent.repeat(depth + 2), lastBlockPatchEndRow);
                } else if (isPatch(patchChild.type) || isControlFlow(patchChild.type)) {
                    lines.push(formatNode(patchChild, ctx, depth + 2));
                    lastBlockPatchEndRow = patchChild.endPosition.row;
                }
            }
            lines.push(patchIndent + KW_END);
            lastPatchEndRow = patch.endPosition.row;
        } else {
            lines.push(formatNode(patch, ctx, depth + 1));
            lastPatchEndRow = patch.endPosition.row;
        }
    }

    // Format suffix
    if (suffix.length > 0) {
        let suffixLine = "";
        for (const item of suffix) {
            if (item.startsWith("//")) {
                if (suffixLine) {
                    lines.push(indent + suffixLine);
                    suffixLine = "";
                }
                lines.push(indent + normalizeComment(item));
            } else {
                suffixLine = suffixLine ? suffixLine + " " + item : item;
            }
        }
        if (suffixLine) {
            lines.push(indent + suffixLine);
        }
    }

    return lines.join("\n");
}

// ============================================
// Function definition/call formatting
// ============================================

/** Parse assignment: name = value (handles both assignment and binary_expr nodes) */
function parseAssignment(node: SyntaxNode): { name: string; value: string } | null {
    // Try standard assignment fields first
    let nameNode = node.childForFieldName("name") ?? node.childForFieldName("var");
    let valueNode = node.childForFieldName("value");

    // Fallback to binary_expr fields (left/right)
    if (!nameNode) {
        nameNode = node.childForFieldName("left");
        valueNode = node.childForFieldName("right");
    }

    if (!nameNode) return null;

    return {
        name: nameNode.text,
        value: valueNode ? normalizeWhitespace(valueNode.text) : "",
    };
}

/** Format parameter declaration block. */
function formatParamDecl(node: SyntaxNode, indent: string, ctx: FormatContext): string[] {
    const assignIndent = indent + ctx.indent;
    const items: CollectedItem[] = [];
    let keyword = "";

    for (const child of node.children) {
        if (isParamKeyword(child.text)) {
            keyword = child.text;
        } else if (isComment(child)) {
            items.push({ type: "comment", text: normalizeComment(child.text), endRow: child.endPosition.row });
        } else if (child.type === "assignment" || child.type === "patch_assignment") {
            const parsed = parseAssignment(child);
            if (parsed) {
                items.push({ type: "assignment", name: parsed.name, value: parsed.value, endRow: child.endPosition.row });
            }
        } else if (child.type === "variable_ref" || child.type === "identifier") {
            items.push({ type: "assignment", name: child.text, value: "", endRow: child.endPosition.row });
        }
    }

    return outputAlignedAssignments(items, keyword, indent, assignIndent);
}

/** Format parameter call block. */
function formatParamCall(node: SyntaxNode, indent: string, ctx: FormatContext): string[] {
    const assignIndent = indent + ctx.indent;
    const items: CollectedItem[] = [];
    let keyword = "";

    for (const child of node.children) {
        if (isParamKeyword(child.text)) {
            keyword = child.text;
        } else if (isComment(child)) {
            items.push({ type: "comment", text: normalizeComment(child.text), endRow: child.endPosition.row });
        } else if (
            child.type === "int_var_call_item" ||
            child.type === "str_var_call_item" ||
            child.type === "ret_call_item" ||
            child.type === "binary_expr"
        ) {
            const parsed = parseAssignment(child);
            if (parsed) {
                items.push({ type: "assignment", name: parsed.name, value: parsed.value, endRow: child.endPosition.row });
            }
        } else if (child.type === "variable_ref" || child.type === "identifier") {
            items.push({ type: "assignment", name: child.text, value: "", endRow: child.endPosition.row });
        }
    }

    return outputAlignedAssignments(items, keyword, indent, assignIndent);
}

/**
 * Format function/macro definition (DEFINE_ACTION_FUNCTION, DEFINE_PATCH_MACRO, etc.).
 *
 * Structure: DEFINE_X name [INT_VAR...] [STR_VAR...] [RET...] BEGIN body END
 * - Parameter declarations (INT_VAR, STR_VAR, RET) with aligned assignments
 * - Body content indented inside BEGIN...END
 *
 * @param node - Function definition AST node
 * @param ctx - Formatting context
 * @param depth - Current nesting depth
 * @param formatNode - Callback to format body content
 * @returns Formatted function definition
 */
export function formatFunctionDef(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number,
    formatNode: (node: SyntaxNode, ctx: FormatContext, depth: number) => string
): string {
    const indent = ctx.indent.repeat(depth);
    const bodyIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    let defLine = "";
    let inBody = false;
    let lastEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) {
            if (defLine) {
                lines.push(indent + defLine);
                defLine = "";
            }
            lines.push(indent + KW_BEGIN);
            inBody = true;
            continue;
        }

        if (isKeyword(child, KW_END)) {
            inBody = false;
            lines.push(indent + KW_END);
            continue;
        }

        if (isComment(child)) {
            if (inBody) {
                handleComment(lines, child, bodyIndent, lastEndRow);
            } else {
                if (defLine) {
                    lines.push(indent + defLine);
                    defLine = "";
                }
                lines.push(indent + normalizeComment(child.text));
            }
            continue;
        }

        if (inBody) {
            if (isBodyContent(child.type)) {
                lines.push(formatNode(child, ctx, depth + 1));
                lastEndRow = child.endPosition.row;
            }
        } else {
            if (child.type.endsWith("_var_decl") || child.type.endsWith("_ret_decl")) {
                if (defLine) {
                    lines.push(indent + defLine);
                    defLine = "";
                }
                lines.push(...formatParamDecl(child, indent, ctx));
            } else if (child.text.startsWith("DEFINE_")) {
                defLine = child.text;
            } else if (child.type === "identifier") {
                defLine = defLine ? defLine + " " + child.text : child.text;
            }
        }
    }

    if (defLine) {
        lines.push(indent + defLine);
    }

    return lines.join("\n");
}

/**
 * Format function/macro call (LAF, LPF, LAM, LPM).
 *
 * Structure: LXX name [INT_VAR...] [STR_VAR...] [RET...] END
 * - Parameter sections with aligned assignments
 * - No BEGIN keyword, ends with END
 *
 * @param node - Function call AST node
 * @param ctx - Formatting context
 * @param depth - Current nesting depth
 * @returns Formatted function call
 */
export function formatFunctionCall(
    node: SyntaxNode,
    ctx: FormatContext,
    depth: number
): string {
    const indent = ctx.indent.repeat(depth);
    const paramIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    let callLine = "";

    for (const child of node.children) {
        if (isKeyword(child, KW_END)) {
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            lines.push(indent + KW_END);
            continue;
        }

        if (isComment(child)) {
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            lines.push(indent + normalizeComment(child.text));
            continue;
        }

        if (
            child.type === "int_var_call" ||
            child.type === "str_var_call" ||
            child.type === "ret_call" ||
            child.type === "ret_array_call"
        ) {
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            const paramLines = formatParamCall(child, paramIndent, ctx);
            lines.push(...paramLines);
        } else if (
            isKeyword(child, KW_LPF) ||
            isKeyword(child, KW_LAF) ||
            isKeyword(child, KW_LPM) ||
            isKeyword(child, KW_LAM)
        ) {
            callLine = child.text;
        } else if (child.type === "identifier") {
            callLine = callLine ? callLine + " " + child.text : child.text;
        } else {
            const normalized = normalizeWhitespace(child.text);
            callLine = callLine ? callLine + " " + normalized : normalized;
        }
    }

    if (callLine) {
        lines.push(indent + callLine);
    }

    return lines.join("\n");
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

// ============================================
// Predicate action formatting
// ============================================

/** Format REQUIRE_PREDICATE action. */
export function formatPredicateAction(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const contIndent = indent + ctx.indent;

    const predicate = node.childForFieldName("predicate");
    const message = node.childForFieldName("message");

    if (!predicate || !message) {
        return withNormalizedComment(indent + normalizeWhitespace(node.text));
    }

    const condLines = formatCondition(predicate, "REQUIRE_PREDICATE", indent, contIndent, ctx.lineLimit);

    if (condLines.length === 1) {
        return condLines[0] + " " + normalizeWhitespace(message.text);
    }

    condLines[condLines.length - 1] += " " + normalizeWhitespace(message.text);
    return condLines.join("\n");
}
