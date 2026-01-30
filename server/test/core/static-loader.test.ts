/**
 * Tests for core/static-loader.ts - Static symbol loading from JSON.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CompletionItemKind, MarkupKind } from "vscode-languageserver/node";
import { SymbolKind, ScopeLevel, SourceType } from "../../src/core/symbol";
import { CompletionCategory, type CompletionItemWithCategory } from "../../src/shared/completion-context";

// Mock fs.readFileSync before importing the module
vi.mock("fs", () => ({
    readFileSync: vi.fn(),
}));

// Mock conlog to avoid LSP connection requirement
vi.mock("../../src/common", () => ({
    conlog: vi.fn(),
}));

import { loadStaticSymbols } from "../../src/core/static-loader";
import { readFileSync } from "fs";

const mockReadFileSync = vi.mocked(readFileSync);

describe("static-loader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("loadStaticSymbols()", () => {
        it("should return empty array when file not found", () => {
            mockReadFileSync.mockImplementation(() => {
                throw new Error("ENOENT: no such file");
            });

            const result = loadStaticSymbols("nonexistent-lang");

            expect(result).toEqual([]);
        });

        it("should return empty array for empty JSON array", () => {
            mockReadFileSync.mockReturnValue("[]");

            const result = loadStaticSymbols("test-lang");

            expect(result).toEqual([]);
        });

        it("should convert simple keyword to Symbol", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "IF",
                    kind: CompletionItemKind.Keyword,
                    category: "keywords",
                },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("IF");
            expect(result[0].kind).toBe(SymbolKind.Constant);
            expect(result[0].scope.level).toBe(ScopeLevel.Global);
            expect(result[0].source.type).toBe(SourceType.Static);
        });

        it("should convert action to Symbol with Action kind", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "ActionOverride",
                    kind: CompletionItemKind.Function,
                    category: "actions",
                    documentation: {
                        kind: "markdown",
                        value: "```\nActionOverride(O:Actor, A:Action)\n```\nThis action...",
                    },
                },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("ActionOverride");
            expect(result[0].kind).toBe(SymbolKind.Action);
        });

        it("should convert trigger to Symbol with Trigger kind", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "TriggerOverride",
                    kind: CompletionItemKind.Function,
                    category: "triggers",
                },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("TriggerOverride");
            expect(result[0].kind).toBe(SymbolKind.Trigger);
        });

        it("should preserve completion item structure", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "TestAction",
                    kind: CompletionItemKind.Function,
                    category: "actions",
                    detail: "TestAction(I:Param)",
                    tags: [1], // deprecated
                },
            ]));

            const result = loadStaticSymbols("test-lang");
            const completion = result[0].completion;

            expect(completion.label).toBe("TestAction");
            expect(completion.kind).toBe(CompletionItemKind.Function);
            expect(completion.detail).toBe("TestAction(I:Param)");
            expect(completion.tags).toEqual([1]);
        });

        it("should extract hover from documentation", () => {
            const docContent = "```baf\nMyAction()\n```\nDoes something.";
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "MyAction",
                    kind: CompletionItemKind.Function,
                    category: "actions",
                    documentation: {
                        kind: "markdown",
                        value: docContent,
                    },
                },
            ]));

            const result = loadStaticSymbols("test-lang");
            const hover = result[0].hover;

            expect(hover.contents).toEqual({
                kind: MarkupKind.Markdown,
                value: docContent,
            });
        });

        it("should create minimal hover when no documentation", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "SimpleKeyword",
                    kind: CompletionItemKind.Keyword,
                    category: "keywords",
                },
            ]));

            const result = loadStaticSymbols("test-lang");
            const hover = result[0].hover;

            expect(hover.contents).toEqual({
                kind: MarkupKind.Markdown,
                value: "SimpleKeyword",
            });
        });

        it("should handle string documentation", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "OldStyle",
                    kind: CompletionItemKind.Function,
                    documentation: "Plain text documentation",
                },
            ]));

            const result = loadStaticSymbols("test-lang");
            const hover = result[0].hover;

            expect(hover.contents).toEqual({
                kind: MarkupKind.Markdown,
                value: "Plain text documentation",
            });
        });

        it("should fallback to CompletionItemKind when category unknown", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "Unknown",
                    kind: CompletionItemKind.Variable,
                    category: "unknown_category",
                },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result[0].kind).toBe(SymbolKind.Variable);
        });

        it("should convert multiple items", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                { label: "IF", kind: CompletionItemKind.Keyword, category: "keywords" },
                { label: "THEN", kind: CompletionItemKind.Keyword, category: "keywords" },
                { label: "ActionX", kind: CompletionItemKind.Function, category: "actions" },
                { label: "TriggerY", kind: CompletionItemKind.Function, category: "triggers" },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result).toHaveLength(4);
            expect(result.map(s => s.name)).toEqual(["IF", "THEN", "ActionX", "TriggerY"]);
            expect(result.map(s => s.kind)).toEqual([
                SymbolKind.Constant,
                SymbolKind.Constant,
                SymbolKind.Action,
                SymbolKind.Trigger,
            ]);
        });

        it("should set null location for static symbols", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                { label: "Test", kind: CompletionItemKind.Function },
            ]));

            const result = loadStaticSymbols("test-lang");

            // Static symbols have no source file, so location is null
            expect(result[0].location).toBeNull();
        });

        it("should preserve category from JSON on completion item", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "COPY",
                    kind: CompletionItemKind.Function,
                    category: "action",
                },
            ]));

            const result = loadStaticSymbols("test-lang");
            const completion = result[0].completion as CompletionItemWithCategory;

            expect(completion.category).toBe(CompletionCategory.Action);
        });

        it("should preserve category for patch items", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                {
                    label: "WRITE_BYTE",
                    kind: CompletionItemKind.Function,
                    category: "patch",
                },
            ]));

            const result = loadStaticSymbols("test-lang");
            const completion = result[0].completion as CompletionItemWithCategory;

            expect(completion.category).toBe(CompletionCategory.Patch);
        });

        it("should set null source.uri for static symbols", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                { label: "Test", kind: CompletionItemKind.Function },
            ]));

            const result = loadStaticSymbols("test-lang");

            // Static symbols have no source file
            expect(result[0].source.type).toBe(SourceType.Static);
            expect(result[0].source.uri).toBeNull();
        });

        it("should map functions category to Function kind", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                { label: "my_func", kind: CompletionItemKind.Function, category: "functions" },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result[0].kind).toBe(SymbolKind.Function);
        });

        it("should map procedures category to Procedure kind", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                { label: "my_proc", kind: CompletionItemKind.Function, category: "procedures" },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result[0].kind).toBe(SymbolKind.Procedure);
        });

        it("should map macros category to Macro kind", () => {
            mockReadFileSync.mockReturnValue(JSON.stringify([
                { label: "MY_MACRO", kind: CompletionItemKind.Snippet, category: "macros" },
            ]));

            const result = loadStaticSymbols("test-lang");

            expect(result[0].kind).toBe(SymbolKind.Macro);
        });
    });
});
