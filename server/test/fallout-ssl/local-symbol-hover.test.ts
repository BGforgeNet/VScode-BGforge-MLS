/**
 * Tests for local symbol hover in Fallout SSL files.
 * Verifies that hover works for symbols defined in the current file
 * without showing redundant file paths.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { MarkupKind } from "vscode-languageserver/node";

// Mock LSP connection before importing modules that use it
vi.mock("../../src/common", () => ({
    conlog: vi.fn(),
}));

import { lookupLocalSymbol, clearAllLocalSymbolsCache } from "../../src/fallout-ssl/local-symbols";
import { initParser } from "../../src/fallout-ssl/parser";

describe("fallout-ssl local symbol hover", () => {
    beforeAll(async () => {
        await initParser();
    });

    it("should NOT include file path in hover for local procedures", () => {
        const text = `
procedure my_proc begin
    display_msg("hello");
end
`;
        const uri = "file:///mymod/scripts/test.ssl";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("my_proc", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        expect(symbol?.hover?.contents).toHaveProperty("kind", MarkupKind.Markdown);

        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("my_proc");

        // Should NOT contain file path or bgforge-mls-comment block with path
        expect(value).not.toContain("test.ssl");
        expect(value).not.toContain("mymod");
    });

    it("should NOT include file path in hover for local macros", () => {
        const text = `
#define MY_MACRO(x) (x + 1)
`;
        const uri = "file:///mymod/scripts/test.ssl";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("MY_MACRO", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();
        expect(symbol?.hover?.contents).toHaveProperty("kind", MarkupKind.Markdown);

        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("MY_MACRO");

        // Should NOT contain file path or bgforge-mls-comment block with path
        expect(value).not.toContain("test.ssl");
        expect(value).not.toContain("mymod");
        // Should NOT have an empty bgforge-mls-comment block either
        expect(value).not.toMatch(/bgforge-mls-comment\s*\n\s*\n/);
    });

    it("should NOT include file path in hover for local constant macros", () => {
        const text = `
#define MAX_VALUE 100
`;
        const uri = "file:///mymod/scripts/test.ssl";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("MAX_VALUE", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();

        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        // Constant macros show just the value, not "NAME = value"
        expect(value).toContain("100");

        // Should NOT contain file path
        expect(value).not.toContain("test.ssl");
        expect(value).not.toContain("mymod");
    });

    it("should NOT include file path in hover for local variables", () => {
        const text = `
variable my_var := 42;
`;
        const uri = "file:///mymod/scripts/test.ssl";
        clearAllLocalSymbolsCache();
        const symbol = lookupLocalSymbol("my_var", text, uri);

        expect(symbol).toBeDefined();
        expect(symbol?.hover).toBeDefined();

        const value = (symbol?.hover?.contents as { kind: string; value: string }).value;
        expect(value).toContain("my_var");

        // Should NOT contain file path
        expect(value).not.toContain("test.ssl");
        expect(value).not.toContain("mymod");
    });
});
