/**
 * Unit tests for fallout-ssl document symbol provider.
 * Covers the empty-name guard: tree-sitter can produce nodes with empty text
 * for incomplete/malformed input, which would crash VSCode's symbol API
 * ("name must not be falsy").
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { SymbolKind } from "vscode-languageserver/node";

// Mock the server module to avoid LSP connection issues
vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { getDocumentSymbols } from "../../src/fallout-ssl/symbol";
import { initParser } from "../../src/fallout-ssl/parser";

beforeAll(async () => {
    await initParser();
});

describe("fallout-ssl: getDocumentSymbols", () => {
    it("returns procedure symbols", () => {
        const text = `procedure my_proc begin end`;
        const symbols = getDocumentSymbols(text);
        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toBe("my_proc");
        expect(symbols[0].kind).toBe(SymbolKind.Function);
    });

    it("returns variable symbols", () => {
        const text = `variable my_var := 0;`;
        const symbols = getDocumentSymbols(text);
        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toBe("my_var");
        expect(symbols[0].kind).toBe(SymbolKind.Variable);
    });

    it("returns export variable symbols", () => {
        const text = `export variable exported_var;`;
        const symbols = getDocumentSymbols(text);
        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toBe("exported_var");
        expect(symbols[0].kind).toBe(SymbolKind.Variable);
    });

    it("returns multiple symbols", () => {
        const text = `
variable x := 1;
variable y := 2;
procedure foo begin end
procedure bar begin end
`;
        const symbols = getDocumentSymbols(text);
        const names = symbols.map(s => s.name);
        expect(names).toContain("x");
        expect(names).toContain("y");
        expect(names).toContain("foo");
        expect(names).toContain("bar");
    });

    it("never returns symbols with empty names", () => {
        // Incomplete/malformed input that tree-sitter may parse with empty name nodes.
        // The guard in makeSymbol should filter these out instead of crashing.
        const malformed = [
            `procedure`,
            `procedure ;`,
            `variable`,
            `variable ;`,
            `export variable`,
            `export variable ;`,
        ];
        for (const text of malformed) {
            const symbols = getDocumentSymbols(text);
            for (const sym of symbols) {
                expect(sym.name, `Got empty name for input: "${text}"`).toBeTruthy();
            }
        }
    });

    it("returns empty array for empty text", () => {
        expect(getDocumentSymbols("")).toEqual([]);
    });
});
