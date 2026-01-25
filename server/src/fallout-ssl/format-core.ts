/**
 * Core formatting logic for Fallout SSL files.
 * Shared between LSP server and CLI.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";


// Formatting options
export interface FormatOptions {
    indentSize: number;
    maxLineLength: number;
}

const DEFAULT_OPTIONS: FormatOptions = {
    indentSize: 4,
    maxLineLength: 120,
};

// Format context passed through all functions
interface FormatContext {
    indent: string;
    maxLineLength: number;
}

let ctx: FormatContext = {
    indent: "    ",
    maxLineLength: 120,
};

// Regex patterns for keyword matching
const BEGIN_END_REGEX = /^(begin|end)$/i;
const BEGIN_END_PROCEDURE_REGEX = /^(begin|end|procedure)$/i;

// Reserved words that cannot be used as identifiers.
// Tree-sitter grammar allows keywords as identifiers when not in keyword position,
// so we detect and report them here. See grammar.js and README for details.
const RESERVED_WORDS = new Set([
    "begin", "end", "procedure", "variable", "if", "then", "else",
    "while", "do", "for", "foreach", "in", "switch", "case", "default",
    "return", "break", "continue", "call", "import", "export",
    "and", "or", "not", "bwand", "bwor", "bwxor", "bwnot",
]);

function isReservedWord(text: string): boolean {
    return RESERVED_WORDS.has(text.toLowerCase());
}

/** Abort formatting with a descriptive error including source location. */
function throwFormatError(message: string, line: number, column: number): never {
    throw new Error(`${line}:${column}: ${message}`);
}

// Helper: check if node is a comment
function isComment(node: SyntaxNode): boolean {
    return node.type === "comment" || node.type === "line_comment";
}

// Helper: check if next sibling is a trailing comment on same line
function hasTrailingComment(child: SyntaxNode, nextChild: SyntaxNode | undefined): boolean {
    return nextChild !== undefined &&
        isComment(nextChild) &&
        nextChild.startPosition.row === child.endPosition.row;
}

// Normalize preprocessor directives with trailing comments
function normalizePreprocessor(text: string): string {
    // Check for trailing line comment
    const lineCommentMatch = text.match(/^(.+?)(\s*)(\/\/.*)$/);
    if (lineCommentMatch) {
        const code = lineCommentMatch[1];
        const comment = lineCommentMatch[3];
        if (code && comment) {
            return code.trimEnd() + ctx.indent + normalizeComment(comment);
        }
    }
    // Check for trailing block comment (single line only)
    const blockCommentMatch = text.match(/^(.+?)(\s*)(\/\*[^]*?\*\/)$/);
    if (blockCommentMatch) {
        const code = blockCommentMatch[1];
        const comment = blockCommentMatch[3];
        if (code && comment && !comment.includes("\n")) {
            return code.trimEnd() + ctx.indent + normalizeComment(comment);
        }
    }
    return text;
}

// Normalize comment spacing:
// - Block comments: exactly one space after opening and before closing
// - Line comments: exactly one space after //
function normalizeComment(text: string): string {
    if (text.startsWith("/*")) {
        // Block comment - normalize spaces
        const inner = text.slice(2, -2);
        const isMultiline = inner.includes("\n");

        if (isMultiline) {
            // For multiline: ensure space after /* if content on same line,
            // and space before */ if content on same line
            let result = inner;
            // Fix start: if first char is not newline, ensure single space
            if (result.length > 0 && result[0] !== "\n") {
                result = result.replace(/^[ \t]*/, " ");
            }
            // Fix end: if last char is not newline, ensure single space before */
            if (result.length > 0 && !result.endsWith("\n")) {
                result = result.replace(/[ \t]*$/, " ");
            }
            return `/*${result}*/`;
        } else {
            // Single line block comment: /* text */
            const trimmed = inner.trim();
            if (trimmed.length === 0) {
                return "/* */";
            }
            return `/* ${trimmed} */`;
        }
    } else if (text.startsWith("//")) {
        // Line comment - ensure single space after //
        const inner = text.slice(2);
        const trimmed = inner.replace(/^[ \t]*/, "");
        if (trimmed.length === 0) {
            return "//";
        }
        return `// ${trimmed}`;
    }
    return text;
}


