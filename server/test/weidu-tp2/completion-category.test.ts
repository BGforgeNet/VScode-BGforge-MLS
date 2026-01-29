/**
 * Tests for completion category safeguards.
 *
 * Ensures all completion sources assign categories to prevent
 * silent filtering failures where items without categories
 * appear in all contexts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CompletionItemKind } from "vscode-languageserver/node";
import { filterItemsByContext, clearMissingCategoryWarnings } from "../../src/weidu-tp2/completion/filter";
import type { CompletionItemWithCategory } from "../../src/shared/completion-context";

describe("Completion Category Safeguards", () => {
    describe("filterItemsByContext warning", () => {
        let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            clearMissingCategoryWarnings();
            consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        });

        afterEach(() => {
            consoleWarnSpy.mockRestore();
        });

        it("logs warning for items without category", () => {
            const itemWithoutCategory = {
                label: "TEST_ITEM",
                kind: CompletionItemKind.Constant,
                // No category field
            };

            filterItemsByContext([itemWithoutCategory], ["funcParamName"]);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining("TEST_ITEM") && expect.stringContaining("no category")
            );
        });

        it("does not log warning for items with category", () => {
            const itemWithCategory: CompletionItemWithCategory = {
                label: "MY_CONSTANT",
                kind: CompletionItemKind.Constant,
                category: "constants",
            };

            filterItemsByContext([itemWithCategory], ["funcParamName"]);

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("does not log warning in unknown context", () => {
            const itemWithoutCategory = {
                label: "TEST_ITEM",
                kind: CompletionItemKind.Constant,
            };

            filterItemsByContext([itemWithoutCategory], ["unknown"]);

            // Unknown context returns early, no filtering happens
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("still includes items without category (permissive)", () => {
            const itemWithoutCategory = {
                label: "UNCATEGORIZED",
                kind: CompletionItemKind.Constant,
            };

            const result = filterItemsByContext([itemWithoutCategory], ["funcParamName"]);

            // Item should still be included (permissive default)
            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("UNCATEGORIZED");
        });
    });

    describe("category exclusion rules", () => {
        it("excludes constants from funcParamName context", () => {
            const constantItem: CompletionItemWithCategory = {
                label: "MY_CONSTANT",
                kind: CompletionItemKind.Constant,
                category: "constants",
            };

            const result = filterItemsByContext([constantItem], ["funcParamName"]);

            expect(result).toHaveLength(0);
        });

        it("excludes vars from funcParamName context", () => {
            const varItem: CompletionItemWithCategory = {
                label: "my_var",
                kind: CompletionItemKind.Variable,
                category: "vars",
            };

            const result = filterItemsByContext([varItem], ["funcParamName"]);

            expect(result).toHaveLength(0);
        });

        it("includes actionFunctions in action context", () => {
            const funcItem: CompletionItemWithCategory = {
                label: "my_function",
                kind: CompletionItemKind.Function,
                category: "actionFunctions",
            };

            const result = filterItemsByContext([funcItem], ["action"]);

            expect(result).toHaveLength(1);
        });

        it("excludes actionFunctions from patch context", () => {
            const funcItem: CompletionItemWithCategory = {
                label: "my_function",
                kind: CompletionItemKind.Function,
                category: "actionFunctions",
            };

            const result = filterItemsByContext([funcItem], ["patch"]);

            expect(result).toHaveLength(0);
        });
    });
});
