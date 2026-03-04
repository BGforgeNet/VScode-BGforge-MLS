/**
 * Unit tests for TP2 declaration-site completion suppression.
 * Verifies that completions are suppressed when the cursor is on a new symbol name
 * being declared (variable SET/SPRINT, function/macro definitions, arrays, loops).
 */

import { describe, expect, it } from "vitest";
import { isAtDeclarationSite } from "../../src/weidu-tp2/completion/context";

/** Helper: builds single-line text and tests at end of line. */
function expectDeclaration(line: string, expected: boolean) {
    expect(isAtDeclarationSite(line, { line: 0, character: line.length })).toBe(expected);
}

describe("TP2 declaration-site detection", () => {
    describe("variable declarations (SET/SPRINT)", () => {
        it("detects OUTER_SET with partial name", () => {
            expectDeclaration("OUTER_SET my_v", true);
        });

        it("detects OUTER_SET with no name yet (just space)", () => {
            // Cursor right after the space — no identifier started yet, \S* matches empty
            expectDeclaration("OUTER_SET ", true);
        });

        it("detects SET with partial name", () => {
            expectDeclaration("  SET foo", true);
        });

        it("detects SPRINT with partial name", () => {
            expectDeclaration("SPRINT my_str", true);
        });

        it("detects OUTER_SPRINT with partial name", () => {
            expectDeclaration("OUTER_SPRINT var", true);
        });

        it("detects TEXT_SPRINT with partial name", () => {
            expectDeclaration("TEXT_SPRINT t", true);
        });

        it("detects OUTER_TEXT_SPRINT with partial name", () => {
            expectDeclaration("OUTER_TEXT_SPRINT t", true);
        });

        it("is case-insensitive", () => {
            expectDeclaration("outer_set MY_VAR", true);
            expectDeclaration("Outer_Sprint x", true);
        });
    });

    describe("variable declarations with modifiers (EVAL/EVALUATE_BUFFER/GLOBAL)", () => {
        it("detects OUTER_SET EVAL with partial name", () => {
            expectDeclaration("OUTER_SET EVAL my_v", true);
        });

        it("detects SET EVALUATE_BUFFER with partial name", () => {
            expectDeclaration("SET EVALUATE_BUFFER var", true);
        });

        it("detects SPRINT GLOBAL with partial name", () => {
            expectDeclaration("SPRINT GLOBAL gs", true);
        });

        it("detects OUTER_SPRINT EVAL with partial name", () => {
            expectDeclaration("OUTER_SPRINT EVAL s", true);
        });
    });

    describe("function/macro definitions", () => {
        it("detects DEFINE_ACTION_FUNCTION", () => {
            expectDeclaration("DEFINE_ACTION_FUNCTION my_func", true);
        });

        it("detects DEFINE_PATCH_FUNCTION", () => {
            expectDeclaration("DEFINE_PATCH_FUNCTION pf", true);
        });

        it("detects DEFINE_ACTION_MACRO", () => {
            expectDeclaration("DEFINE_ACTION_MACRO am", true);
        });

        it("detects DEFINE_PATCH_MACRO", () => {
            expectDeclaration("DEFINE_PATCH_MACRO pm", true);
        });

        it("is case-insensitive for definitions", () => {
            expectDeclaration("define_action_function f", true);
        });
    });

    describe("array definitions", () => {
        it("detects DEFINE_ARRAY", () => {
            expectDeclaration("DEFINE_ARRAY arr", true);
        });

        it("detects ACTION_DEFINE_ARRAY", () => {
            expectDeclaration("ACTION_DEFINE_ARRAY arr", true);
        });

        it("detects DEFINE_ASSOCIATIVE_ARRAY", () => {
            expectDeclaration("DEFINE_ASSOCIATIVE_ARRAY aa", true);
        });

        it("detects ACTION_DEFINE_ASSOCIATIVE_ARRAY", () => {
            expectDeclaration("ACTION_DEFINE_ASSOCIATIVE_ARRAY aa", true);
        });
    });

    describe("loop variable bindings", () => {
        it("detects FOR_EACH", () => {
            expectDeclaration("FOR_EACH item", true);
        });

        it("detects PHP_EACH", () => {
            expectDeclaration("PHP_EACH entry", true);
        });

        it("detects PATCH_FOR_EACH", () => {
            expectDeclaration("PATCH_FOR_EACH x", true);
        });

        it("detects ACTION_FOR_EACH", () => {
            expectDeclaration("ACTION_FOR_EACH y", true);
        });

        it("detects ACTION_PHP_EACH", () => {
            expectDeclaration("ACTION_PHP_EACH e", true);
        });

        it("detects PATCH_PHP_EACH", () => {
            expectDeclaration("PATCH_PHP_EACH e", true);
        });
    });

    describe("non-declaration positions (should NOT suppress)", () => {
        it("does not match after = sign (value position)", () => {
            expectDeclaration("OUTER_SET x = val", false);
        });

        it("does not match SET with value after =", () => {
            expectDeclaration("SET foo = 1", false);
        });

        it("does not match function body after definition", () => {
            expectDeclaration("DEFINE_ACTION_FUNCTION foo INT_VAR bar = ", false);
        });

        it("does not match regular action keywords", () => {
            expectDeclaration("COPY ~file~ ~dest~", false);
        });

        it("does not match LAF/LPF (function calls, not declarations)", () => {
            expectDeclaration("LAF my_func", false);
        });

        it("does not match empty line", () => {
            expectDeclaration("", false);
        });

        it("does not match comment lines", () => {
            expectDeclaration("// OUTER_SET foo", false);
        });
    });

    describe("multiline text with line/character positioning", () => {
        it("detects declaration on second line", () => {
            const text = "COPY ~a~ ~b~\nOUTER_SET my_v";
            expect(isAtDeclarationSite(text, { line: 1, character: 18 })).toBe(true);
        });

        it("does not match first line when declaration is on second", () => {
            const text = "COPY ~a~ ~b~\nOUTER_SET my_v";
            expect(isAtDeclarationSite(text, { line: 0, character: 12 })).toBe(false);
        });

        it("returns false for out-of-range line", () => {
            expect(isAtDeclarationSite("OUTER_SET x", { line: 5, character: 0 })).toBe(false);
        });

        it("uses character offset to trim line", () => {
            // Full line: "OUTER_SET x = 5" but cursor at position 11 => "OUTER_SET x"
            const text = "OUTER_SET x = 5";
            expect(isAtDeclarationSite(text, { line: 0, character: 11 })).toBe(true);
            // Full line considered — past the = sign
            expect(isAtDeclarationSite(text, { line: 0, character: 15 })).toBe(false);
        });
    });
});