export interface FormatResult {
    text: string;
}

export function formatDocument(node: SyntaxNode, options: FormatOptions = DEFAULT_OPTIONS): FormatResult {
    ctx = {
        indent: " ".repeat(options.indentSize),
        maxLineLength: options.maxLineLength,
    };
    const text = formatNode(node, 0);
    return { text };
}

function formatNode(node: SyntaxNode, depth: number): string {
    // Handle ERROR nodes: preserve original text
    if (node.type === "ERROR") {
        return node.text;
    }

    switch (node.type) {
        case "source_file": {
            const content = formatChildren(node, depth);
            // Replace tabs, remove leading blank lines, ensure exactly one trailing newline
            return content.replace(/\t/g, ctx.indent).replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
        }
        case "preprocessor": {
            let result = normalizePreprocessor(node.text);
            // Check if there's a line comment on the same line (next sibling)
            const nextSibling = node.nextSibling;
            if (nextSibling && nextSibling.type === "line_comment" &&
                nextSibling.startPosition.row === node.endPosition.row) {
                // Add the comment on the same line with proper spacing
                const commentText = normalizeComment(nextSibling.text);
                // Ensure proper spacing before comment (4 spaces as indent)
                result = result.trimEnd() + "    " + commentText;
            }
            return result;
        }
        case "comment":
        case "line_comment":
            return normalizeComment(node.text);
        case "procedure_forward":
            return formatProcedureForward(node);
        case "procedure":
            return formatProcedure(node, depth);
        case "variable_decl":
            return formatVariableDecl(node, depth);
        case "export_decl":
            return formatExportDecl(node);
        case "if_stmt":
            return formatIfStmt(node, depth);
        case "while_stmt":
            return formatWhileStmt(node, depth);
        case "for_stmt":
            return formatForStmt(node, depth);
        case "foreach_stmt":
            return formatForeachStmt(node, depth);
        case "switch_stmt":
            return formatSwitchStmt(node, depth);
        case "return_stmt": {
            // Grammar has no field name, expression is the only named child
            const expr = node.namedChildren[0];
            // Column for expression: depth indent + "return "
            const column = depth * ctx.indent.length + 7;
            return `return${expr ? " " + formatExpression(expr, column, 1) : ""};`;
        }
        case "call_stmt":
            return formatCallStmt(node);
        case "assignment":
            return formatAssignment(node);
        case "expression_stmt":
            return formatExpressionStmt(node, depth);
        case "block":
            return formatBlock(node, depth);
        default:
            return node.text;
    }
}

function formatChildren(node: SyntaxNode, depth: number): string {
    const parts: string[] = [];
    const children = node.children;
    let needsBlankLine = false;

    children.forEach((child, i) => {
        const prevChild = children[i - 1]; // undefined at start
        const nextChild = children[i + 1]; // undefined at end

        const hadBlankLineBefore = prevChild && (child.startPosition.row - prevChild.endPosition.row > 1);
        const trailingComment = hasTrailingComment(child, nextChild);

        if (isComment(child)) {
            // Skip if already appended as trailing comment
            if (prevChild && prevChild.endPosition.row === child.startPosition.row) {
                return;
            }

            const immediatelyAfterProcedure = prevChild?.type === "procedure" && !hadBlankLineBefore;

            if (parts.length > 0 && !immediatelyAfterProcedure) {
                if (needsBlankLine || hadBlankLineBefore) {
                    parts.push("");
                    needsBlankLine = false;
                }
            }
            parts.push(normalizeComment(child.text));
            if (immediatelyAfterProcedure) {
                needsBlankLine = true;
            }
        } else if (child.type === "preprocessor") {
            let preprocessorText = normalizePreprocessor(child.text);
            // Check if next sibling is a line comment on the same line
            if (nextChild && nextChild.type === "line_comment" &&
                nextChild.startPosition.row === child.endPosition.row) {
                // Add the comment on the same line
                preprocessorText = preprocessorText.trimEnd() + "    " + normalizeComment(nextChild.text);
            }
            parts.push(preprocessorText);
        } else if (child.type === "procedure") {
            // Add blank line before procedure if not preceded by doc comment
            if (parts.length > 0) {
                if (needsBlankLine || hadBlankLineBefore) {
                    parts.push("");
                    needsBlankLine = false;
                } else {
                    const lastPart = parts[parts.length - 1];
                    if (lastPart && !lastPart.startsWith("/*") && !lastPart.startsWith("//")) {
                        parts.push("");
                    }
                }
            }

            let formatted = formatNode(child, depth);
            if (trailingComment && nextChild) {
                formatted += ctx.indent + normalizeComment(nextChild.text);
            }
            parts.push(formatted);
            needsBlankLine = true;
        } else {
            if (needsBlankLine && parts.length > 0) {
                parts.push("");
                needsBlankLine = false;
            }
            let formatted = formatNode(child, depth);
            if (trailingComment && nextChild) {
                formatted += ctx.indent + normalizeComment(nextChild.text);
            }
            parts.push(formatted);
        }
    });

    return parts.join("\n");
}

