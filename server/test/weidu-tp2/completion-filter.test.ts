/**
 * Tests for weidu-tp2/completion/filter.ts - Completion context filtering rules.
 * Validates that CATEGORY_EXCLUSIONS use only valid contexts and that
 * each category is correctly included/excluded per context.
 */

import { describe, expect, it } from "vitest";
import { CompletionItemKind } from "vscode-languageserver/node";
import { CompletionCategory, CompletionContext, type Tp2CompletionItem } from "../../src/weidu-tp2/completion/types";
import { CATEGORY_EXCLUSIONS, VALID_CONTEXTS, filterItemsByContext } from "../../src/weidu-tp2/completion/filter";

describe("completion-filter", () => {
    // =========================================================================
    // Exclusion rule validation
    // =========================================================================
    describe("CATEGORY_EXCLUSIONS validation", () => {
        it("should only contain valid CompletionContext values in exclusions", () => {
            for (const [category, exclusions] of Object.entries(CATEGORY_EXCLUSIONS)) {
                for (const ctx of exclusions!) {
                    expect(
                        VALID_CONTEXTS.has(ctx),
                        `Invalid context "${ctx}" in exclusion for category "${category}"`
                    ).toBe(true);
                }
            }
        });

        it("should only use valid CompletionCategory keys", () => {
            const validCategories = new Set(Object.values(CompletionCategory));
            for (const key of Object.keys(CATEGORY_EXCLUSIONS)) {
                expect(
                    validCategories.has(key as CompletionCategory),
                    `Invalid category key "${key}" in CATEGORY_EXCLUSIONS`
                ).toBe(true);
            }
        });
    });

    // =========================================================================
    // DimorphicFunctions category rules
    // =========================================================================
    describe("DimorphicFunctions exclusions", () => {
        const exclusions = CATEGORY_EXCLUSIONS[CompletionCategory.DimorphicFunctions]!;

        it("should be included in lafName context (LAF calls dimorphic functions)", () => {
            expect(exclusions).not.toContain(CompletionContext.LafName);
        });

        it("should be included in lpfName context (LPF calls dimorphic functions)", () => {
            expect(exclusions).not.toContain(CompletionContext.LpfName);
        });

        it("should be included in action context", () => {
            expect(exclusions).not.toContain(CompletionContext.Action);
        });

        it("should be included in patch context", () => {
            expect(exclusions).not.toContain(CompletionContext.Patch);
        });

        it("should be excluded from lamName context (macros only)", () => {
            expect(exclusions).toContain(CompletionContext.LamName);
        });

        it("should be excluded from lpmName context (macros only)", () => {
            expect(exclusions).toContain(CompletionContext.LpmName);
        });
    });

    // =========================================================================
    // ActionMacros category rules
    // =========================================================================
    describe("ActionMacros exclusions", () => {
        const exclusions = CATEGORY_EXCLUSIONS[CompletionCategory.ActionMacros]!;

        it("should be included in lamName context (LAM calls action macros)", () => {
            expect(exclusions).not.toContain(CompletionContext.LamName);
        });

        it("should be included in action context", () => {
            expect(exclusions).not.toContain(CompletionContext.Action);
        });

        it("should be excluded from patch context", () => {
            expect(exclusions).toContain(CompletionContext.Patch);
        });

        it("should be excluded from lafName context (functions only)", () => {
            expect(exclusions).toContain(CompletionContext.LafName);
        });

        it("should be excluded from lpfName context (patch functions only)", () => {
            expect(exclusions).toContain(CompletionContext.LpfName);
        });

        it("should be excluded from lpmName context (patch macros only)", () => {
            expect(exclusions).toContain(CompletionContext.LpmName);
        });
    });

    // =========================================================================
    // PatchMacros category rules
    // =========================================================================
    describe("PatchMacros exclusions", () => {
        const exclusions = CATEGORY_EXCLUSIONS[CompletionCategory.PatchMacros]!;

        it("should be included in lpmName context (LPM calls patch macros)", () => {
            expect(exclusions).not.toContain(CompletionContext.LpmName);
        });

        it("should be included in patch context", () => {
            expect(exclusions).not.toContain(CompletionContext.Patch);
        });

        it("should be excluded from action context", () => {
            expect(exclusions).toContain(CompletionContext.Action);
        });

        it("should be excluded from lafName context (functions only)", () => {
            expect(exclusions).toContain(CompletionContext.LafName);
        });

        it("should be excluded from lpfName context (patch functions only)", () => {
            expect(exclusions).toContain(CompletionContext.LpfName);
        });

        it("should be excluded from lamName context (action macros only)", () => {
            expect(exclusions).toContain(CompletionContext.LamName);
        });
    });

    // =========================================================================
    // Items without category
    // =========================================================================
    describe("items without category", () => {
        it("should pass through filter in action context", () => {
            const items: Tp2CompletionItem[] = [
                { label: "no_category_var", kind: CompletionItemKind.Variable },
                { label: "with_category", kind: CompletionItemKind.Function, category: CompletionCategory.ActionFunctions },
            ];
            const result = filterItemsByContext(items, [CompletionContext.Action]);
            const labels = result.map(i => i.label);
            expect(labels).toContain("no_category_var");
            expect(labels).toContain("with_category");
        });

        it("should pass through filter in patch context", () => {
            const items: Tp2CompletionItem[] = [
                { label: "local_var", kind: CompletionItemKind.Variable },
            ];
            const result = filterItemsByContext(items, [CompletionContext.Patch]);
            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("local_var");
        });
    });
});
