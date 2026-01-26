/**
 * Tests for local variable hover in WeiDU TP2 files.
 * Verifies that hover works for variables defined in the current file,
 * not just for indexed header files.
 *
 * Uses unified symbol resolution (Approach C) via lookupLocalSymbol.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { MarkupKind } from "vscode-languageserver/node";

// Mock LSP connection before importing modules that use it
vi.mock("../../src/common", () => ({
    conlog: vi.fn(),
}));

import { lookupLocalSymbol, clearAllLocalSymbolsCache } from "../../src/weidu-tp2/local-symbols";
import { initParser } from "../../src/weidu-tp2/parser";

describe("local variable hover", () => {
    beforeAll(async () => {
        await initParser();
    });

    it("should return hover for variable with JSDoc @type", () => {
        const text = `
/** @type {int} Maximum pip count limit */
OUTER_SET pip_limit = 10

LAF my_function END
`;
        const uri = "file:///test.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("pip_limit", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        expect(symbol?.hover?.contents).toHaveProperty("kind", MarkupKind.Markdown);
        expect(symbol?.hover?.contents).toHaveProperty("value");

        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("pip_limit");
        expect(value).toContain("10");
    });

    it("should return hover for variable without JSDoc", () => {
        const text = `
OUTER_SET my_var = 42
`;
        const uri = "file:///test.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("my_var", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        expect(symbol?.hover?.contents).toHaveProperty("kind", MarkupKind.Markdown);

        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("my_var");
        expect(value).toContain("42");
    });

    it("should return hover for string variable (OUTER_SPRINT)", () => {
        const text = `
/** Description of the string */
OUTER_SPRINT my_string ~hello world~
`;
        const uri = "file:///test.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("my_string", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("my_string");
        expect(value).toContain("hello world");
    });

    it("should return undefined for non-existent variable", () => {
        const text = `
OUTER_SET foo = 1
`;
        const uri = "file:///test.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("bar", text, uri);

        expect(symbol).toBeUndefined();
    });

    it("should include JSDoc description in hover", () => {
        const text = `
/**
 * @type {int}
 * This is the detailed description of the variable
 */
OUTER_SET documented_var = 100
`;
        const uri = "file:///test.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("documented_var", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("documented_var");
        expect(value).toContain("detailed description");
    });

    it("should work with OUTER_TEXT_SPRINT", () => {
        const text = `
OUTER_TEXT_SPRINT text_var ~some text~
`;
        const uri = "file:///test.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("text_var", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("text_var");
    });

    it("should return first definition when variable is defined multiple times", () => {
        const text = `
/** First definition */
OUTER_SET count = 1

// Later reassignment
OUTER_SET count = 2
`;
        const uri = "file:///test.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("count", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        // Should show first definition's value
        expect(value).toContain("1");
        expect(value).toContain("First definition");
    });

    it("should NOT include file path in hover for local symbols", () => {
        // Local symbols (current file) should not show path - it's redundant
        const text = `
OUTER_SET local_var = 123
`;
        const uri = "file:///mymod/setup.tp2";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("local_var", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;

        // Should contain the variable info
        expect(value).toContain("local_var");
        expect(value).toContain("123");

        // Should NOT contain file path or bgforge-mls-comment block with path
        expect(value).not.toContain("setup.tp2");
        expect(value).not.toContain("mymod");
    });
});
