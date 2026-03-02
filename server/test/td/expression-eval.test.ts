/**
 * Unit tests for td/expression-eval.ts - expression to trigger/action/text conversion.
 * Tests the core functions that convert TypeScript expressions to WeiDU D syntax.
 */

import { describe, expect, it } from "vitest";
import { Expression, Project, SyntaxKind } from "ts-morph";
import {
    expressionToTrigger,
    expressionToAction,
    expressionToText,
} from "../../src/td/expression-eval";
import { TDTextType } from "../../src/td/types";
import type { VarsContext } from "../../src/transpiler-utils";

// =============================================================================
// Test Helpers
// =============================================================================

const project = new Project({ useInMemoryFileSystem: true });

/** Create an Expression node from source code. */
function expr(code: string): Expression {
    const file = project.createSourceFile(
        `test_${Math.random()}.ts`,
        `const __x = ${code};`,
    );
    const decl = file.getVariableDeclarationOrThrow("__x");
    return decl.getInitializerOrThrow();
}

function vars(entries: Record<string, string>): VarsContext {
    return new Map(Object.entries(entries));
}

const emptyVars: VarsContext = new Map();

// =============================================================================
// expressionToTrigger
// =============================================================================

describe("expressionToTrigger", () => {
    it("converts simple function call to trigger", () => {
        const result = expressionToTrigger(expr('Global("x","LOCALS",1)'), emptyVars);
        expect(result).toBe('Global("x","LOCALS",1)');
    });

    it("converts AND (&&) to space-separated triggers", () => {
        const result = expressionToTrigger(expr("a() && b()"), emptyVars);
        expect(result).toBe("a() b()");
    });

    it("converts OR (||) to OR(n) syntax", () => {
        const result = expressionToTrigger(expr("a() || b()"), emptyVars);
        expect(result).toBe("OR(2) a() b()");
    });

    it("handles triple OR chain", () => {
        const result = expressionToTrigger(expr("a() || b() || c()"), emptyVars);
        expect(result).toBe("OR(3) a() b() c()");
    });

    it("handles negation with !", () => {
        const result = expressionToTrigger(expr("!HasItem()"), emptyVars);
        expect(result).toBe("!HasItem()");
    });

    it("unwraps parenthesized expressions", () => {
        const result = expressionToTrigger(expr("(a())"), emptyVars);
        expect(result).toBe("a()");
    });

    it("handles explicit OR() function call", () => {
        const result = expressionToTrigger(expr("OR(2, cond1(), cond2())"), emptyVars);
        expect(result).toBe("OR(2) cond1() cond2()");
    });

    it("substitutes variables in fallback text", () => {
        const result = expressionToTrigger(expr("myVar"), vars({ myVar: "SomeCondition()" }));
        expect(result).toBe("SomeCondition()");
    });

    it("handles mixed AND and OR", () => {
        const result = expressionToTrigger(expr("a() && (b() || c())"), emptyVars);
        expect(result).toBe("a() OR(2) b() c()");
    });
});

// =============================================================================
// expressionToAction
// =============================================================================

describe("expressionToAction", () => {
    it("converts function call to action string", () => {
        const result = expressionToAction(expr('SetGlobal("flag","LOCALS",1)'), emptyVars);
        expect(result).toBe('SetGlobal("flag","LOCALS",1)');
    });

    it("converts tra() to @N in actions", () => {
        const result = expressionToAction(expr("tra(100)"), emptyVars);
        expect(result).toBe("@100");
    });

    it("converts obj() to object reference", () => {
        const result = expressionToAction(expr('obj("[PC]")'), emptyVars);
        expect(result).toBe("[PC]");
    });

    it("substitutes variables", () => {
        const result = expressionToAction(expr("myAction"), vars({ myAction: "DoStuff()" }));
        expect(result).toBe("DoStuff()");
    });
});

// =============================================================================
// expressionToText
// =============================================================================

describe("expressionToText", () => {
    it("converts tra() to TDTextType.Tra", () => {
        const result = expressionToText(expr("tra(100)"), emptyVars);
        expect(result.type).toBe(TDTextType.Tra);
        expect(result.value).toBe(100);
    });

    it("converts $tra() to TDTextType.Tra", () => {
        const result = expressionToText(expr("$tra(200)"), emptyVars);
        expect(result.type).toBe(TDTextType.Tra);
        expect(result.value).toBe(200);
    });

    it("converts tlk() to TDTextType.Tlk", () => {
        const result = expressionToText(expr("tlk(300)"), emptyVars);
        expect(result.type).toBe(TDTextType.Tlk);
        expect(result.value).toBe(300);
    });

    it("extracts sound option from tra()", () => {
        const result = expressionToText(expr('tra(100, { sound: "mysnd" })'), emptyVars);
        expect(result.type).toBe(TDTextType.Tra);
        expect(result.value).toBe(100);
        expect(result.sound).toBe("mysnd");
    });

    it("converts tlkForced() to TDTextType.Forced", () => {
        const result = expressionToText(expr('tlkForced(500, "text")'), emptyVars);
        expect(result.type).toBe(TDTextType.Forced);
        expect(result.value).toBe("500");
    });

    it("converts string literal to TDTextType.Literal", () => {
        const result = expressionToText(expr('"hello world"'), emptyVars);
        expect(result.type).toBe(TDTextType.Literal);
        expect(result.value).toBe("hello world");
    });

    it("handles male/female variant object", () => {
        // Unwrap parens to get the object literal
        const inner = expr('({ male: tra(1), female: tra(2) })');
        const unwrapped = inner.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
        const result = expressionToText(unwrapped, emptyVars);
        expect(result.male).toBeDefined();
        expect(result.female).toBeDefined();
        expect(result.male?.type).toBe(TDTextType.Tra);
        expect(result.male?.value).toBe(1);
        expect(result.female?.type).toBe(TDTextType.Tra);
        expect(result.female?.value).toBe(2);
    });

    it("substitutes variables in tra() argument", () => {
        const result = expressionToText(expr("tra(n)"), vars({ n: "50" }));
        expect(result.type).toBe(TDTextType.Tra);
        expect(result.value).toBe(50);
    });

    it("falls back to literal for unknown expressions", () => {
        const result = expressionToText(expr("someVar"), emptyVars);
        expect(result.type).toBe(TDTextType.Literal);
    });
});