function formatProcedureForward(node: SyntaxNode): string {
    const name = node.childForFieldName("name")?.text || "";
    const params = node.childForFieldName("params");
    if (params) {
        return `procedure ${name}${formatParamList(params)};`;
    }
    return `procedure ${name};`;
}

function formatProcedure(node: SyntaxNode, depth: number): string {
    const name = node.childForFieldName("name")?.text || "";
    const params = node.childForFieldName("params");

    const header = params
        ? `procedure ${name}${formatParamList(params)} begin`
        : `procedure ${name} begin`;

    const bodyParts: string[] = [];
    const skipTypes = new Set(["identifier", "param_list"]);
    const children = node.children;

    children.forEach((child, i) => {
        const nextChild = children[i + 1]; // undefined at end
        const prevChild = children[i - 1]; // undefined at start

        if (skipTypes.has(child.type)) return;
        // Check for reserved words used as identifiers before skipping
        if (BEGIN_END_PROCEDURE_REGEX.test(child.text)) {
            // If it's an expression_stmt containing an identifier, it's a reserved word misuse
            if (child.type === "expression_stmt") {
                const ident = child.namedChildren[0];
                if (ident?.type === "identifier" && isReservedWord(ident.text)) {
                    throwFormatError(
                        `Reserved word "${ident.text}" cannot be used as identifier`,
                        ident.startPosition.row + 1,
                        ident.startPosition.column + 1,
                    );
                }
            }
            return;
        }
        if (child.type.includes("procedure")) return;

        const trailingComment = hasTrailingComment(child, nextChild);

        if (isComment(child)) {
            // Skip if already appended as trailing comment
            if (prevChild && prevChild.endPosition.row === child.startPosition.row) {
                return;
            }
            bodyParts.push(ctx.indent + normalizeComment(child.text));
        } else {
            let formatted = formatNode(child, depth + 1);
            if (trailingComment && nextChild) {
                formatted += ctx.indent + normalizeComment(nextChild.text);
            }
            if (formatted.trim()) {
                bodyParts.push(ctx.indent + formatted);
            }
        }
    });

    if (bodyParts.length === 0) {
        return `${header}\nend`;
    }
    return `${header}\n${bodyParts.join("\n")}\nend`;
}

function formatParamList(node: SyntaxNode): string {
    const params: string[] = [];
    for (const child of node.children) {
        if (child.type === "param") {
            params.push(formatParam(child));
        }
    }
    return `(${params.join(", ")})`;
}

function formatParam(node: SyntaxNode): string {
    const hasVariable = node.children.some(c => c.text === "variable");
    const name = node.childForFieldName("name")?.text || "";
    const defaultValue = node.childForFieldName("default");

    let result = hasVariable ? `variable ${name}` : name;
    if (defaultValue) {
        result += ` = ${formatExpression(defaultValue)}`;
    }
    return result;
}

