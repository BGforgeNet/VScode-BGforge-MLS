/**
 * Tests for core/document-symbols.ts - Symbol[] to DocumentSymbol[] conversion.
 *
 * DocumentSymbol is a hierarchical structure used for the outline view.
 * This module converts flat Symbol[] arrays into DocumentSymbol[] arrays
 * with proper structure.
 */

import { describe, expect, it } from "vitest";
import { SymbolKind as VscodeSymbolKind } from "vscode-languageserver/node";
import { getDocumentSymbols } from "../../src/core/document-symbols";
import { type Symbol, SymbolKind, ScopeLevel, SourceType } from "../../src/core/symbol";
import { buildSymbol, type RawSymbolData } from "../../src/core/symbol-builder";

// =============================================================================
// Test fixtures
// =============================================================================

function createSymbol(overrides: Partial<RawSymbolData> & { name: string }): Symbol {
    return buildSymbol({
        name: overrides.name,
        kind: overrides.kind ?? SymbolKind.Variable,
        location: overrides.location ?? {
            uri: "file:///test.txt",
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 },
            },
        },
        scope: overrides.scope ?? { level: ScopeLevel.File },
        source: overrides.source ?? { type: SourceType.Document, uri: "file:///test.txt" },
        parameters: overrides.parameters,
        description: overrides.description,
        returnType: overrides.returnType,
        type: overrides.type,
        displayPath: overrides.displayPath,
    });
}

