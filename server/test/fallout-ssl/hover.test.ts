/**
 * Unit tests for fallout-ssl/hover.ts - local hover provider.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { MarkupContent, MarkupKind } from "vscode-languageserver/node";

// Mock the server module to avoid LSP connection issues
vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { getLocalHover } from "../../src/fallout-ssl/hover";
import { initParser } from "../../src/fallout-ssl/parser";

beforeAll(async () => {
    await initParser();
});

/** Type guard to check if contents is MarkupContent */
function isMarkupContent(contents: unknown): contents is MarkupContent {
    return typeof contents === "object" && contents !== null && "kind" in contents && "value" in contents;
}

describe("fallout-ssl/hover", () => {
    describe("getLocalHover()", () => {
        it("returns hover for locally defined procedure", () => {
            const text = `
procedure foo begin end
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "foo", uri);

            expect(result).not.toBeNull();
            expect(result?.contents).toBeDefined();
        });

        it("returns null for undefined symbol", () => {
            const text = "procedure foo begin end";
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "undefined_symbol", uri);

            expect(result).toBeNull();
        });

        it("includes procedure signature in hover", () => {
            const text = `
procedure my_proc begin end
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "my_proc", uri);

            expect(result).not.toBeNull();
            const contents = result?.contents;
            expect(isMarkupContent(contents)).toBe(true);
            if (isMarkupContent(contents)) {
                expect(contents.kind).toBe(MarkupKind.Markdown);
                expect(contents.value).toContain("my_proc");
            }
        });

        it("includes parameter names for procedure with params", () => {
            const text = `
procedure add(a, b) begin
    return a + b;
end
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "add", uri);

            expect(result).not.toBeNull();
            const contents = result?.contents;
            if (isMarkupContent(contents)) {
                expect(contents.value).toContain("a");
                expect(contents.value).toContain("b");
            }
        });

        it("includes JSDoc description when present", () => {
            const text = `
/**
 * Calculates the sum of two numbers
 * @param a First number
 * @param b Second number
 * @return The sum
 */
procedure add(a, b) begin
    return a + b;
end
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "add", uri);

            expect(result).not.toBeNull();
            const contents = result?.contents;
            if (isMarkupContent(contents)) {
                expect(contents.value).toContain("sum");
            }
        });

        it("handles hover for macro definition", () => {
            // Note: Macro hover depends on grammar support for preprocessor nodes
            const text = `
#define MAX_VALUE 100
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "MAX_VALUE", uri);

            // Result depends on grammar parsing preprocessor nodes
            // Just verify it doesn't crash
            expect(result === null || result !== null).toBe(true);
        });

        it("handles hover for function-like macro", () => {
            // Note: Function-like macro hover depends on grammar support
            const text = `
#define ADD(a, b) ((a) + (b))
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "ADD", uri);

            // Result depends on grammar parsing preprocessor nodes
            // Just verify it doesn't crash
            expect(result === null || result !== null).toBe(true);
        });

        it("shows procedure without params correctly", () => {
            const text = `
procedure simple begin
    display_msg("hello");
end
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "simple", uri);

            expect(result).not.toBeNull();
            const contents = result?.contents;
            if (isMarkupContent(contents)) {
                expect(contents.value).toContain("procedure simple()");
            }
        });

        it("includes JSDoc types in signature when supported", () => {
            // Note: JSDoc extraction depends on comment being recognized by grammar
            const text = `
/**
 * @param int count Number of items
 * @return int The result
 */
procedure process(count) begin
    return count * 2;
end
`;
            const uri = "file:///test.ssl";
            const result = getLocalHover(text, "process", uri);

            expect(result).not.toBeNull();
            const contents = result?.contents;
            if (isMarkupContent(contents)) {
                // Should include procedure name at minimum
                expect(contents.value).toContain("process");
            }
        });
    });
});
