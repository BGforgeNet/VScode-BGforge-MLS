/**
 * Tests for core/symbol-builder.ts - Symbol construction with pre-computed LSP data.
 *
 * The symbol builder transforms raw symbol data into Symbol objects with
 * pre-computed completion, hover, and signature information ready for LSP responses.
 */

import { describe, expect, it } from "vitest";
import { CompletionItemKind, MarkupKind } from "vscode-languageserver/node";
import {
    buildSymbol,
    type RawSymbolData,
    type ParameterData,
} from "../../src/core/symbol-builder";
import { SymbolKind, ScopeLevel, SourceType } from "../../src/core/symbol";

// =============================================================================
// Test fixtures
// =============================================================================

function createLocation(uri = "file:///test.txt", line = 0) {
    return {
        uri,
        range: {
            start: { line, character: 0 },
            end: { line, character: 10 },
        },
    };
}

function createRawSymbol(overrides: Partial<RawSymbolData> & { name: string }): RawSymbolData {
    return {
        name: overrides.name,
        kind: overrides.kind ?? SymbolKind.Variable,
        location: overrides.location ?? createLocation(),
        scope: overrides.scope ?? { level: ScopeLevel.File },
        source: overrides.source ?? { type: SourceType.Document, uri: "file:///test.txt" },
        parameters: overrides.parameters,
        description: overrides.description,
        returnType: overrides.returnType,
        type: overrides.type,
        displayPath: overrides.displayPath,
    };
}

