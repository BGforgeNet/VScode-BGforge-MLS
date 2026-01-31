/**
 * TD Parser helpers - utility functions for expression evaluation,
 * argument validation, and parsing arrays/states/options.
 *
 * These are extracted from TDParser as standalone functions that
 * receive parser context (vars map) as a parameter.
 */

import {
    ArrayLiteralExpression,
    Expression,
    Node,
    SyntaxKind,
} from "ts-morph";
import * as utils from "../transpiler-utils";
import type { VarsContext } from "../transpiler-utils";

/**
 * Evaluate an expression to a string value for variable storage.
 */
function evaluateExpression(expr: Expression, vars: VarsContext): string | undefined {
    if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
        const elements = (expr as ArrayLiteralExpression)
            .getElements()
            .map(e => e.getText());
        return `[${elements.join(", ")}]`;
    }

    if (expr.isKind(SyntaxKind.StringLiteral) || expr.isKind(SyntaxKind.NumericLiteral)) {
        return expr.getText();
    }

    if (expr.isKind(SyntaxKind.Identifier)) {
        const name = expr.getText();
        return vars.get(name);
    }

    return expr.getText();
}

/**
 * Resolve an array expression to its string elements.
 */
function resolveArrayElements(expr: Expression, vars: VarsContext): string[] | null {
    if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
        // Use flattenArrayElements to support spread expressions
        return utils.flattenArrayElements(expr as ArrayLiteralExpression, vars);
    }

    if (expr.isKind(SyntaxKind.Identifier)) {
        const name = expr.getText();
        const value = vars.get(name);
        if (value && value.startsWith("[") && value.endsWith("]")) {
            // Use parseArrayLiteral to handle nested arrays correctly
            return utils.parseArrayLiteral(value);
        }
    }

    return null;
}

/**
 * Resolve an expression to its string value.
 * Handles string literals and variable references.
 */
function resolveStringExpr(expr: Expression, vars: VarsContext): string {
    if (Node.isStringLiteral(expr)) {
        return utils.stripQuotes(expr.getText());
    }
    if (Node.isIdentifier(expr)) {
        const name = expr.getText();
        const value = vars.get(name);
        if (value !== undefined) {
            return utils.stripQuotes(value);
        }
        return name;
    }
    return utils.stripQuotes(expr.getText());
}

/**
 * Convert an expression to a D action string.
 * Function calls are serialized as FunctionName(arg1,arg2,...).
 */
function expressionToActionString(expr: Expression, vars: VarsContext): string {
    if (Node.isCallExpression(expr)) {
        const funcName = expr.getExpression().getText();
        const args = expr.getArguments();
        const argStrings = args.map(a => expressionToActionString(a as Expression, vars));
        return `${funcName}(${argStrings.join(",")})`;
    }

    if (Node.isStringLiteral(expr)) {
        // Keep quotes for string arguments
        return expr.getText();
    }

    if (Node.isNumericLiteral(expr)) {
        return expr.getText();
    }

    if (Node.isIdentifier(expr)) {
        // Could be a constant or identifier - substitute if known
        const name = expr.getText();
        const value = vars.get(name);
        return value ?? name;
    }

    // Fallback to raw text
    return utils.substituteVars(expr.getText(), vars);
}

/**
 * Validate function call has required number of arguments.
 */
function validateArgs(funcName: string, args: Node[], minArgs: number, lineNumber: number) {
    if (args.length < minArgs) {
        const argWord = minArgs === 1 ? "argument" : "arguments";
        throw new Error(`${funcName}() requires at least ${minArgs} ${argWord} at ${lineNumber}`);
    }
}

/**
 * Parse a state list (array of strings/numbers or single value).
 */
function parseStateList(expr: Expression, vars: VarsContext): (string | number)[] {
    if (Node.isArrayLiteralExpression(expr)) {
        return expr.getElements().map((e) => {
            const text = e.getText();
            // Check if it's a number or string
            if (/^\d+$/.test(text)) {
                return Number(text);
            }
            return resolveStringExpr(e as Expression, vars);
        });
    }

    // Single value
    const text = expr.getText();
    if (/^\d+$/.test(text)) {
        return [Number(text)];
    }
    return [resolveStringExpr(expr, vars)];
}

/**
 * Parse an array of numbers.
 */
function parseNumberArray(expr: Expression): number[] {
    if (!Node.isArrayLiteralExpression(expr)) {
        throw new Error(`Expected array of numbers at ${expr.getStartLineNumber()}`);
    }

    return expr.getElements().map((e) => Number(e.getText()));
}

/**
 * Parse unless option (can be string or object with { unless: "..." }).
 */
function parseUnless(expr: Expression): string | undefined {
    if (Node.isObjectLiteralExpression(expr)) {
        for (const prop of expr.getProperties()) {
            if (Node.isPropertyAssignment(prop) && prop.getName() === "unless") {
                const value = prop.getInitializer();
                if (value) {
                    return utils.stripQuotes(value.getText());
                }
            }
        }
        return undefined;
    }

    return utils.stripQuotes(expr.getText());
}


export {
    evaluateExpression,
    resolveArrayElements,
    resolveStringExpr,
    expressionToActionString,
    validateArgs,
    parseStateList,
    parseNumberArray,
    parseUnless,
};
