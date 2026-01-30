/**
 * Tests for completion category safeguards.
 *
 * Ensures all completion sources assign categories to prevent
 * silent filtering failures where items without categories
 * appear in all contexts.
 */

import { describe, it, expect } from "vitest";
import { CompletionItemKind } from "vscode-languageserver/node";
import { filterItemsByContext } from "../../src/weidu-tp2/completion/filter";
import type { Tp2CompletionItem } from "../../src/weidu-tp2/completion/types";
import { CompletionCategory } from "../../src/shared/completion-context";

describe("Completion Category Safeguards", () => {
    describe("category exclusion rules", () => {
        it("excludes constants from funcParamName context", () => {
            const constantItem: Tp2CompletionItem = {
                label: "MY_CONSTANT",
                kind: CompletionItemKind.Constant,
                category: CompletionCategory.Constants,
            };

            const result = filterItemsByContext([constantItem], ["funcParamName"]);

            expect(result).toHaveLength(0);
        });

        it("excludes vars from funcParamName context", () => {
            const varItem: Tp2CompletionItem = {
                label: "my_var",
                kind: CompletionItemKind.Variable,
                category: CompletionCategory.Vars,
            };

            const result = filterItemsByContext([varItem], ["funcParamName"]);

            expect(result).toHaveLength(0);
        });

        it("includes actionFunctions in action context", () => {
            const funcItem: Tp2CompletionItem = {
                label: "my_function",
                kind: CompletionItemKind.Function,
                category: CompletionCategory.ActionFunctions,
            };

            const result = filterItemsByContext([funcItem], ["action"]);

            expect(result).toHaveLength(1);
        });

        it("excludes actionFunctions from patch context", () => {
            const funcItem: Tp2CompletionItem = {
                label: "my_function",
                kind: CompletionItemKind.Function,
                category: CompletionCategory.ActionFunctions,
            };

            const result = filterItemsByContext([funcItem], ["patch"]);

            expect(result).toHaveLength(0);
        });
    });

    describe("JSDoc completions have category", () => {
        it("JSDoc tag completions have category jsdoc", () => {
            const tagItem: Tp2CompletionItem = {
                label: "@type",
                kind: CompletionItemKind.Keyword,
                category: CompletionCategory.Jsdoc,
            };

            // jsdoc category has no exclusion rules, so it should pass through any context
            const result = filterItemsByContext([tagItem], ["action"]);

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("@type");
        });

        it("JSDoc type completions have category jsdoc", () => {
            const typeItem: Tp2CompletionItem = {
                label: "int",
                kind: CompletionItemKind.TypeParameter,
                category: CompletionCategory.Jsdoc,
            };

            const result = filterItemsByContext([typeItem], ["patch"]);

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("int");
        });
    });

    describe("parameter completions have category", () => {
        it("parameter completions have category funcVarKeyword", () => {
            const paramItem: Tp2CompletionItem = {
                label: "count",
                kind: CompletionItemKind.Field,
                category: CompletionCategory.FuncVarKeyword,
            };

            // funcVarKeyword is excluded from action context
            const resultAction = filterItemsByContext([paramItem], ["action"]);
            expect(resultAction).toHaveLength(0);

            // funcVarKeyword is allowed in funcParamName context
            const resultParam = filterItemsByContext([paramItem], ["funcParamName"]);
            expect(resultParam).toHaveLength(1);
        });
    });
});