function formatVariableDecl(node: SyntaxNode, depth: number = 0): string {
    const hasBegin = node.children.some(c => c.text.match(/^begin$/i));
    if (hasBegin) {
        const vars: string[] = [];
        for (const child of node.children) {
            if (child.type === "var_init") {
                vars.push(ctx.indent + formatVarInit(child, depth + 1) + ";");
            }
        }
        return `variable begin\n${vars.join("\n")}\nend`;
    }

    const hasImport = node.children.some(c => c.text === "import");
    const prefix = hasImport ? "import variable " : "variable ";
    const varInits: string[] = [];
    for (const child of node.children) {
        if (child.type === "var_init") {
            varInits.push(formatVarInit(child, depth, prefix.length));
        }
    }

    return `${prefix}${varInits.join(", ")};`;
}

function formatVarInit(node: SyntaxNode, depth: number = 0, prefixLen: number = 0): string {
    const name = node.childForFieldName("name")?.text || "";
    const size = node.childForFieldName("size");
    const value = node.childForFieldName("value");

    let result = name;
    if (size) {
        result += `[${formatExpression(size)}]`;
    }
    if (value) {
        // Preserve := vs = from original
        const op = node.children.find(c => c.text === ":=" || c.text === "=")?.text || "=";
        // Column = indent + prefix + name + " op "
        const column = depth * ctx.indent.length + prefixLen + name.length + op.length + 2;
        result += ` ${op} ${formatExpression(value, column)}`;
    }
    return result;
}

function formatExportDecl(node: SyntaxNode): string {
    const name = node.childForFieldName("name")?.text || "";
    const value = node.childForFieldName("value");
    if (value) {
        const op = node.children.find(c => c.text === ":=" || c.text === "=")?.text || "=";
        return `export variable ${name} ${op} ${formatExpression(value)};`;
    }
    return `export variable ${name};`;
}

function formatIfStmt(node: SyntaxNode, depth: number, isElseIf: boolean = false): string {
    const cond = node.childForFieldName("cond");
    const thenBranch = node.childForFieldName("then");
    const elseBranch = node.childForFieldName("else");
    const thenIsBlock = thenBranch?.type === "block";

    // Find "then" keyword to get its row for trailing comment detection
    const thenKeyword = node.children.find(c => c.type === "then");
    const thenRow = thenKeyword?.startPosition.row ?? -1;

    // Collect comments between then and else early (needed for trailing comment handling)
    const elseComments: string[] = [];
    let thenTrailingComment = "";
    if (elseBranch) {
        for (const child of node.children) {
            if (child.type === "comment" || child.type === "line_comment") {
                if (child.startPosition.row >= (thenBranch?.endPosition.row ?? 0) &&
                    child.startPosition.row < elseBranch.startPosition.row) {
                    elseComments.push(normalizeComment(child.text));
                }
            }
        }
    }
    // Find trailing comment on "if ... then" line (same row as then, after then keyword)
    for (const child of node.children) {
        if ((child.type === "comment" || child.type === "line_comment") &&
            child.startPosition.row === thenRow &&
            thenKeyword && child.startPosition.column > thenKeyword.endPosition.column) {
            thenTrailingComment = ctx.indent + normalizeComment(child.text);
            break;
        }
    }

    // Condition starts after "if " or "else if "
    const condColumn = depth * ctx.indent.length + (isElseIf ? 8 : 3);
    // Extra length accounts for " then begin" (11 chars) after condition
    const extraLength = thenIsBlock ? 11 : 5; // " then begin" or " then"
    const formattedCond = formatExpression(cond, condColumn, extraLength);
    const condIsBroken = formattedCond.includes("\n");

    // If condition was broken across lines, put "then" on its own line
    let result: string;
    if (condIsBroken) {
        result = `if ${formattedCond}\n${ctx.indent.repeat(depth)}then` + thenTrailingComment;
    } else {
        result = `if ${formattedCond} then` + thenTrailingComment;
    }

    if (thenIsBlock) {
        result += " " + formatBlock(thenBranch, depth);
        // Comments between end and else: first as trailing, rest on own lines
        elseComments.forEach((comment, i) => {
            if (i === 0) {
                result += ctx.indent + comment;
            } else {
                result += "\n" + ctx.indent.repeat(depth) + comment;
            }
        });
    } else if (thenBranch) {
        result += "\n" + ctx.indent.repeat(depth + 1) + formatNode(thenBranch, depth + 1);
    }

    if (elseBranch) {
        const elseSep = (thenIsBlock && elseComments.length === 0) ? " " : "\n" + ctx.indent.repeat(depth);

        if (elseBranch.type === "if_stmt") {
            result += elseSep + "else " + formatIfStmt(elseBranch, depth, true);
        } else if (elseBranch.type === "block") {
            result += elseSep + "else " + formatBlock(elseBranch, depth);
        } else {
            result += elseSep + "else\n" + ctx.indent.repeat(depth + 1) + formatNode(elseBranch, depth + 1);
        }
    }

    return result;
}

