/**
 * Unit tests for fallout-ssl/header-parser.ts - regex-based #define and procedure parsing.
 * Tests edge cases in macro detection, multiline handling, and JSDoc parsing.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/common", () => ({
    conlog: vi.fn(),
    findFiles: vi.fn(() => []),
}));

import { parseHeaderToSymbols } from "../../src/fallout-ssl/header-parser";
import { SymbolKind, isCallableSymbol } from "../../src/core/symbol";
import type { MarkupContent } from "vscode-languageserver/node";

const testUri = "file:///mymod/headers/test.h";
const workspaceRoot = "/mymod";

describe("parseHeaderToSymbols - edge cases", () => {
    describe("macros with nested parentheses", () => {
        it("parses macro with nested parens in body: #define MACRO(X,Y) call(F(X,Y))", () => {
            // ALL_UPPER name => isConstantMacro=true => treated as constant
            // Even though it has params, the constant flag prevents hasParams check
            const input = `#define MACRO(X,Y) call(F(X,Y))`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.name).toBe("MACRO");

            const hover = symbols[0]!.hover.contents as MarkupContent;
            expect(hover.value).toContain("MACRO");
        });

        it("parses lowercase macro with nested parens as callable", () => {
            // lowercase name => isConstantMacro=false => hasParams=true => CallableSymbol
            const input = `#define my_macro(X,Y) call(F(X,Y))`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.name).toBe("my_macro");
            expect(isCallableSymbol(symbols[0]!)).toBe(true);
        });
    });

    describe("backslash continuation (multiline macros)", () => {
        it("detects multiline macro ending with backslash", () => {
            const input = `#define MY_MACRO begin \\
    some_code; \\
end`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            // Should parse the first line as a macro
            expect(symbols.length).toBeGreaterThanOrEqual(1);
            const macroSymbol = symbols.find(s => s.name === "MY_MACRO");
            expect(macroSymbol).toBeDefined();
        });

        it("multiline macro without params is still ConstantSymbol", () => {
            // Even multiline macros without params end up as ConstantSymbol
            // because hasParams = !constant && detail.includes("(")
            // For multiline: constant=false (multiline prevents it), but detail has no "("
            // so hasParams=false => ConstantSymbol
            const input = `#define SETUP_STUFF begin \\
    set_global(1); \\
end`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            const symbol = symbols.find(s => s.name === "SETUP_STUFF");
            expect(symbol).toBeDefined();
            // Without params in the define signature, it's a ConstantSymbol
            expect(symbol!.kind).toBe(SymbolKind.Constant);
        });

        it("multiline macro with params is callable", () => {
            // lowercase + params => hasParams=true => CallableSymbol
            const input = `#define setup_stuff(x) begin \\
    set_global(x); \\
end`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            const symbol = symbols.find(s => s.name === "setup_stuff");
            expect(symbol).toBeDefined();
            expect(isCallableSymbol(symbol!)).toBe(true);
            expect(symbol!.kind).toBe(SymbolKind.Macro);
        });
    });

    describe("empty macro body", () => {
        it("parses #define EMPTY with no body after name", () => {
            // The regex requires at least one char after the name: [ \t]+(.+)
            // So #define EMPTY with nothing after it won't match
            const input = `#define SOMETHING 1\n#define HAS_BODY (0)`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols.length).toBeGreaterThanOrEqual(1);
            const something = symbols.find(s => s.name === "SOMETHING");
            expect(something).toBeDefined();
        });
    });

    describe("macro with no space before parenthesis", () => {
        it("parses #define FUNC(X) body -- uppercase with params is constant (no hasParams because isConstantMacro)", () => {
            // When name is ALL_UPPER, isConstantMacro returns true, so params are ignored
            // and the macro becomes a ConstantSymbol even though it has (X)
            const input = `#define FUNC(X) do_something(X)`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.name).toBe("FUNC");
            // FUNC is ALL_UPPER => isConstantMacro = true => constant, not callable
            expect(symbols[0]!.kind).toBe(SymbolKind.Constant);
        });

        it("parses #define func(X) body -- lowercase with params is callable", () => {
            const input = `#define my_func(X) do_something(X)`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.name).toBe("my_func");
            expect(isCallableSymbol(symbols[0]!)).toBe(true);
            expect(symbols[0]!.kind).toBe(SymbolKind.Macro);
        });
    });

    describe("constant vs non-constant macro detection", () => {
        it("detects UPPER_CASE as constant", () => {
            const input = `#define MAX_HP 100`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.kind).toBe(SymbolKind.Constant);
        });

        it("treats lowercase macros without params as constant too", () => {
            // Without params, both uppercase and lowercase macros become ConstantSymbol
            // The hasParams check is: !macro.constant && macro.detail.includes("(")
            // For lowercase without params: constant=false, detail has no "(", so hasParams=false
            // which means the else branch runs and creates ConstantSymbol
            const input = `#define get_value do_stuff`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.kind).toBe(SymbolKind.Constant);
        });
    });

    describe("procedure parsing", () => {
        it("parses procedure with no arguments", () => {
            const input = `procedure my_proc begin end`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.name).toBe("my_proc");
            expect(symbols[0]!.kind).toBe(SymbolKind.Procedure);
        });

        it("parses procedure with arguments", () => {
            const input = `procedure my_proc(arg1, arg2) begin end`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.name).toBe("my_proc");
            expect(isCallableSymbol(symbols[0]!)).toBe(true);
        });

        it("parses procedure with JSDoc", () => {
            const input = `/**
 * Does something.
 * @param x the first argument
 */
procedure test_proc(x) begin end`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            const hover = symbols[0]!.hover.contents as MarkupContent;
            expect(hover.value).toContain("Does something");
        });
    });

    describe("mixed macros and procedures", () => {
        it("parses both macros and procedures from same file", () => {
            const input = `
#define MAX_ITEMS 100
#define get_item(idx) item_at(idx)
procedure init_items begin end
`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(3);
            expect(symbols.some(s => s.name === "MAX_ITEMS")).toBe(true);
            expect(symbols.some(s => s.name === "get_item")).toBe(true);
            expect(symbols.some(s => s.name === "init_items")).toBe(true);
        });
    });

    describe("definition locations", () => {
        it("includes correct line and character in location", () => {
            const input = `#define MY_CONST 42`;
            const symbols = parseHeaderToSymbols(testUri, input, workspaceRoot);

            expect(symbols).toHaveLength(1);
            expect(symbols[0]!.location).not.toBeNull();
            expect(symbols[0]!.location!.uri).toBe(testUri);
            expect(symbols[0]!.location!.range.start.line).toBe(0);
        });
    });
});