describe("symbol-builder", () => {
    // =========================================================================
    // Basic symbol construction
    // =========================================================================
    describe("buildSymbol() basics", () => {
        it("should create a symbol with all core fields", () => {
            const raw = createRawSymbol({
                name: "myVar",
                kind: SymbolKind.Variable,
                location: createLocation("file:///test.ssl", 5),
                scope: { level: ScopeLevel.File },
                source: { type: SourceType.Document, uri: "file:///test.ssl" },
            });

            const symbol = buildSymbol(raw);

            expect(symbol.name).toBe("myVar");
            expect(symbol.kind).toBe(SymbolKind.Variable);
            expect(symbol.location.uri).toBe("file:///test.ssl");
            expect(symbol.location.range.start.line).toBe(5);
            expect(symbol.scope.level).toBe(ScopeLevel.File);
            expect(symbol.source.type).toBe(SourceType.Document);
        });

        it("should preserve scope containerId for function-scoped symbols", () => {
            const raw = createRawSymbol({
                name: "i",
                kind: SymbolKind.LoopVariable,
                scope: {
                    level: ScopeLevel.Loop,
                    containerId: "file:///test.ssl#my_procedure",
                },
            });

            const symbol = buildSymbol(raw);

            expect(symbol.scope.containerId).toBe("file:///test.ssl#my_procedure");
        });

        it("should set displayPath on source when provided", () => {
            const raw = createRawSymbol({
                name: "header_func",
                kind: SymbolKind.Function,
                source: { type: SourceType.Workspace, uri: "file:///project/lib/utils.tph" },
                displayPath: "lib/utils.tph",
            });

            const symbol = buildSymbol(raw);

            expect(symbol.source.displayPath).toBe("lib/utils.tph");
        });
    });

    // =========================================================================
    // Completion item generation
    // =========================================================================
    describe("completion generation", () => {
        it("should generate completion for variable", () => {
            const raw = createRawSymbol({
                name: "counter",
                kind: SymbolKind.Variable,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.label).toBe("counter");
            expect(symbol.completion.kind).toBe(CompletionItemKind.Variable);
        });

        it("should generate completion for constant", () => {
            const raw = createRawSymbol({
                name: "MAX_SIZE",
                kind: SymbolKind.Constant,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.label).toBe("MAX_SIZE");
            expect(symbol.completion.kind).toBe(CompletionItemKind.Constant);
        });

        it("should generate completion for function with detail", () => {
            const raw = createRawSymbol({
                name: "process_items",
                kind: SymbolKind.Function,
                parameters: [
                    { name: "count", type: "INT_VAR" },
                    { name: "name", type: "STR_VAR" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.label).toBe("process_items");
            expect(symbol.completion.kind).toBe(CompletionItemKind.Function);
            expect(symbol.completion.detail).toContain("process_items");
            expect(symbol.completion.detail).toContain("count");
        });

        it("should generate completion for procedure", () => {
            const raw = createRawSymbol({
                name: "my_proc",
                kind: SymbolKind.Procedure,
                parameters: [{ name: "arg1" }],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.label).toBe("my_proc");
            expect(symbol.completion.kind).toBe(CompletionItemKind.Function);
        });

        it("should generate completion for macro as snippet", () => {
            const raw = createRawSymbol({
                name: "MY_MACRO",
                kind: SymbolKind.Macro,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.label).toBe("MY_MACRO");
            expect(symbol.completion.kind).toBe(CompletionItemKind.Snippet);
        });

        it("should include displayPath in labelDetails when present", () => {
            const raw = createRawSymbol({
                name: "header_func",
                kind: SymbolKind.Function,
                displayPath: "lib/utils.tph",
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.labelDetails?.description).toBe("lib/utils.tph");
        });

        it("should not include labelDetails when displayPath is absent", () => {
            const raw = createRawSymbol({
                name: "local_func",
                kind: SymbolKind.Function,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.labelDetails).toBeUndefined();
        });
    });

    // =========================================================================
    // Hover content generation
    // =========================================================================
    describe("hover generation", () => {
        it("should generate hover with markdown content", () => {
            const raw = createRawSymbol({
                name: "myVar",
                kind: SymbolKind.Variable,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.hover.contents).toBeDefined();
            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.kind).toBe(MarkupKind.Markdown);
        });

        it("should include variable name in hover", () => {
            const raw = createRawSymbol({
                name: "counter",
                kind: SymbolKind.Variable,
            });

            const symbol = buildSymbol(raw);

            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("counter");
        });

        it("should include type in hover when provided", () => {
            const raw = createRawSymbol({
                name: "count",
                kind: SymbolKind.Variable,
                type: "integer",
            });

            const symbol = buildSymbol(raw);

            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("integer");
        });

        it("should include description in hover when provided", () => {
            const raw = createRawSymbol({
                name: "max_items",
                kind: SymbolKind.Constant,
                description: "Maximum number of items allowed",
            });

            const symbol = buildSymbol(raw);

            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("Maximum number of items allowed");
        });

        it("should generate hover for function with signature", () => {
            const raw = createRawSymbol({
                name: "calculate",
                kind: SymbolKind.Function,
                parameters: [
                    { name: "x", type: "INT_VAR" },
                    { name: "y", type: "INT_VAR" },
                ],
                returnType: "RET",
            });

            const symbol = buildSymbol(raw);

            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("calculate");
            expect(contents.value).toContain("x");
            expect(contents.value).toContain("y");
        });

        it("should include parameter descriptions in hover", () => {
            const raw = createRawSymbol({
                name: "process",
                kind: SymbolKind.Function,
                parameters: [
                    { name: "count", type: "INT_VAR", description: "Number of items to process" },
                ],
            });

            const symbol = buildSymbol(raw);

            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("Number of items to process");
        });

        it("should include displayPath in hover for workspace symbols", () => {
            const raw = createRawSymbol({
                name: "utils_func",
                kind: SymbolKind.Function,
                source: { type: SourceType.Workspace, uri: "file:///project/lib/utils.tph" },
                displayPath: "lib/utils.tph",
            });

            const symbol = buildSymbol(raw);

            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("lib/utils.tph");
        });
    });

    // =========================================================================
    // Signature generation (for callables)
    // =========================================================================
    describe("signature generation", () => {
        it("should not generate signature for variables", () => {
            const raw = createRawSymbol({
                name: "myVar",
                kind: SymbolKind.Variable,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature).toBeUndefined();
        });

        it("should not generate signature for constants", () => {
            const raw = createRawSymbol({
                name: "MY_CONST",
                kind: SymbolKind.Constant,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature).toBeUndefined();
        });

        it("should generate signature for function", () => {
            const raw = createRawSymbol({
                name: "do_stuff",
                kind: SymbolKind.Function,
                parameters: [
                    { name: "x", type: "INT_VAR" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature).toBeDefined();
            expect(symbol.signature?.label).toContain("do_stuff");
            expect(symbol.signature?.label).toContain("x");
        });

        it("should generate signature for procedure", () => {
            const raw = createRawSymbol({
                name: "my_proc",
                kind: SymbolKind.Procedure,
                parameters: [
                    { name: "arg1" },
                    { name: "arg2" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature).toBeDefined();
            expect(symbol.signature?.label).toContain("my_proc");
        });

        it("should generate signature for macro with parameters", () => {
            const raw = createRawSymbol({
                name: "MY_MACRO",
                kind: SymbolKind.Macro,
                parameters: [
                    { name: "param1" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature).toBeDefined();
            expect(symbol.signature?.label).toContain("MY_MACRO");
        });

        it("should not generate signature for macro without parameters", () => {
            const raw = createRawSymbol({
                name: "SIMPLE_MACRO",
                kind: SymbolKind.Macro,
                // No parameters - constant-like macro
            });

            const symbol = buildSymbol(raw);

            // Constant-like macros don't need signature help
            expect(symbol.signature).toBeUndefined();
        });

        it("should include parameter information in signature", () => {
            const raw = createRawSymbol({
                name: "calc",
                kind: SymbolKind.Function,
                parameters: [
                    { name: "a", type: "INT_VAR", description: "First operand" },
                    { name: "b", type: "INT_VAR", description: "Second operand" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature?.parameters).toHaveLength(2);
            expect(symbol.signature?.parameters?.[0].label).toContain("a");
            expect(symbol.signature?.parameters?.[1].label).toContain("b");
        });

        it("should include documentation in signature when description provided", () => {
            const raw = createRawSymbol({
                name: "helper",
                kind: SymbolKind.Function,
                parameters: [],
                description: "Helper function that does something",
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature?.documentation).toBe("Helper function that does something");
        });

        it("should generate signature for action", () => {
            const raw = createRawSymbol({
                name: "ActionCopy",
                kind: SymbolKind.Action,
                parameters: [
                    { name: "source", type: "O:Object" },
                    { name: "dest", type: "O:Object" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature).toBeDefined();
            expect(symbol.signature?.label).toContain("ActionCopy");
        });

        it("should generate signature for trigger", () => {
            const raw = createRawSymbol({
                name: "TriggerOverride",
                kind: SymbolKind.Trigger,
                parameters: [
                    { name: "target", type: "O:Object" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature).toBeDefined();
            expect(symbol.signature?.label).toContain("TriggerOverride");
        });
    });

    // =========================================================================
    // Edge cases
    // =========================================================================
    describe("edge cases", () => {
        it("should handle empty parameter list", () => {
            const raw = createRawSymbol({
                name: "no_args",
                kind: SymbolKind.Function,
                parameters: [],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.detail).toContain("no_args()");
            expect(symbol.signature?.label).toContain("no_args()");
            expect(symbol.signature?.parameters).toHaveLength(0);
        });

        it("should handle parameters without types", () => {
            const raw = createRawSymbol({
                name: "untyped",
                kind: SymbolKind.Procedure,
                parameters: [
                    { name: "x" },
                    { name: "y" },
                ],
            });

            const symbol = buildSymbol(raw);

            expect(symbol.signature?.label).toContain("x");
            expect(symbol.signature?.label).toContain("y");
        });

        it("should handle special characters in names", () => {
            const raw = createRawSymbol({
                name: "my_func_v2",
                kind: SymbolKind.Function,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.name).toBe("my_func_v2");
            expect(symbol.completion.label).toBe("my_func_v2");
        });

        it("should handle state symbols", () => {
            const raw = createRawSymbol({
                name: "DIALOG_START",
                kind: SymbolKind.State,
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.kind).toBe(CompletionItemKind.Class);
            expect(symbol.signature).toBeUndefined();
        });

        it("should handle component symbols", () => {
            const raw = createRawSymbol({
                name: "MyComponent",
                kind: SymbolKind.Component,
                description: "Main mod component",
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.kind).toBe(CompletionItemKind.Class);
            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("Main mod component");
        });

        it("should handle loop variables", () => {
            const raw = createRawSymbol({
                name: "i",
                kind: SymbolKind.LoopVariable,
                scope: {
                    level: ScopeLevel.Loop,
                    containerId: "file:///test.tp2#process",
                },
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.kind).toBe(CompletionItemKind.Variable);
            expect(symbol.scope.level).toBe(ScopeLevel.Loop);
        });

        it("should handle parameter symbols", () => {
            const raw = createRawSymbol({
                name: "input",
                kind: SymbolKind.Parameter,
                type: "STR_VAR",
            });

            const symbol = buildSymbol(raw);

            expect(symbol.completion.kind).toBe(CompletionItemKind.Variable);
            const contents = symbol.hover.contents as { kind: string; value: string };
            expect(contents.value).toContain("STR_VAR");
        });
    });
});
