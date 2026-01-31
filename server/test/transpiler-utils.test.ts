/**
 * Tests for transpiler-utils.ts - shared transpiler utilities.
 * Covers safe expression evaluation, variable substitution, and parsing helpers.
 */

import { describe, expect, it } from "vitest";
import {
    evaluateCondition,
    parseArrayLiteral,
    parseIncrement,
    stripQuotes,
    substituteVars,
    VarsContext,
} from "../src/transpiler-utils";

describe("evaluateCondition", () => {
    const emptyVars: VarsContext = new Map();

    describe("valid loop conditions", () => {
        it("evaluates simple comparison with loop var", () => {
            expect(evaluateCondition("i < 10", "i", 5, emptyVars)).toBe(true);
            expect(evaluateCondition("i < 10", "i", 10, emptyVars)).toBe(false);
        });

        it("substitutes other vars before evaluation", () => {
            const vars: VarsContext = new Map([["count", "10"]]);
            expect(evaluateCondition("i < count", "i", 5, vars)).toBe(true);
            expect(evaluateCondition("i < count", "i", 15, vars)).toBe(false);
        });

        it("handles arithmetic in conditions", () => {
            const vars: VarsContext = new Map([["max", "20"]]);
            expect(evaluateCondition("i + 1 <= max", "i", 19, vars)).toBe(true);
            expect(evaluateCondition("i + 1 <= max", "i", 20, vars)).toBe(false);
        });

        it("handles equality checks", () => {
            expect(evaluateCondition("i != 5", "i", 3, emptyVars)).toBe(true);
            expect(evaluateCondition("i != 5", "i", 5, emptyVars)).toBe(false);
        });

        it("handles boolean operators", () => {
            const vars: VarsContext = new Map([["min", "0"], ["max", "10"]]);
            expect(evaluateCondition("i >= min && i < max", "i", 5, vars)).toBe(true);
            expect(evaluateCondition("i >= min && i < max", "i", 15, vars)).toBe(false);
        });

        it("handles parenthesized expressions", () => {
            expect(evaluateCondition("(i + 1) * 2 < 20", "i", 5, emptyVars)).toBe(true);
            expect(evaluateCondition("(i + 1) * 2 < 20", "i", 10, emptyVars)).toBe(false);
        });

        it("handles modulo", () => {
            expect(evaluateCondition("i % 3 != 0", "i", 4, emptyVars)).toBe(true);
            expect(evaluateCondition("i % 3 != 0", "i", 6, emptyVars)).toBe(false);
        });
    });

    describe("rejects dangerous expressions from user files", () => {
        it("rejects process.exit() in loop condition", () => {
            expect(() => evaluateCondition("process.exit(0)", "i", 0, emptyVars)).toThrow();
        });

        it("rejects require() in loop condition", () => {
            expect(() => evaluateCondition("require('fs')", "i", 0, emptyVars)).toThrow();
        });

        it("rejects property access", () => {
            expect(() => evaluateCondition("global.process", "i", 0, emptyVars)).toThrow();
        });

        it("rejects constructor access", () => {
            expect(() =>
                evaluateCondition("constructor.constructor('return this')()", "i", 0, emptyVars)
            ).toThrow();
        });

        it("rejects string literals", () => {
            expect(() => evaluateCondition("i < 'a'.length", "i", 0, emptyVars)).toThrow();
        });

        it("rejects array access", () => {
            expect(() => evaluateCondition("i < [1,2,3][0]", "i", 0, emptyVars)).toThrow();
        });

        it("rejects statement injection via semicolons", () => {
            expect(() =>
                evaluateCondition("i < 10; process.exit(0)", "i", 0, emptyVars)
            ).toThrow();
        });
    });

    it("throws on unresolved identifiers", () => {
        expect(() => evaluateCondition("i < unknown", "i", 5, emptyVars)).toThrow();
    });
});

describe("substituteVars", () => {
    it("replaces variable with value", () => {
        const vars: VarsContext = new Map([["count", "5"]]);
        expect(substituteVars("i < count", vars)).toBe("i < 5");
    });

    it("replaces multiple variables", () => {
        const vars: VarsContext = new Map([
            ["a", "1"],
            ["b", "2"],
        ]);
        expect(substituteVars("a + b", vars)).toBe("1 + 2");
    });

    it("uses word boundaries to avoid partial matches", () => {
        const vars: VarsContext = new Map([["i", "5"]]);
        expect(substituteVars("index", vars)).toBe("index");
    });
});

describe("parseIncrement", () => {
    it("parses ++", () => expect(parseIncrement("i++")).toBe(1));
    it("parses --", () => expect(parseIncrement("i--")).toBe(-1));
    it("parses +=N", () => expect(parseIncrement("i += 5")).toBe(5));
    it("parses -=N", () => expect(parseIncrement("i -= 3")).toBe(-3));
});

describe("stripQuotes", () => {
    it("strips double quotes", () => expect(stripQuotes('"hello"')).toBe("hello"));
    it("strips single quotes", () => expect(stripQuotes("'world'")).toBe("world"));
    it("strips backticks", () => expect(stripQuotes("`test`")).toBe("test"));
    it("leaves unquoted strings alone", () => expect(stripQuotes("plain")).toBe("plain"));
});

describe("parseArrayLiteral", () => {
    it("parses simple array", () => {
        expect(parseArrayLiteral('["foo", "bar"]')).toEqual(['"foo"', '"bar"']);
    });

    it("parses empty array", () => expect(parseArrayLiteral("[]")).toEqual([]));
    it("returns null for non-array", () => expect(parseArrayLiteral("not-an-array")).toBeNull());

    it("handles nested arrays", () => {
        expect(parseArrayLiteral("[[1, 2], [3, 4]]")).toEqual(["[1, 2]", "[3, 4]"]);
    });

    it("handles commas in quoted strings", () => {
        expect(parseArrayLiteral('["a, b", "c"]')).toEqual(['"a, b"', '"c"']);
    });
});
