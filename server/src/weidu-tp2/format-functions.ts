/**
 * Function and macro formatting: definitions (DEFINE_*) and calls (LAF/LPF/LAM/LPM).
 * Handles parameter declarations with aligned assignments.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import {
    type FormatContext,
    type CollectedItem,
    KW_BEGIN,
    KW_END,
    KW_LPF,
    KW_LAF,
    KW_LPM,
    KW_LAM,
    addFormatError,
} from "./format-types";
import {
    isComment,
    isKeyword,
    isBodyContent,
    isParamKeyword,
    normalizeComment,
    normalizeWhitespace,
    handleComment,
    outputAlignedAssignments,
} from "./format-utils";

// ============================================
// Assignment parsing
// ============================================

/** Parse assignment: name = value (handles assignment, binary_expr, ternary_expr nodes) */
function parseAssignment(node: SyntaxNode): { name: string; value: string } | null {
    // Try standard assignment fields first
    let nameNode = node.childForFieldName("name") ?? node.childForFieldName("var");
    let valueNode = node.childForFieldName("value");

    // Fallback to binary_expr fields (left/right)
    if (!nameNode) {
        nameNode = node.childForFieldName("left");
        valueNode = node.childForFieldName("right");
    }

    // Handle ternary_expr: "name = condition ? then : else"
    // Parse textually since the name is embedded in the condition
    if (!nameNode && node.type === "ternary_expr") {
        const text = node.text;
        const eqIdx = text.indexOf("=");
        if (eqIdx > 0) {
            const name = text.slice(0, eqIdx).trim();
            const value = text.slice(eqIdx + 1).trim();
            return { name, value: normalizeWhitespace(value) };
        }
    }

    if (!nameNode) return null;

    return {
        name: nameNode.text,
        value: valueNode ? normalizeWhitespace(valueNode.text) : "",
    };
}

// ============================================
// Parameter declaration formatting
// ============================================

/** Format parameter declaration block (INT_VAR, STR_VAR, RET in definitions). */
function formatParamDecl(node: SyntaxNode, indent: string, ctx: FormatContext): string[] {
    const assignIndent = indent + ctx.indent;
    const items: CollectedItem[] = [];

    // Extract keyword from first child (INT_VAR, STR_VAR, RET, etc.)
    const keyword = node.firstChild?.text ?? "";

    // Use all children to detect "=" tokens between name and value
    // Grammar: seq("INT_VAR", repeat(seq(identifier|string, optional(seq("=", value)))))
    const children = node.children;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child) continue;

        if (isComment(child)) {
            items.push({ type: "comment", text: normalizeComment(child.text), startRow: child.startPosition.row, endRow: child.endPosition.row });
        } else if (child.type === "assignment" || child.type === "patch_assignment") {
            const parsed = parseAssignment(child);
            if (parsed) {
                items.push({ type: "assignment", name: parsed.name, value: parsed.value, endRow: child.endPosition.row });
            }
        } else if (child.type === "variable_ref" || child.type === "identifier" || child.type === "string") {
            // Check if next child is "=" token indicating an assignment
            const nextChild = children[i + 1];
            if (nextChild && nextChild.text === "=") {
                // name = value pattern - get the value after "="
                const valueChild = children[i + 2];
                if (valueChild && !isComment(valueChild)) {
                    items.push({
                        type: "assignment",
                        name: child.text,
                        value: normalizeWhitespace(valueChild.text),
                        endRow: valueChild.endPosition.row,
                    });
                    i += 2; // Skip "=" and value
                } else {
                    // "=" without value - handle gracefully
                    items.push({ type: "assignment", name: child.text, value: "", endRow: child.endPosition.row });
                    i++; // Skip "="
                }
            } else {
                // No "=" - name without value
                items.push({ type: "assignment", name: child.text, value: "", endRow: child.endPosition.row });
            }
        }
    }

    return outputAlignedAssignments(items, keyword, indent, assignIndent);
}

// ============================================
// Parameter call formatting
// ============================================