function formatWhileStmt(node: SyntaxNode, depth: number): string {
    const cond = node.childForFieldName("cond");
    const body = node.childForFieldName("body");
    const bodyIsBlock = body?.type === "block";

    // Condition starts after "while " at column depth*indent + 6
    const condColumn = depth * ctx.indent.length + 6;
    // Extra length accounts for " do begin" (9 chars) or " do" (3 chars)
    const extraLength = bodyIsBlock ? 9 : 3;
    const formattedCond = formatExpression(cond, condColumn, extraLength);
    const condIsBroken = formattedCond.includes("\n");

    // If condition was broken across lines, put "do" on its own line
    let result: string;
    if (condIsBroken) {
        result = `while ${formattedCond}\n${ctx.indent.repeat(depth)}do`;
    } else {
        result = `while ${formattedCond} do`;
    }

    if (bodyIsBlock) {
        result += " " + formatBlock(body, depth);
    } else if (body) {
        result += "\n" + ctx.indent.repeat(depth + 1) + formatNode(body, depth + 1);
    }

    return result;
}

function formatForStmt(node: SyntaxNode, depth: number): string {
    const init = node.childForFieldName("init");
    const cond = node.childForFieldName("cond");
    const update = node.childForFieldName("update");
    const body = node.childForFieldName("body");

    const initStr = init ? formatExpression(init) : "";
    const condStr = cond ? formatExpression(cond) : "";
    const updateStr = update ? formatExpression(update) : "";

    let result = `for (${initStr}; ${condStr}; ${updateStr})`;

    if (body?.type === "block") {
        result += " " + formatBlock(body, depth);
    } else if (body) {
        result += "\n" + ctx.indent.repeat(depth + 1) + formatNode(body, depth + 1);
    }

    return result;
}

function formatForeachStmt(node: SyntaxNode, depth: number): string {
    const varNode = node.childForFieldName("var");
    const keyNode = node.childForFieldName("key");
    const valueNode = node.childForFieldName("value");
    const hasVariable = node.children.some(c => c.text === "variable");
    const iter = node.childForFieldName("iter");
    const body = node.childForFieldName("body");

    let header: string;
    const varPrefix = hasVariable ? "variable " : "";
    if (keyNode && valueNode) {
        header = `foreach (${varPrefix}${keyNode.text}: ${valueNode.text} in ${formatExpression(iter)})`;
    } else if (keyNode) {
        header = `foreach (${varPrefix}${keyNode.text} in ${formatExpression(iter)})`;
    } else if (varNode) {
        header = `foreach ${varNode.text} in ${formatExpression(iter)}`;
    } else {
        header = `foreach in ${formatExpression(iter)}`;
    }

    if (body?.type === "block") {
        return header + " " + formatBlock(body, depth);
    } else if (body) {
        return header + "\n" + ctx.indent.repeat(depth + 1) + formatNode(body, depth + 1);
    }

    return header;
}

function formatSwitchStmt(node: SyntaxNode, depth: number): string {
    const value = node.childForFieldName("value");
    const parts: string[] = [`switch ${formatExpression(value)} begin`];

    for (const child of node.children) {
        if (child.type === "case_clause") {
            parts.push(formatCaseClause(child, depth + 1));
        } else if (child.type === "default_clause") {
            parts.push(formatDefaultClause(child, depth + 1));
        }
    }

    parts.push(ctx.indent.repeat(depth) + "end");
    return parts.join("\n");
}