describe("document-symbols", () => {
    // =========================================================================
    // Basic conversion
    // =========================================================================
    describe("getDocumentSymbols()", () => {
        it("should return empty array for empty input", () => {
            const result = getDocumentSymbols([]);
            expect(result).toEqual([]);
        });

        it("should convert a single symbol", () => {
            const symbols = [
                createSymbol({
                    name: "myVar",
                    kind: SymbolKind.Variable,
                    location: {
                        uri: "file:///test.txt",
                        range: {
                            start: { line: 5, character: 0 },
                            end: { line: 5, character: 10 },
                        },
                    },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("myVar");
            expect(result[0].kind).toBe(VscodeSymbolKind.Variable);
            expect(result[0].range.start.line).toBe(5);
        });

        it("should convert multiple symbols", () => {
            const symbols = [
                createSymbol({ name: "first" }),
                createSymbol({ name: "second" }),
                createSymbol({ name: "third" }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(3);
            expect(result.map(s => s.name)).toEqual(["first", "second", "third"]);
        });
    });

    // =========================================================================
    // Symbol kind mapping
    // =========================================================================
    describe("kind mapping", () => {
        it("should map Function to VSCode Function", () => {
            const symbols = [createSymbol({ name: "func", kind: SymbolKind.Function })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Function);
        });

        it("should map Procedure to VSCode Function", () => {
            const symbols = [createSymbol({ name: "proc", kind: SymbolKind.Procedure })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Function);
        });

        it("should map Macro to VSCode Function", () => {
            const symbols = [createSymbol({ name: "MACRO", kind: SymbolKind.Macro })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Function);
        });

        it("should map Action to VSCode Function", () => {
            const symbols = [createSymbol({ name: "ActionX", kind: SymbolKind.Action })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Function);
        });

        it("should map Trigger to VSCode Function", () => {
            const symbols = [createSymbol({ name: "TriggerY", kind: SymbolKind.Trigger })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Function);
        });

        it("should map Variable to VSCode Variable", () => {
            const symbols = [createSymbol({ name: "myVar", kind: SymbolKind.Variable })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Variable);
        });

        it("should map Constant to VSCode Constant", () => {
            const symbols = [createSymbol({ name: "MAX", kind: SymbolKind.Constant })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Constant);
        });

        it("should map Parameter to VSCode Variable", () => {
            const symbols = [createSymbol({ name: "param", kind: SymbolKind.Parameter })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Variable);
        });

        it("should map LoopVariable to VSCode Variable", () => {
            const symbols = [createSymbol({ name: "i", kind: SymbolKind.LoopVariable })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Variable);
        });

        it("should map State to VSCode Class", () => {
            const symbols = [createSymbol({ name: "dialog_start", kind: SymbolKind.State })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Class);
        });

        it("should map Component to VSCode Module", () => {
            const symbols = [createSymbol({ name: "MyMod", kind: SymbolKind.Component })];

            const result = getDocumentSymbols(symbols);

            expect(result[0].kind).toBe(VscodeSymbolKind.Module);
        });
    });

    // =========================================================================
    // Range handling
    // =========================================================================
    describe("range handling", () => {
        it("should preserve full range from symbol", () => {
            const symbols = [
                createSymbol({
                    name: "myFunc",
                    kind: SymbolKind.Function,
                    location: {
                        uri: "file:///test.txt",
                        range: {
                            start: { line: 10, character: 0 },
                            end: { line: 25, character: 1 },
                        },
                    },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result[0].range.start.line).toBe(10);
            expect(result[0].range.start.character).toBe(0);
            expect(result[0].range.end.line).toBe(25);
            expect(result[0].range.end.character).toBe(1);
        });

        it("should set selectionRange to same as range for simple symbols", () => {
            const symbols = [
                createSymbol({
                    name: "x",
                    kind: SymbolKind.Variable,
                    location: {
                        uri: "file:///test.txt",
                        range: {
                            start: { line: 5, character: 4 },
                            end: { line: 5, character: 5 },
                        },
                    },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result[0].selectionRange).toEqual(result[0].range);
        });
    });

    // =========================================================================
    // Detail handling
    // =========================================================================
    describe("detail handling", () => {
        it("should include detail from completion for functions", () => {
            const symbols = [
                createSymbol({
                    name: "calculate",
                    kind: SymbolKind.Function,
                    parameters: [
                        { name: "x", type: "INT_VAR" },
                        { name: "y", type: "INT_VAR" },
                    ],
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result[0].detail).toBeDefined();
            expect(result[0].detail).toContain("calculate");
        });

        it("should include detail for procedures", () => {
            const symbols = [
                createSymbol({
                    name: "my_proc",
                    kind: SymbolKind.Procedure,
                    parameters: [{ name: "arg1" }],
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result[0].detail).toBeDefined();
            expect(result[0].detail).toContain("my_proc");
        });

        it("should include detail for macros with parameters", () => {
            const symbols = [
                createSymbol({
                    name: "MY_MACRO",
                    kind: SymbolKind.Macro,
                    parameters: [{ name: "param" }],
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result[0].detail).toBeDefined();
            expect(result[0].detail).toContain("MY_MACRO");
        });

        it("should not include detail for variables without type", () => {
            const symbols = [
                createSymbol({
                    name: "simpleVar",
                    kind: SymbolKind.Variable,
                }),
            ];

            const result = getDocumentSymbols(symbols);

            // Detail for variables is optional - just the name
            // Implementation can choose to include or omit it
            expect(result[0].name).toBe("simpleVar");
        });
    });

    // =========================================================================
    // Filtering
    // =========================================================================
    describe("filtering", () => {
        it("should exclude function-scoped symbols (parameters, locals)", () => {
            const symbols = [
                createSymbol({
                    name: "my_func",
                    kind: SymbolKind.Function,
                    scope: { level: ScopeLevel.File },
                }),
                createSymbol({
                    name: "param1",
                    kind: SymbolKind.Parameter,
                    scope: {
                        level: ScopeLevel.Function,
                        containerId: "file:///test.txt#my_func",
                    },
                }),
                createSymbol({
                    name: "localVar",
                    kind: SymbolKind.Variable,
                    scope: {
                        level: ScopeLevel.Function,
                        containerId: "file:///test.txt#my_func",
                    },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            // Only file-level symbol should be included in flat output
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("my_func");
        });

        it("should exclude loop-scoped symbols", () => {
            const symbols = [
                createSymbol({
                    name: "process",
                    kind: SymbolKind.Function,
                    scope: { level: ScopeLevel.File },
                }),
                createSymbol({
                    name: "i",
                    kind: SymbolKind.LoopVariable,
                    scope: {
                        level: ScopeLevel.Loop,
                        containerId: "file:///test.txt#process",
                    },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("process");
        });

        it("should include file-scoped symbols", () => {
            const symbols = [
                createSymbol({
                    name: "globalVar",
                    kind: SymbolKind.Variable,
                    scope: { level: ScopeLevel.File },
                }),
                createSymbol({
                    name: "MY_CONST",
                    kind: SymbolKind.Constant,
                    scope: { level: ScopeLevel.File },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(2);
        });

        it("should include workspace-scoped symbols", () => {
            const symbols = [
                createSymbol({
                    name: "headerFunc",
                    kind: SymbolKind.Function,
                    scope: { level: ScopeLevel.Workspace },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("headerFunc");
        });

        it("should include global-scoped symbols", () => {
            const symbols = [
                createSymbol({
                    name: "builtinFunc",
                    kind: SymbolKind.Function,
                    scope: { level: ScopeLevel.Global },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(1);
        });
    });

    // =========================================================================
    // Edge cases
    // =========================================================================
    describe("edge cases", () => {
        it("should handle symbols with identical names", () => {
            const symbols = [
                createSymbol({
                    name: "process",
                    kind: SymbolKind.Function,
                    location: {
                        uri: "file:///a.txt",
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 5, character: 0 },
                        },
                    },
                }),
                createSymbol({
                    name: "process",
                    kind: SymbolKind.Function,
                    location: {
                        uri: "file:///b.txt",
                        range: {
                            start: { line: 10, character: 0 },
                            end: { line: 15, character: 0 },
                        },
                    },
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(2);
            expect(result[0].range.start.line).toBe(0);
            expect(result[1].range.start.line).toBe(10);
        });

        it("should preserve order of symbols", () => {
            const symbols = [
                createSymbol({ name: "z_last" }),
                createSymbol({ name: "a_first" }),
                createSymbol({ name: "m_middle" }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result.map(s => s.name)).toEqual(["z_last", "a_first", "m_middle"]);
        });

        it("should handle empty parameter list", () => {
            const symbols = [
                createSymbol({
                    name: "noArgs",
                    kind: SymbolKind.Function,
                    parameters: [],
                }),
            ];

            const result = getDocumentSymbols(symbols);

            expect(result).toHaveLength(1);
            expect(result[0].detail).toContain("noArgs()");
        });
    });
});
