/**
 * Core formatting logic for Fallout SSL files.
 * Shared between LSP server and CLI.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";

// Optional logger - set by LSP, CLI uses console
type Logger = (_msg: string) => void;
let log: Logger = console.error;

export function setLogger(logger: Logger): void {
    log = logger;
}

// Formatting options
export interface FormatOptions {
    indentSize: number;
}

const DEFAULT_OPTIONS: FormatOptions = {
    indentSize: 4,
};

// Computed from options
let INDENT = "    ";

// Regex patterns for keyword matching
const BEGIN_END_REGEX = /^(begin|end)$/i;
const BEGIN_END_PROCEDURE_REGEX = /^(begin|end|procedure)$/i;

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
        const [, code, , comment] = lineCommentMatch;
        return code.trimEnd() + INDENT + normalizeComment(comment);
    }
    // Check for trailing block comment (single line only)
    const blockCommentMatch = text.match(/^(.+?)(\s*)(\/\*[^]*?\*\/)$/);
    if (blockCommentMatch && !blockCommentMatch[3].includes("\n")) {
        const [, code, , comment] = blockCommentMatch;
        return code.trimEnd() + INDENT + normalizeComment(comment);
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


export function formatDocument(node: SyntaxNode, options: FormatOptions = DEFAULT_OPTIONS): string {
    // Set indent based on options
    INDENT = " ".repeat(options.indentSize);
    return formatNode(node, 0);
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
            return content.replace(/\t/g, INDENT).replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
        }
        case "preprocessor":
            return normalizePreprocessor(node.text);
        case "comment":
        case "line_comment":
            return normalizeComment(node.text);
        case "procedure_forward":
            return formatProcedureForward(node);
        case "procedure":
            return formatProcedure(node, depth);
        case "variable_decl":
            return formatVariableDecl(node);
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
            return `return${expr ? " " + formatExpression(expr) : ""};`;
        }
        case "call_stmt":
            return formatCallStmt(node);
        case "assignment":
            return formatAssignment(node);
        case "expression_stmt":
            return formatExpressionStmt(node);
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

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const prevChild = children[i - 1];
        const nextChild = children[i + 1];

        const hadBlankLineBefore = prevChild && (child.startPosition.row - prevChild.endPosition.row > 1);
        const trailingComment = hasTrailingComment(child, nextChild);

        if (isComment(child)) {
            // Skip if already appended as trailing comment
            if (prevChild && prevChild.endPosition.row === child.startPosition.row) {
                continue;
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
            parts.push(normalizePreprocessor(child.text));
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
            if (trailingComment) {
                formatted += INDENT + normalizeComment(nextChild.text);
            }
            parts.push(formatted);
            needsBlankLine = true;
        } else {
            if (needsBlankLine && parts.length > 0) {
                parts.push("");
                needsBlankLine = false;
            }
            let formatted = formatNode(child, depth);
            if (trailingComment) {
                formatted += INDENT + normalizeComment(nextChild.text);
            }
            parts.push(formatted);
        }
    }

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

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const nextChild = children[i + 1];

        if (skipTypes.has(child.type)) continue;
        if (BEGIN_END_PROCEDURE_REGEX.test(child.text)) continue;
        if (child.type.includes("procedure")) continue;

        const trailingComment = hasTrailingComment(child, nextChild);

        if (isComment(child)) {
            // Skip if already appended as trailing comment
            if (i > 0 && children[i - 1].endPosition.row === child.startPosition.row) {
                continue;
            }
            bodyParts.push(INDENT + normalizeComment(child.text));
        } else {
            let formatted = formatNode(child, depth + 1);
            if (trailingComment) {
                formatted += INDENT + normalizeComment(nextChild.text);
            }
            if (formatted.trim()) {
                bodyParts.push(INDENT + formatted);
            }
        }
    }

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

function formatVariableDecl(node: SyntaxNode): string {
    const hasBegin = node.children.some(c => c.text.match(/^begin$/i));
    if (hasBegin) {
        const vars: string[] = [];
        for (const child of node.children) {
            if (child.type === "var_init") {
                vars.push(INDENT + formatVarInit(child) + ";");
            }
        }
        return `variable begin\n${vars.join("\n")}\nend`;
    }

    const hasImport = node.children.some(c => c.text === "import");
    const varInits: string[] = [];
    for (const child of node.children) {
        if (child.type === "var_init") {
            varInits.push(formatVarInit(child));
        }
    }

    const prefix = hasImport ? "import variable " : "variable ";
    return `${prefix}${varInits.join(", ")};`;
}

function formatVarInit(node: SyntaxNode): string {
    const name = node.childForFieldName("name")?.text || "";
    const size = node.childForFieldName("size");
    const value = node.childForFieldName("value");

    let result = name;
    if (size) {
        result += `[${formatExpression(size)}]`;
    }
    if (value) {
        result += ` = ${formatExpression(value)}`;
    }
    return result;
}

function formatExportDecl(node: SyntaxNode): string {
    const name = node.childForFieldName("name")?.text || "";
    const value = node.childForFieldName("value");
    if (value) {
        return `export variable ${name} = ${formatExpression(value)};`;
    }
    return `export variable ${name};`;
}

function formatIfStmt(node: SyntaxNode, depth: number): string {
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
            thenTrailingComment = "    " + normalizeComment(child.text);
            break;
        }
    }

    let result = `if ${formatExpression(cond)} then` + thenTrailingComment;

    if (thenIsBlock) {
        result += " " + formatBlock(thenBranch, depth);
        // Comments between end and else: first as trailing, rest on own lines
        for (let i = 0; i < elseComments.length; i++) {
            if (i === 0) {
                result += "    " + elseComments[i];
            } else {
                result += "\n" + INDENT.repeat(depth) + elseComments[i];
            }
        }
    } else if (thenBranch) {
        result += "\n" + INDENT.repeat(depth + 1) + formatNode(thenBranch, depth + 1);
    }

    if (elseBranch) {
        const elseSep = (thenIsBlock && elseComments.length === 0) ? " " : "\n" + INDENT.repeat(depth);

        if (elseBranch.type === "if_stmt") {
            result += elseSep + "else " + formatIfStmt(elseBranch, depth);
        } else if (elseBranch.type === "block") {
            result += elseSep + "else " + formatBlock(elseBranch, depth);
        } else {
            result += elseSep + "else\n" + INDENT.repeat(depth + 1) + formatNode(elseBranch, depth + 1);
        }
    }

    return result;
}

function formatWhileStmt(node: SyntaxNode, depth: number): string {
    const cond = node.childForFieldName("cond");
    const body = node.childForFieldName("body");

    let result = `while ${formatExpression(cond)} do`;

    if (body?.type === "block") {
        result += " " + formatBlock(body, depth);
    } else if (body) {
        result += "\n" + INDENT.repeat(depth + 1) + formatNode(body, depth + 1);
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
        result += "\n" + INDENT.repeat(depth + 1) + formatNode(body, depth + 1);
    }

    return result;
}

function formatForeachStmt(node: SyntaxNode, depth: number): string {
    const varNode = node.childForFieldName("var");
    const keyNode = node.childForFieldName("key");
    const valueNode = node.childForFieldName("value");
    const iter = node.childForFieldName("iter");
    const body = node.childForFieldName("body");

    let header: string;
    if (keyNode && valueNode) {
        header = `foreach (${keyNode.text}: ${valueNode.text} in ${formatExpression(iter)})`;
    } else if (keyNode) {
        header = `foreach (${keyNode.text} in ${formatExpression(iter)})`;
    } else if (varNode) {
        header = `foreach ${varNode.text} in ${formatExpression(iter)}`;
    } else {
        header = `foreach in ${formatExpression(iter)}`;
    }

    if (body?.type === "block") {
        return header + " " + formatBlock(body, depth);
    } else if (body) {
        return header + "\n" + INDENT.repeat(depth + 1) + formatNode(body, depth + 1);
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

    parts.push(INDENT.repeat(depth) + "end");
    return parts.join("\n");
}

function formatCaseClause(node: SyntaxNode, depth: number): string {
    const value = node.childForFieldName("value");
    const stmts: string[] = [];

    // Compare by position since childForFieldName may return different object
    const valuePos = value?.startPosition;
    for (const child of node.children) {
        if (child.type === "case" || child.type === ":") continue;
        if (valuePos && child.startPosition.row === valuePos.row &&
            child.startPosition.column === valuePos.column) continue;

        const formatted = formatNode(child, depth + 1);
        if (formatted.trim()) {
            stmts.push(INDENT.repeat(depth + 1) + formatted);
        }
    }

    const header = INDENT.repeat(depth) + `case ${formatExpression(value)}:`;
    if (stmts.length > 0) {
        return header + "\n" + stmts.join("\n");
    }
    return header;
}

function formatDefaultClause(node: SyntaxNode, depth: number): string {
    const stmts: string[] = [];

    for (const child of node.children) {
        if (child.type !== "default" && child.type !== ":") {
            const formatted = formatNode(child, depth + 1);
            if (formatted.trim()) {
                stmts.push(INDENT.repeat(depth + 1) + formatted);
            }
        }
    }

    const header = INDENT.repeat(depth) + "default:";
    if (stmts.length > 0) {
        return header + "\n" + stmts.join("\n");
    }
    return header;
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

function formatExpressionStmt(node: SyntaxNode): string {
    const expr = node.children.find(c => c.type !== ";");
    if (!expr) return "";

    const hasSemicolon = node.children.some(c => c.text === ";");
    return formatExpression(expr) + (hasSemicolon ? ";" : "");
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
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isComment(child) && child.startPosition.row === blockEndRow) {
            endComment = INDENT + normalizeComment(child.text);
            break;
        }
    }

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const nextChild = children[i + 1];

        if (child.text.match(BEGIN_END_REGEX)) {
            continue;
        }

        // Check if this is a comment on same line as begin
        if (isComment(child) && child.startPosition.row === blockStartRow) {
            beginComment = INDENT + normalizeComment(child.text);
            continue;
        }

        // Skip comment on same line as end (handled separately)
        if (isComment(child) && child.startPosition.row === blockEndRow) {
            continue;
        }

        const trailingComment = hasTrailingComment(child, nextChild);

        if (isComment(child)) {
            // Skip if already appended as trailing comment
            if (i > 0 && children[i - 1].endPosition.row === child.startPosition.row) {
                continue;
            }
            stmts.push(INDENT.repeat(depth + 1) + normalizeComment(child.text));
        } else {
            let formatted = formatNode(child, depth + 1);
            if (trailingComment) {
                formatted += INDENT + normalizeComment(nextChild.text);
            }
            if (formatted.trim()) {
                stmts.push(INDENT.repeat(depth + 1) + formatted);
            }
        }
    }

    if (stmts.length === 0) {
        return `begin${beginComment}\nend${endComment}`;
    }

    return `begin${beginComment}\n${stmts.join("\n")}\n${INDENT.repeat(depth)}end${endComment}`;
}

function formatExpression(node: SyntaxNode | null | undefined): string {
    if (!node) return "";

    // Handle ERROR nodes: preserve original text
    if (node.type === "ERROR") {
        return node.text;
    }

    switch (node.type) {
        case "binary_expr":
            return formatBinaryExpr(node);
        case "unary_expr":
            return formatUnaryExpr(node);
        case "ternary_expr":
            return formatTernaryExpr(node);
        case "call_expr":
            return formatCallExpr(node);
        case "subscript_expr":
            return formatSubscriptExpr(node);
        case "member_expr":
            return formatMemberExpr(node);
        case "paren_expr": {
            const inner = node.children[1];
            if (!inner || inner.type === "comment" || inner.type === "line_comment") {
                log(`format: unexpected paren_expr structure: ${node.text}`);
                return node.text;
            }
            return `(${formatExpression(inner)})`;
        }
        case "array_expr":
            return formatArrayExpr(node);
        case "map_expr":
            return formatMapExpr(node);
        case "proc_ref": {
            const ident = node.children[1];
            if (!ident || ident.type !== "identifier") {
                log(`format: unexpected proc_ref structure: ${node.text}`);
                return node.text;
            }
            return `@${ident.text}`;
        }
        case "identifier":
        case "number":
        case "boolean":
        case "string":
            return node.text;
        case "for_var_decl": {
            const name = node.childForFieldName("name");
            const value = node.childForFieldName("value");
            if (!name) {
                log(`format: for_var_decl missing name: ${node.text}`);
                return node.text;
            }
            if (!value) {
                log(`format: for_var_decl missing value: ${node.text}`);
                return node.text;
            }
            return `variable ${name.text} = ${formatExpression(value)}`;
        }
        default:
            return node.text;
    }
}

function formatBinaryExpr(node: SyntaxNode): string {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    // Operator is between left and right positions (skip comments)
    let op = "";
    if (left && right) {
        for (const child of node.children) {
            if (isComment(child)) continue;
            // Operator starts at or after left ends, and ends at or before right starts
            if (child.startIndex >= left.endIndex && child.endIndex <= right.startIndex) {
                op = child.text;
                break;
            }
        }
    }

    return `${formatExpression(left)} ${op} ${formatExpression(right)}`;
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

function formatCallExpr(node: SyntaxNode): string {
    const func = node.childForFieldName("func");
    const funcName = func?.text || "";
    // namedChildren[0] is the func, rest are args; skip inline block comments
    const args = node.namedChildren.slice(1)
        .filter(c => c.type !== "comment")
        .map(formatExpression);

    return `${funcName}(${args.join(", ")})`;
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

function formatArrayExpr(node: SyntaxNode): string {
    const elements: string[] = [];
    for (const child of node.children) {
        if (child.type !== "[" && child.type !== "]" && child.type !== ",") {
            elements.push(formatExpression(child));
        }
    }
    return `[${elements.join(", ")}]`;
}

function formatMapExpr(node: SyntaxNode): string {
    const entries: string[] = [];
    for (const child of node.children) {
        if (child.type === "map_entry") {
            const key = child.childForFieldName("key");
            const value = child.childForFieldName("value");
            entries.push(`${formatExpression(key)}: ${formatExpression(value)}`);
        }
    }
    return `{${entries.join(", ")}}`;
}
