/**
 * Shared utilities for TypeScript-based transpilers (TBAF and TD)
 *
 * These utilities handle common compile-time operations like variable substitution,
 * loop unrolling, and function parameter mapping.
 */

import { Block, CallExpression, Expression, FunctionDeclaration, Statement, SyntaxKind } from "ts-morph";

/** Variable substitution context - maps variable names to their compile-time values */
export type VarsContext = Map<string, string>;

/**
 * Substitute all occurrences of variables in text with their compile-time values.
 * Uses word boundary regex to avoid partial matches.
 *
 * @example
 * vars.set("count", "5");
 * substituteVars("i < count", vars) // => "i < 5"
 */
export function substituteVars(text: string, vars: VarsContext): string {
    let result = text;
    vars.forEach((value, key) => {
        result = result.replace(new RegExp(`\\b${key}\\b`, "g"), value);
    });
    return result;
}

/**
 * Parse for loop increment/decrement syntax to a numeric step value.
 * Supports: ++, --, +=N, -=N
 *
 * @example
 * parseIncrement("i++")     // => 1
 * parseIncrement("i--")     // => -1
 * parseIncrement("i += 5")  // => 5
 * parseIncrement("i -= 3")  // => -3
 */
export function parseIncrement(text: string): number {
    if (text.includes("++")) return 1;
    if (text.includes("--")) return -1;
    if (text.includes("+=")) return Number(text.split("+=")[1]) || 1;
    if (text.includes("-=")) return -(Number(text.split("-=")[1]) || 1);
    return 1;
}

/**
 * Build parameter substitution map for function inlining.
 * Maps parameter names to argument values (or default values).
 *
 * @param call The function call expression
 * @param func The function declaration being called
 * @param vars Variable context for substituting argument expressions
 * @returns Map from parameter name to substituted argument value
 */
export function buildParamMap(
    call: CallExpression,
    func: FunctionDeclaration,
    vars: VarsContext
): Map<string, string> {
    const params = func.getParameters();
    const args = call.getArguments();
    const map = new Map<string, string>();

    params.forEach((param, i) => {
        const name = param.getName();
        const arg = args[i];
        const value = arg?.getText() || param.getInitializer()?.getText() || "";
        map.set(name, substituteVars(value, vars));
    });

    return map;
}

/**
 * Evaluate a loop condition at compile time using JavaScript evaluation.
 * Substitutes the loop variable and other compile-time constants before evaluation.
 *
 * @param condition The loop condition expression as text (e.g., "i < 10")
 * @param loopVar The loop variable name (e.g., "i")
 * @param value Current value of the loop variable
 * @param vars Variable context for other compile-time constants
 * @returns True if the loop should continue, false otherwise
 * @throws Error if the condition cannot be evaluated
 *
 * @example
 * evaluateCondition("i < count", "i", 5, new Map([["count", "10"]])) // => true
 */
export function evaluateCondition(
    condition: string,
    loopVar: string,
    value: number,
    vars: VarsContext
): boolean {
    // Substitute loop variable
    let substituted = condition.replace(new RegExp(`\\b${loopVar}\\b`, "g"), value.toString());
    // Substitute other compile-time variables
    substituted = substituteVars(substituted, vars);

    try {
        // Use Function constructor to evaluate the condition
        // This is safe because we're in a compile-time context, not runtime
        const fn = new Function(`return (${substituted});`);
        return fn();
    } catch (e) {
        throw new Error(
            `Cannot evaluate loop condition "${condition}" with ${loopVar}=${value}. ` +
            `Substituted: "${substituted}". Error: ${e instanceof Error ? e.message : e}`
        );
    }
}

/**
 * Evaluate an expression to a numeric value at compile time.
 * Substitutes variables before parsing to number.
 *
 * @param expr The expression to evaluate (or undefined)
 * @param vars Variable context for substitution
 * @returns The numeric value, or undefined if not a valid number
 *
 * @example
 * vars.set("size", "42");
 * evaluateNumeric(expr, vars) // => 42 if expr is "size"
 */
export function evaluateNumeric(expr: Expression | undefined, vars: VarsContext): number | undefined {
    if (!expr) return undefined;

    const text = substituteVars(expr.getText(), vars);
    const num = Number(text);
    return isNaN(num) ? undefined : num;
}

/**
 * Get statements from a statement, handling both blocks and single statements.
 * If the statement is a block, returns all statements in the block.
 * Otherwise, returns a single-element array with the statement.
 *
 * @param stmt A statement (could be a block or single statement)
 * @returns Array of statements
 *
 * @example
 * // if (x) doSomething(); => [ExpressionStatement]
 * // if (x) { a(); b(); } => [ExpressionStatement, ExpressionStatement]
 */
export function getBlockStatements(stmt: Statement): Statement[] {
    if (stmt.isKind(SyntaxKind.Block)) {
        return (stmt as Block).getStatements();
    }
    return [stmt];
}

/**
 * Strip quotes from a string literal.
 * Removes leading and trailing quotes (single, double, or backtick).
 *
 * @param text String potentially wrapped in quotes
 * @returns String without leading/trailing quotes
 *
 * @example
 * stripQuotes('"hello"')  // => "hello"
 * stripQuotes("'world'")  // => "world"
 * stripQuotes('`test`')   // => "test"
 * stripQuotes('plain')    // => "plain"
 */
export function stripQuotes(text: string): string {
    return text.replace(/^["'`]|["'`]$/g, "");
}

/** Maximum loop iterations to prevent infinite loops during compile-time unrolling */
export const MAX_LOOP_ITERATIONS = 1000;