function formatClauseBody(node: SyntaxNode, depth: number, skipTypes: Set<string>, skipNode?: SyntaxNode): string[] {
    const stmts: string[] = [];
    const skipPos = skipNode?.startPosition;

    for (const child of node.children) {
        if (skipTypes.has(child.type)) continue;
        if (skipPos && child.startPosition.row === skipPos.row &&
            child.startPosition.column === skipPos.column) continue;

        const formatted = formatNode(child, depth + 1);
        if (formatted.trim()) {
            stmts.push(ctx.indent.repeat(depth + 1) + formatted);
        }
    }
    return stmts;
}

function formatCaseClause(node: SyntaxNode, depth: number): string {
    const value = node.childForFieldName("value");
    const stmts = formatClauseBody(node, depth, new Set(["case", ":"]), value ?? undefined);
    const header = ctx.indent.repeat(depth) + `case ${formatExpression(value)}:`;
    return stmts.length > 0 ? header + "\n" + stmts.join("\n") : header;
}

function formatDefaultClause(node: SyntaxNode, depth: number): string {
    const stmts = formatClauseBody(node, depth, new Set(["default", ":"]));
    const header = ctx.indent.repeat(depth) + "default:";
    return stmts.length > 0 ? header + "\n" + stmts.join("\n") : header;
}

function formatCallStmt(node: SyntaxNode): string {
    const target = node.childForFieldName("target");
    const delay = node.childForFieldName("delay");

    if (!target) return node.text;

    let result = "call ";
    if (target.type === "call_expr") {
        result += formatCallExpr(target);
    } else {
        result += target.text;
    }

    if (delay) {
        result += ` in ${formatExpression(delay)}`;
    }

    return result + ";";
}

function formatAssignment(node: SyntaxNode): string {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");

    let op = "=";
    for (const child of node.children) {
        if (["=", ":=", "+=", "-=", "*=", "/="].includes(child.text)) {
            op = child.text;
            break;
        }
    }

    return `${formatExpression(left)} ${op} ${formatExpression(right)};`;
}

function formatExpressionStmt(node: SyntaxNode, depth: number): string {
    const expr = node.children.find(c => c.type !== ";");
    if (!expr) return "";

    const hasSemicolon = node.children.some(c => c.text === ";");
    const column = depth * ctx.indent.length;
    return formatExpression(expr, column) + (hasSemicolon ? ";" : "");
}

function formatBlock(node: SyntaxNode, depth: number): string {
    const stmts: string[] = [];
    const children = node.children;
    let beginComment = "";
    let endComment = "";

    // Check if first non-begin child is a comment on same line as begin
    const blockStartRow = node.startPosition.row;
    const blockEndRow = node.endPosition.row;

    // Find trailing comment on end
    for (const child of children) {
        if (isComment(child) && child.startPosition.row === blockEndRow) {
            endComment = ctx.indent + normalizeComment(child.text);
            break;
        }
    }

    children.forEach((child, i) => {
        const nextChild = children[i + 1]; // undefined at end
        const prevChild = children[i - 1]; // undefined at start

        if (child.text.match(BEGIN_END_REGEX)) {
            return;
        }

        // Check if this is a comment on same line as begin
        if (isComment(child) && child.startPosition.row === blockStartRow) {
            beginComment = ctx.indent + normalizeComment(child.text);
            return;
        }

        // Skip comment on same line as end (handled separately)
        if (isComment(child) && child.startPosition.row === blockEndRow) {
            return;
        }

        const trailingComment = hasTrailingComment(child, nextChild);

        if (isComment(child)) {
            // Skip if already appended as trailing comment
            if (prevChild && prevChild.endPosition.row === child.startPosition.row) {
                return;
            }
            stmts.push(ctx.indent.repeat(depth + 1) + normalizeComment(child.text));
        } else {
            let formatted = formatNode(child, depth + 1);
            if (trailingComment && nextChild) {
                formatted += ctx.indent + normalizeComment(nextChild.text);
            }
            if (formatted.trim()) {
                stmts.push(ctx.indent.repeat(depth + 1) + formatted);
            }
        }
    });

    if (stmts.length === 0) {
        return `begin${beginComment}\nend${endComment}`;
    }

    return `begin${beginComment}\n${stmts.join("\n")}\n${ctx.indent.repeat(depth)}end${endComment}`;
}