/** Format parameter call block (INT_VAR, STR_VAR, RET in calls). */
function formatParamCall(node: SyntaxNode, indent: string, ctx: FormatContext): string[] {
    const assignIndent = indent + ctx.indent;
    const items: CollectedItem[] = [];
    let keyword = "";

    for (const child of node.children) {
        if (isParamKeyword(child.text)) {
            keyword = child.text;
        } else if (isComment(child)) {
            items.push({ type: "comment", text: normalizeComment(child.text), startRow: child.startPosition.row, endRow: child.endPosition.row });
        } else if (
            child.type === "int_var_call_item" ||
            child.type === "str_var_call_item" ||
            child.type === "ret_call_item" ||
            child.type === "binary_expr" ||
            child.type === "ternary_expr"
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

// ============================================
// Function definition formatting
// ============================================

/**
 * Format function/macro definition (DEFINE_ACTION_FUNCTION, DEFINE_PATCH_MACRO, etc.).
 *
 * Structure: DEFINE_X name [INT_VAR...] [STR_VAR...] [RET...] BEGIN body END
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
    let hasBegin = false;
    let hasEnd = false;

    for (const child of node.children) {
        if (isKeyword(child, KW_BEGIN)) hasBegin = true;
        if (isKeyword(child, KW_END)) hasEnd = true;
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
            if (child.type.endsWith("_var_decl") || child.type === "ret_decl" || child.type === "ret_array_decl") {
                if (defLine) {
                    lines.push(indent + defLine);
                    defLine = "";
                }
                // Parameter declarations are indented one level from the function definition
                lines.push(...formatParamDecl(child, bodyIndent, ctx));
            } else if (child.text.startsWith("DEFINE_")) {
                defLine = child.text;
            } else if (child.type === "identifier" || child.type === "string") {
                defLine = defLine ? defLine + " " + child.text : child.text;
            }
        }
    }

    if (defLine) {
        lines.push(indent + defLine);
    }

    // Report structural issues
    if (!hasBegin) {
        addFormatError(ctx, `Function definition missing BEGIN`, node.startPosition.row + 1, node.startPosition.column + 1);
    }
    if (!hasEnd) {
        addFormatError(ctx, `Function definition missing END`, node.startPosition.row + 1, node.startPosition.column + 1);
    }

    return lines.join("\n");
}

// ============================================
// Function call formatting
// ============================================

/**
 * Format function/macro call (LAF, LPF, LAM, LPM).
 *
 * Structure: LXX name [INT_VAR...] [STR_VAR...] [RET...] END
 */
export function formatFunctionCall(node: SyntaxNode, ctx: FormatContext, depth: number): string {
    const indent = ctx.indent.repeat(depth);
    const paramIndent = ctx.indent.repeat(depth + 1);
    const lines: string[] = [];

    let callLine = "";
    let hasEnd = false;
    let callKeyword = "";
    let lastChildEndRow = -1;

    for (const child of node.children) {
        if (isKeyword(child, KW_END)) {
            hasEnd = true;
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            lines.push(indent + KW_END);
            lastChildEndRow = child.endPosition.row;
            continue;
        }

        if (isComment(child)) {
            if (callLine) {
                lines.push(indent + callLine);
                callLine = "";
            }
            // Check if comment is on same line as previous content - append inline
            if (lastChildEndRow >= 0 && child.startPosition.row === lastChildEndRow && lines.length > 0) {
                const lastLine = lines[lines.length - 1];
                if (lastLine !== undefined && !lastLine.includes("//")) {
                    lines[lines.length - 1] = lastLine + "  " + normalizeComment(child.text);
                    continue;
                }
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
            lastChildEndRow = child.endPosition.row;
        } else if (
            isKeyword(child, KW_LPF) ||
            isKeyword(child, KW_LAF) ||
            isKeyword(child, KW_LPM) ||
            isKeyword(child, KW_LAM)
        ) {
            callLine = child.text;
            callKeyword = child.text;
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

    // Report structural issues
    if (!hasEnd) {
        addFormatError(ctx, `Function call '${callKeyword}' missing END`, node.startPosition.row + 1, node.startPosition.column + 1);
    }

    return lines.join("\n");
}
