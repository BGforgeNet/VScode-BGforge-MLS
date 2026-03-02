/**
 * Unit tests for td/parse-helpers.ts - expression evaluation and parsing utilities.
 * Tests pure functions that convert ts-morph expressions to D syntax values.
 */

import { describe, expect, it } from "vitest";
import { Expression, Project, SyntaxKind } from "ts-morph";
import {
    evaluateExpression,
    resolveStringExpr,
    expressionToActionString,
    validateArgs,
    parseBooleanOption,
    parseStringOption,
    parseRequiredNumber,
    resolveArrayElements,
    parseStateList,
    parseUnless,
} from "../../src/td/parse-helpers";
import type { VarsContext } from "../../src/transpiler-utils";

// =============================================================================
// Test Helpers
// =============================================================================

const project = new Project({ useInMemoryFileSystem: true });

/** Create an Expression node from source code. Wraps in assignment to extract the RHS. */
function expr(code: string): Expression {
    const file = project.createSourceFile(
        `test_${Math.random()}.ts`,
        `const __x = ${code};`,
    );
    const decl = file.getVariableDeclarationOrThrow("__x");
    return decl.getInitializerOrThrow();
}

/** Create a Node from a statement. */
function stmtNode(code: string) {
    const file = project.createSourceFile(
        `test_${Math.random()}.ts`,
        code,
    );
    return file.getStatements()[0]!;
}

function vars(entries: Record<string, string>): VarsContext {
    return new Map(Object.entries(entries));
}

const emptyVars: VarsContext = new Map();

// =============================================================================
// evaluateExpression
// =============================================================================

describe("evaluateExpression", () => {
    it("evaluates string literals", () => {
        expect(evaluateExpression(expr('"hello"'), emptyVars)).toBe('"hello"');
    });

    it("evaluates numeric literals", () => {
        expect(evaluateExpression(expr("42"), emptyVars)).toBe("42");
    });

    it("resolves identifiers from vars", () => {
        expect(evaluateExpression(expr("myVar"), vars({ myVar: "100" }))).toBe("100");
    });

    it("returns undefined for unknown identifiers", () => {
        expect(evaluateExpression(expr("unknown"), emptyVars)).toBeUndefined();
    });

    it("evaluates array literals", () => {
        expect(evaluateExpression(expr("[1, 2, 3]"), emptyVars)).toBe("[1, 2, 3]");
    });

    it("unwraps 'as const' assertions", () => {
        const e = expr('"hello" as const');
        expect(evaluateExpression(e, emptyVars)).toBe('"hello"');
    });

    it("resolves tra() helper calls", () => {
        expect(evaluateExpression(expr("tra(100)"), emptyVars)).toBe("@100");
    });

    it("resolves obj() helper calls", () => {
        expect(evaluateExpression(expr('obj("[ANYONE]")'), emptyVars)).toBe("[ANYONE]");
    });

    it("resolves $tra() helper calls", () => {
        expect(evaluateExpression(expr("$tra(200)"), emptyVars)).toBe("@200");
    });

    it("returns raw text for unrecognized expressions", () => {
        const e = expr("a + b");
        expect(evaluateExpression(e, emptyVars)).toBe("a + b");
    });
});

// =============================================================================
// resolveStringExpr
// =============================================================================

describe("resolveStringExpr", () => {
    it("strips quotes from string literals", () => {
        expect(resolveStringExpr(expr('"hello"'), emptyVars)).toBe("hello");
    });

    it("resolves identifier from vars (stripped)", () => {
        expect(resolveStringExpr(expr("myVar"), vars({ myVar: '"world"' }))).toBe("world");
    });

    it("returns identifier name when not in vars", () => {
        expect(resolveStringExpr(expr("unknownId"), emptyVars)).toBe("unknownId");
    });

    it("falls back to stripped text for complex expressions", () => {
        expect(resolveStringExpr(expr('"test"'), emptyVars)).toBe("test");
    });
});

// =============================================================================
// expressionToActionString
// =============================================================================

describe("expressionToActionString", () => {
    it("converts tra() to @N", () => {
        expect(expressionToActionString(expr("tra(123)"), emptyVars)).toBe("@123");
    });

    it("converts $tra() to @N", () => {
        expect(expressionToActionString(expr("$tra(456)"), emptyVars)).toBe("@456");
    });

    it("converts tlk() to bare number", () => {
        expect(expressionToActionString(expr("tlk(789)"), emptyVars)).toBe("789");
    });

    it("converts obj() with bracket syntax", () => {
        expect(expressionToActionString(expr('obj("[ANYONE]")'), emptyVars)).toBe("[ANYONE]");
    });

    it("converts obj() with plain string", () => {
        expect(expressionToActionString(expr('obj("npc")'), emptyVars)).toBe('"npc"');
    });

    it("serializes regular function calls", () => {
        expect(expressionToActionString(expr('SetGlobal("x",1)'), emptyVars)).toBe('SetGlobal("x",1)');
    });

    it("preserves string literals", () => {
        expect(expressionToActionString(expr('"hello"'), emptyVars)).toBe('"hello"');
    });

    it("preserves numeric literals", () => {
        expect(expressionToActionString(expr("42"), emptyVars)).toBe("42");
    });

    it("substitutes known variables in identifiers", () => {
        expect(expressionToActionString(expr("myVal"), vars({ myVal: "100" }))).toBe("100");
    });

    it("substitutes vars in tra() arguments", () => {
        expect(expressionToActionString(expr("tra(n)"), vars({ n: "50" }))).toBe("@50");
    });

    it("handles nested function calls", () => {
        const result = expressionToActionString(expr("Foo(Bar(1))"), emptyVars);
        expect(result).toBe("Foo(Bar(1))");
    });
});