function formatExpression(node: SyntaxNode | null | undefined, column: number = 0, extraLength: number = 0): string {
    if (!node) return "";

    // Handle ERROR nodes: preserve original text
    if (node.type === "ERROR") {
        return node.text;
    }

    switch (node.type) {
        case "binary_expr":
            return formatBinaryExpr(node, column, extraLength);
        case "unary_expr":
            return formatUnaryExpr(node);
        case "ternary_expr":
            return formatTernaryExpr(node);
        case "call_expr":
            return formatCallExpr(node, column, extraLength);
        case "subscript_expr":
            return formatSubscriptExpr(node);
        case "member_expr":
            return formatMemberExpr(node);
        case "paren_expr": {
            const inner = node.children[1];
            if (!inner || inner.type === "comment" || inner.type === "line_comment") {
                throwFormatError(
                    `Unexpected paren_expr structure: ${node.text}`,
                    node.startPosition.row + 1,
                    node.startPosition.column + 1,
                );
            }
            return `(${formatExpression(inner, column + 1, extraLength > 0 ? extraLength - 1 : 0)})`;
        }
        case "array_expr":
            return formatArrayExpr(node, column, extraLength);
        case "map_expr":
            return formatMapExpr(node, column, extraLength);
        case "proc_ref": {
            const ident = node.children[1];
            if (!ident || ident.type !== "identifier") {
                throwFormatError(
                    `Unexpected proc_ref structure: ${node.text}`,
                    node.startPosition.row + 1,
                    node.startPosition.column + 1,
                );
            }
            return `@${ident.text}`;
        }
        case "identifier":
            if (isReservedWord(node.text)) {
                throwFormatError(
                    `Reserved word "${node.text}" cannot be used as identifier`,
                    node.startPosition.row + 1,
                    node.startPosition.column + 1,
                );
            }
            return node.text;
        case "number":
        case "boolean":
        case "string":
            return node.text;
        case "for_var_decl": {
            const name = node.childForFieldName("name");
            const value = node.childForFieldName("value");
            if (!name || !value) {
                throwFormatError(
                    `Malformed for_var_decl: ${node.text}`,
                    node.startPosition.row + 1,
                    node.startPosition.column + 1,
                );
            }
            return `variable ${name.text} = ${formatExpression(value)}`;
        }
        default:
            return node.text;
    }
}

// Get operator from binary expression
function getBinaryOp(node: SyntaxNode): string {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    if (left && right) {
        for (const child of node.children) {
            if (isComment(child)) continue;
            if (child.startIndex >= left.endIndex && child.endIndex <= right.startIndex) {
                return child.text;
            }
        }
    }
    return "";
}

// Flatten a chain of binary expressions with the same operator (e.g., a or b or c)
function flattenBinaryChain(node: SyntaxNode, op: string): SyntaxNode[] {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    const operands: SyntaxNode[] = [];

    if (left?.type === "binary_expr" && getBinaryOp(left) === op) {
        operands.push(...flattenBinaryChain(left, op));
    } else if (left) {
        operands.push(left);
    }

    if (right?.type === "binary_expr" && getBinaryOp(right) === op) {
        operands.push(...flattenBinaryChain(right, op));
    } else if (right) {
        operands.push(right);
    }

    return operands;
}

function formatBinaryExpr(node: SyntaxNode, column: number = 0, extraLength: number = 0): string {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    const op = getBinaryOp(node);

    // For logical/bitwise chains, try compact first then break if too long
    const breakableOps = ["or", "and", "bwor", "bwand", "bwxor"];
    if (breakableOps.includes(op)) {
        const operands = flattenBinaryChain(node, op);
        // Try compact first - format without column info for length check
        const compactOperands = operands.map(o => formatExpression(o));
        const compact = compactOperands.join(` ${op} `);

        // Check if compact version fits (including any suffix like " then begin")
        if (column + compact.length + extraLength <= ctx.maxLineLength) {
            return compact;
        }

        // Break before each operator, indent to align with first operand
        // Re-format operands with proper column info for nested breaking
        const opIndent = column + op.length + 1; // "op " prefix for subsequent operands
        const formattedOperands = operands.map((o, i) => {
            const opColumn = i === 0 ? column : opIndent;
            return formatExpression(o, opColumn);
        });
        const indent = " ".repeat(column);
        return formattedOperands.join(`\n${indent}${op} `);
    }

    // Non-breaking: pass column to left, calculate right's column based on left + op
    const formattedLeft = formatExpression(left, column);
    const rightColumn = column + formattedLeft.length + op.length + 2; // " op "
    return `${formattedLeft} ${op} ${formatExpression(right, rightColumn)}`;
}

