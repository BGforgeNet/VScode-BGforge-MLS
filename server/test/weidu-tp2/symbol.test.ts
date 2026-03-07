/**
 * Tests for TP2 document symbol provider.
 * Verifies outline symbols include detail text for function parameters.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { SymbolKind } from "vscode-languageserver/node";

vi.mock("../../src/lsp-connection", () => ({
    getConnection: () => ({
        console: { log: vi.fn() },
    }),
}));

import { getDocumentSymbols } from "../../src/weidu-tp2/symbol";
import { initParser } from "../../src/weidu-tp2/parser";

beforeAll(async () => {
    await initParser();
});

describe("weidu-tp2: getDocumentSymbols", () => {
    it("returns function symbols", () => {
        const text = `DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const symbols = getDocumentSymbols(text);
        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toBe("my_func");
        expect(symbols[0].kind).toBe(SymbolKind.Function);
    });

    it("returns detail with INT_VAR params", () => {
        const text = `DEFINE_ACTION_FUNCTION my_func INT_VAR x = 0 STR_VAR name = "" BEGIN END`;
        const symbols = getDocumentSymbols(text);
        expect(symbols[0].detail).toBe("INT_VAR x STR_VAR name");
    });

    it("returns detail with RET", () => {
        const text = `DEFINE_PATCH_FUNCTION my_patch INT_VAR input = 0 RET result BEGIN END`;
        const symbols = getDocumentSymbols(text);
        expect(symbols[0].detail).toBe("INT_VAR input RET result");
    });

    it("returns detail with RET_ARRAY", () => {
        const text = `DEFINE_ACTION_FUNCTION my_func RET_ARRAY items BEGIN END`;
        const symbols = getDocumentSymbols(text);
        expect(symbols[0].detail).toBe("RET_ARRAY items");
    });

    it("returns no detail for macro definitions", () => {
        const text = `DEFINE_ACTION_MACRO my_macro BEGIN END`;
        const symbols = getDocumentSymbols(text);
        expect(symbols[0].name).toBe("my_macro");
        expect(symbols[0].detail).toBeUndefined();
    });

    it("returns no detail for functions without params", () => {
        const text = `DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const symbols = getDocumentSymbols(text);
        expect(symbols[0].detail).toBeUndefined();
    });

    it("returns empty array for empty text", () => {
        expect(getDocumentSymbols("")).toEqual([]);
    });
});