// =============================================================================
// validateArgs
// =============================================================================

describe("validateArgs", () => {
    it("does not throw when args meet minimum", () => {
        const args = [stmtNode("1"), stmtNode("2")];
        expect(() => validateArgs("myFunc", args, 2, 1)).not.toThrow();
    });

    it("throws when args below minimum", () => {
        const args = [stmtNode("1")];
        expect(() => validateArgs("myFunc", args, 2, 5)).toThrow("myFunc() requires at least 2 arguments at 5");
    });

    it("uses singular 'argument' for minArgs=1", () => {
        expect(() => validateArgs("myFunc", [], 1, 3)).toThrow("at least 1 argument at 3");
    });
});

// =============================================================================
// parseBooleanOption
// =============================================================================

describe("parseBooleanOption", () => {
    it("returns false for undefined arg", () => {
        expect(parseBooleanOption(undefined, "flag")).toBe(false);
    });

    it("returns false for non-object arg", () => {
        expect(parseBooleanOption(stmtNode("42"), "flag")).toBe(false);
    });

    it("returns true when property is true", () => {
        const obj = expr('({ flag: true })');
        // Unwrap parenthesized expression
        const inner = obj.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        expect(parseBooleanOption(inner, "flag")).toBe(true);
    });

    it("returns false when property is false", () => {
        const obj = expr('({ flag: false })');
        const inner = obj.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        expect(parseBooleanOption(inner, "flag")).toBe(false);
    });

    it("returns false when property is missing", () => {
        const obj = expr('({ other: true })');
        const inner = obj.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        expect(parseBooleanOption(inner, "flag")).toBe(false);
    });
});

// =============================================================================
// parseStringOption
// =============================================================================

describe("parseStringOption", () => {
    it("returns undefined for undefined arg", () => {
        expect(parseStringOption(undefined, "name")).toBeUndefined();
    });

    it("extracts string value from object", () => {
        const obj = expr('({ sound: "mysound" })');
        const inner = obj.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        expect(parseStringOption(inner, "sound")).toBe("mysound");
    });

    it("returns undefined when property missing", () => {
        const obj = expr('({ other: "val" })');
        const inner = obj.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        expect(parseStringOption(inner, "sound")).toBeUndefined();
    });
});

// =============================================================================
// parseRequiredNumber
// =============================================================================

describe("parseRequiredNumber", () => {
    it("parses valid number", () => {
        expect(parseRequiredNumber(expr("42"), "weight", 1)).toBe(42);
    });

    it("throws for non-numeric value", () => {
        expect(() => parseRequiredNumber(expr('"hello"'), "weight", 5)).toThrow('Expected numeric value for weight');
    });
});

// =============================================================================
// resolveArrayElements
// =============================================================================

describe("resolveArrayElements", () => {
    it("resolves array literal elements", () => {
        const result = resolveArrayElements(expr('["a", "b", "c"]'), emptyVars);
        expect(result).toEqual(['"a"', '"b"', '"c"']);
    });

    it("resolves identifier referencing array in vars", () => {
        const result = resolveArrayElements(expr("myArr"), vars({ myArr: '["x", "y"]' }));
        // parseArrayLiteral preserves quotes on string elements
        expect(result).toEqual(['"x"', '"y"']);
    });

    it("returns null for non-array non-identifier", () => {
        expect(resolveArrayElements(expr("42"), emptyVars)).toBeNull();
    });

    it("returns null for identifier not in vars", () => {
        expect(resolveArrayElements(expr("unknown"), emptyVars)).toBeNull();
    });
});

// =============================================================================
// parseStateList
// =============================================================================

describe("parseStateList", () => {
    it("parses array of strings", () => {
        const result = parseStateList(expr('["state1", "state2"]'), emptyVars);
        expect(result).toEqual(["state1", "state2"]);
    });

    it("parses array of numbers", () => {
        const result = parseStateList(expr("[1, 2, 3]"), emptyVars);
        expect(result).toEqual([1, 2, 3]);
    });

    it("parses single numeric value", () => {
        expect(parseStateList(expr("5"), emptyVars)).toEqual([5]);
    });

    it("parses single string value", () => {
        expect(parseStateList(expr('"myState"'), emptyVars)).toEqual(["myState"]);
    });
});

// =============================================================================
// parseUnless
// =============================================================================

describe("parseUnless", () => {
    it("returns string from plain expression", () => {
        expect(parseUnless(expr('"condition"'))).toBe("condition");
    });

    it("extracts unless from object literal", () => {
        const obj = expr('({ unless: "HasItem" })');
        const inner = obj.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        expect(parseUnless(inner)).toBe("HasItem");
    });

    it("returns undefined when unless property missing from object", () => {
        const obj = expr('({ other: "val" })');
        const inner = obj.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        expect(parseUnless(inner)).toBeUndefined();
    });
});