function formatUnaryExpr(node: SyntaxNode): string {
    const op = node.childForFieldName("op")?.text || "";
    const expr = node.childForFieldName("expr");

    if (node.children[0]?.text === "++" || node.children[0]?.text === "--") {
        return `${op}${formatExpression(expr)}`;
    } else if (node.children[1]?.text === "++" || node.children[1]?.text === "--") {
        return `${formatExpression(expr)}${op}`;
    }

    // No space for unary minus on numbers, space for not/bnot
    if (op === "-") {
        return `${op}${formatExpression(expr)}`;
    }
    return `${op} ${formatExpression(expr)}`;
}

function formatTernaryExpr(node: SyntaxNode): string {
    const trueValue = node.childForFieldName("true_value");
    const cond = node.childForFieldName("cond");
    const falseValue = node.childForFieldName("false_value");

    return `${formatExpression(trueValue)} if ${formatExpression(cond)} else ${formatExpression(falseValue)}`;
}

function formatCallExpr(node: SyntaxNode, column: number = 0, extraLength: number = 0): string {
    const func = node.childForFieldName("func");
    const funcName = func?.text || "";
    // namedChildren[0] is the func, rest are args; skip inline block comments
    const argNodes = node.namedChildren.slice(1).filter(c => c.type !== "comment");
    const args = argNodes.map(a => formatExpression(a));

    const compact = `${funcName}(${args.join(", ")})`;

    // Check if compact version fits (including any suffix)
    if (column + compact.length + extraLength <= ctx.maxLineLength || args.length <= 1) {
        return compact;
    }

    // Break after each comma, indent to align after opening paren
    const indent = " ".repeat(column + funcName.length + 1);
    return `${funcName}(${args.join(",\n" + indent)})`;
}

function formatSubscriptExpr(node: SyntaxNode): string {
    const obj = node.childForFieldName("object");
    const index = node.childForFieldName("index");
    return `${formatExpression(obj)}[${formatExpression(index)}]`;
}

function formatMemberExpr(node: SyntaxNode): string {
    const obj = node.childForFieldName("object");
    const member = node.childForFieldName("member");
    return `${formatExpression(obj)}.${member?.text || ""}`;
}

function formatArrayExpr(node: SyntaxNode, column: number = 0, extraLength: number = 0): string {
    const elements: string[] = [];
    for (const child of node.children) {
        if (child.type !== "[" && child.type !== "]" && child.type !== ",") {
            elements.push(formatExpression(child));
        }
    }

    const compact = `[${elements.join(", ")}]`;

    // Check if compact version fits (including any suffix)
    if (column + compact.length + extraLength <= ctx.maxLineLength || elements.length <= 1) {
        return compact;
    }

    // Break after each comma, indent to align after opening bracket
    const indent = " ".repeat(column + 1);
    return `[${elements.join(",\n" + indent)}]`;
}

function formatMapExpr(node: SyntaxNode, column: number = 0, extraLength: number = 0): string {
    const entries: string[] = [];
    for (const child of node.children) {
        if (child.type === "map_entry") {
            const key = child.childForFieldName("key");
            const value = child.childForFieldName("value");
            entries.push(`${formatExpression(key)}: ${formatExpression(value)}`);
        }
    }

    const compact = `{${entries.join(", ")}}`;

    // Check if compact version fits (including any suffix)
    if (column + compact.length + extraLength <= ctx.maxLineLength || entries.length <= 1) {
        return compact;
    }

    // Break after each comma, indent to align after opening brace
    const indent = " ".repeat(column + 1);
    return `{${entries.join(",\n" + indent)}}`;
}
