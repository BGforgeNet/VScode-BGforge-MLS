/**
 * Unit tests for WeiDU TP2 contextual completion.
 * Tests context detection at various cursor positions.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

// Mock the server module to avoid LSP connection issues
vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { getContextAtPosition } from "../../src/weidu-tp2/completion/context";
import { filterItemsByContext } from "../../src/weidu-tp2/completion/filter";
import type { CompletionContext, Tp2CompletionItem } from "../../src/weidu-tp2/completion/types";
import { initParser } from "../../src/weidu-tp2/parser";
import { CompletionItemKind } from "vscode-languageserver/node";
import { CompletionCategory } from "../../src/shared/completion-context";

beforeAll(async () => {
    await initParser();
});

/**
 * Helper to create a TP2 completion item with required category.
 */
function createItem(label: string, category: CompletionCategory): Tp2CompletionItem {
    return {
        label,
        kind: CompletionItemKind.Keyword,
        category,
    };
}

/**
 * Helper to check if items are filtered correctly.
 * Accepts either a single context or an array of contexts.
 */
function expectFiltering(context: CompletionContext | CompletionContext[], category: CompletionCategory, shouldBeIncluded: boolean) {
    const items = [createItem("TEST_ITEM", category)];
    const contexts = Array.isArray(context) ? context : [context];
    const filtered = filterItemsByContext(items, contexts);
    if (shouldBeIncluded) {
        expect(filtered).toHaveLength(1);
        expect(filtered[0].label).toBe("TEST_ITEM");
    } else {
        expect(filtered).toHaveLength(0);
    }
}

describe("completion-context: category filtering", () => {
    it("validates all completion items have valid categories", () => {
        // This test ensures all items returned by completion have a category field
        // Missing categories would be caught here (they'd show as undefined)
        const testCategories: CompletionCategory[] = [
            CompletionCategory.Prologue, CompletionCategory.Flag, CompletionCategory.ComponentFlag, CompletionCategory.Language,
            CompletionCategory.Action, CompletionCategory.Patch,
            CompletionCategory.Constants, CompletionCategory.Vars, CompletionCategory.Value, CompletionCategory.When, CompletionCategory.OptGlob, CompletionCategory.OptCase, CompletionCategory.OptExact, CompletionCategory.Caching, CompletionCategory.ArraySortType,
            CompletionCategory.FuncVarKeyword,
            CompletionCategory.ActionFunctions, CompletionCategory.PatchFunctions, CompletionCategory.DimorphicFunctions,
            CompletionCategory.ActionMacros, CompletionCategory.PatchMacros,
            CompletionCategory.Jsdoc,
        ];

        // Verify each category can be used in filtering
        for (const category of testCategories) {
            const items = [createItem(`TEST_${category}`, category)];
            const filtered = filterItemsByContext(items, ["unknown"]);
            expect(filtered).toHaveLength(1);
            expect((filtered[0] as any).category).toBe(category);
        }
    });

    // ===== Rule 1: patch/patchFunctions excluded from action context =====

    it("allows action category in action context", () => {
        expectFiltering("action", CompletionCategory.Action, true);
    });

    it("rejects patch category in action context", () => {
        expectFiltering("action", CompletionCategory.Patch, false);
    });

    it("rejects patch category in actionKeyword context", () => {
        expectFiltering("actionKeyword", CompletionCategory.Patch, false);
    });

    it("rejects patchFunctions in action context", () => {
        expectFiltering("action", CompletionCategory.PatchFunctions, false);
    });

    it("rejects patchFunctions in actionKeyword context", () => {
        expectFiltering("actionKeyword", CompletionCategory.PatchFunctions, false);
    });

    // ===== Rule 2: action/actionFunctions excluded from patch context =====

    it("allows patch category in patch context", () => {
        expectFiltering("patch", CompletionCategory.Patch, true);
    });

    it("rejects action category in patch context", () => {
        expectFiltering("patch", CompletionCategory.Action, false);
    });

    it("rejects action category in patchKeyword context", () => {
        expectFiltering("patchKeyword", CompletionCategory.Action, false);
    });

    it("rejects actionFunctions in patch context", () => {
        expectFiltering("patch", CompletionCategory.ActionFunctions, false);
    });

    it("rejects actionFunctions in patchKeyword context", () => {
        expectFiltering("patchKeyword", CompletionCategory.ActionFunctions, false);
    });

    it("allows actionFunctions in action context", () => {
        expectFiltering("action", CompletionCategory.ActionFunctions, true);
    });

    it("allows actionFunctions in actionKeyword context", () => {
        expectFiltering("actionKeyword", CompletionCategory.ActionFunctions, true);
    });

    it("allows patchFunctions in patch context", () => {
        expectFiltering("patch", CompletionCategory.PatchFunctions, true);
    });

    it("allows patchFunctions in patchKeyword context", () => {
        expectFiltering("patchKeyword", CompletionCategory.PatchFunctions, true);
    });

    // ===== Name context filtering: functions/macros appear in their target context =====

    // Each callable category must appear in its matching name context (LafName, LpfName, etc.)
    // and be excluded from all other name contexts.

    it("allows patchFunctions in lpfName context", () => {
        expectFiltering("lpfName", CompletionCategory.PatchFunctions, true);
    });

    it("rejects patchFunctions in lafName context", () => {
        expectFiltering("lafName", CompletionCategory.PatchFunctions, false);
    });

    it("rejects patchFunctions in lamName context", () => {
        expectFiltering("lamName", CompletionCategory.PatchFunctions, false);
    });

    it("rejects patchFunctions in lpmName context", () => {
        expectFiltering("lpmName", CompletionCategory.PatchFunctions, false);
    });

    it("allows actionFunctions in lafName context", () => {
        expectFiltering("lafName", CompletionCategory.ActionFunctions, true);
    });

    it("rejects actionFunctions in lpfName context", () => {
        expectFiltering("lpfName", CompletionCategory.ActionFunctions, false);
    });

    it("rejects actionFunctions in lamName context", () => {
        expectFiltering("lamName", CompletionCategory.ActionFunctions, false);
    });

    it("rejects actionFunctions in lpmName context", () => {
        expectFiltering("lpmName", CompletionCategory.ActionFunctions, false);
    });

    it("allows actionMacros in lamName context", () => {
        expectFiltering("lamName", CompletionCategory.ActionMacros, true);
    });

    it("rejects actionMacros in lafName context", () => {
        expectFiltering("lafName", CompletionCategory.ActionMacros, false);
    });

    it("rejects actionMacros in lpfName context", () => {
        expectFiltering("lpfName", CompletionCategory.ActionMacros, false);
    });

    it("rejects actionMacros in lpmName context", () => {
        expectFiltering("lpmName", CompletionCategory.ActionMacros, false);
    });

    it("allows patchMacros in lpmName context", () => {
        expectFiltering("lpmName", CompletionCategory.PatchMacros, true);
    });

    it("rejects patchMacros in lafName context", () => {
        expectFiltering("lafName", CompletionCategory.PatchMacros, false);
    });

    it("rejects patchMacros in lpfName context", () => {
        expectFiltering("lpfName", CompletionCategory.PatchMacros, false);
    });

    it("rejects patchMacros in lamName context", () => {
        expectFiltering("lamName", CompletionCategory.PatchMacros, false);
    });

    it("allows dimorphicFunctions in lafName context", () => {
        expectFiltering("lafName", CompletionCategory.DimorphicFunctions, true);
    });

    it("allows dimorphicFunctions in lpfName context", () => {
        expectFiltering("lpfName", CompletionCategory.DimorphicFunctions, true);
    });

    it("rejects dimorphicFunctions in lamName context", () => {
        expectFiltering("lamName", CompletionCategory.DimorphicFunctions, false);
    });

    it("rejects dimorphicFunctions in lpmName context", () => {
        expectFiltering("lpmName", CompletionCategory.DimorphicFunctions, false);
    });

    // Non-callable categories must be excluded from ALL name contexts

    it("rejects constants from all name contexts", () => {
        expectFiltering("lafName", CompletionCategory.Constants, false);
        expectFiltering("lpfName", CompletionCategory.Constants, false);
        expectFiltering("lamName", CompletionCategory.Constants, false);
        expectFiltering("lpmName", CompletionCategory.Constants, false);
    });

    it("rejects patch commands from all name contexts", () => {
        expectFiltering("lafName", CompletionCategory.Patch, false);
        expectFiltering("lpfName", CompletionCategory.Patch, false);
        expectFiltering("lamName", CompletionCategory.Patch, false);
        expectFiltering("lpmName", CompletionCategory.Patch, false);
    });

    it("rejects action commands from all name contexts", () => {
        expectFiltering("lafName", CompletionCategory.Action, false);
        expectFiltering("lpfName", CompletionCategory.Action, false);
        expectFiltering("lamName", CompletionCategory.Action, false);
        expectFiltering("lpmName", CompletionCategory.Action, false);
    });

    // ===== Categories with no exclusions (show everywhere) =====

    it("allows constants everywhere (no exclusion rules)", () => {
        expectFiltering("action", CompletionCategory.Constants, true);
        expectFiltering("actionKeyword", CompletionCategory.Constants, true);
        expectFiltering("patch", CompletionCategory.Constants, true);
        expectFiltering("patchKeyword", CompletionCategory.Constants, true);
    });

    it("allows prologue category everywhere (no exclusion rules)", () => {
        expectFiltering("prologue", CompletionCategory.Prologue, true);
        expectFiltering("action", CompletionCategory.Prologue, true);
        expectFiltering("patch", CompletionCategory.Prologue, true);
    });

    it("allows componentFlag category everywhere (no exclusion rules)", () => {
        expectFiltering("componentFlag", CompletionCategory.ComponentFlag, true);
        expectFiltering("action", CompletionCategory.ComponentFlag, true);
        expectFiltering("patch", CompletionCategory.ComponentFlag, true);
    });

    it("allows value category everywhere (no exclusion rules)", () => {
        expectFiltering("action", CompletionCategory.Value, true);
        expectFiltering("patch", CompletionCategory.Value, true);
        expectFiltering("componentFlag", CompletionCategory.Value, true);
    });

    // ===== Fallback behavior =====

    it("allows everything in unknown context (fallback)", () => {
        expectFiltering("unknown", CompletionCategory.Prologue, true);
        expectFiltering("unknown", CompletionCategory.Action, true);
        expectFiltering("unknown", CompletionCategory.Patch, true);
    });

    it("allows categories without exclusion rules everywhere", () => {
        // jsdoc has no exclusion rules, so it passes through any context
        expectFiltering("prologue", CompletionCategory.Jsdoc, true);
        expectFiltering("action", CompletionCategory.Jsdoc, true);
        expectFiltering("patch", CompletionCategory.Jsdoc, true);
    });

    // ===== Permissive filtering logic tests =====

    describe("isItemExcluded logic (permissive filtering)", () => {
        it("item with no exclusion rules - should not be excluded from any context", () => {
            const item = createItem("NO_EXCLUSIONS", CompletionCategory.Jsdoc);
            expect(filterItemsByContext([item], ["prologue"])).toHaveLength(1);
            expect(filterItemsByContext([item], ["action"])).toHaveLength(1);
            expect(filterItemsByContext([item], ["patch"])).toHaveLength(1);
            expect(filterItemsByContext([item], ["actionKeyword"])).toHaveLength(1);
        });

        it("item excluded by all contexts - should be excluded", () => {
            // patch is excluded from both action and actionKeyword
            const item = createItem("READ_LONG", CompletionCategory.Patch);
            const filtered = filterItemsByContext([item], ["action", "actionKeyword"]);
            expect(filtered).toHaveLength(0);
        });

        it("item excluded by some but not all contexts - should NOT be excluded (permissive)", () => {
            // patch is excluded from action, but NOT from patch context
            // With contexts ["patch", "action"], should SHOW (permissive - any approval wins)
            const item = createItem("READ_LONG", CompletionCategory.Patch);
            const filtered = filterItemsByContext([item], ["patch", "action"]);
            expect(filtered).toHaveLength(1);
        });

        it("item excluded by none of the contexts - should not be excluded", () => {
            // action is allowed in action context
            const item = createItem("COPY", CompletionCategory.Action);
            const filtered = filterItemsByContext([item], ["action"]);
            expect(filtered).toHaveLength(1);
        });

        it("empty contexts array - should not exclude anything", () => {
            const items = [
                createItem("GROUP", CompletionCategory.ComponentFlag),
                createItem("COPY", CompletionCategory.Action),
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
            ];
            const filtered = filterItemsByContext(items, []);
            expect(filtered).toHaveLength(3);
        });

        it("single context - straightforward exclusion", () => {
            // patch excluded from action
            const item = createItem("READ_LONG", CompletionCategory.Patch);
            const filtered = filterItemsByContext([item], ["action"]);
            expect(filtered).toHaveLength(0);
        });

        it("multiple contexts - unanimous exclusion required", () => {
            // patch is excluded from action and actionKeyword, but NOT from patch
            // With contexts ["action", "actionKeyword"], should be excluded (both reject)
            const item = createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch);
            const filteredBothExclude = filterItemsByContext([item], ["action", "actionKeyword"]);
            expect(filteredBothExclude).toHaveLength(0);

            // With contexts ["action", "patch"], should NOT be excluded (patch allows)
            const filteredOneAllows = filterItemsByContext([item], ["action", "patch"]);
            expect(filteredOneAllows).toHaveLength(1);
        });
    });
});

describe("completion-context: getContextAtPosition", () => {
    describe("comments", () => {
        it("detects regular comment (no completions)", () => {
            const text = `/* regular comment */`;
            const contexts = getContextAtPosition(text, 0, 10, ".tp2");
            expect(contexts).toEqual(["comment"]);
        });

        it("detects JSDoc comment (tag/type completions)", () => {
            const text = `/** JSDoc comment */`;
            const contexts = getContextAtPosition(text, 0, 10, ".tp2");
            expect(contexts).toEqual(["jsdoc"]);
        });

        it("detects line comment (no completions)", () => {
            const text = `// line comment`;
            const contexts = getContextAtPosition(text, 0, 5, ".tp2");
            expect(contexts).toEqual(["comment"]);
        });

        it("detects JSDoc with whitespace before /**", () => {
            const text = `  /** JSDoc */`;
            const contexts = getContextAtPosition(text, 0, 10, ".tp2");
            expect(contexts).toEqual(["jsdoc"]);
        });

        it("distinguishes JSDoc from similar comments", () => {
            const text = `/* * not JSDoc */`;
            const contexts = getContextAtPosition(text, 0, 10, ".tp2");
            expect(contexts).toEqual(["comment"]);
        });
    });

    describe("file extension defaults", () => {
        it("returns patch for .tpp files", () => {
            // Empty file = command position
            const contexts = getContextAtPosition("", 0, 0, ".tpp");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("returns action for .tpa files", () => {
            // Empty file = command position
            const contexts = getContextAtPosition("", 0, 0, ".tpa");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("returns action for .tph files", () => {
            // Empty file = command position
            const contexts = getContextAtPosition("", 0, 0, ".tph");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("returns prologue for empty .tp2 files (BACKUP required)", () => {
            // Empty file - grammar requires BACKUP and AUTHOR (no optionals)
            const contexts = getContextAtPosition("", 0, 0, ".tp2");
            expect(contexts).toEqual(["prologue"]);
        });

        it("returns prologue after BACKUP (AUTHOR required)", () => {
            const afterBackup = `BACKUP ~backup~
`;
            // Line 1: after BACKUP - AUTHOR is still required
            const contexts = getContextAtPosition(afterBackup, 1, 0, ".tp2");
            expect(contexts).toEqual(["prologue"]);
        });

        it("returns flag after BACKUP and AUTHOR (prologue complete)", () => {
            const afterBothRequired = `BACKUP ~backup~
AUTHOR ~me@example.com~

`;
            // Line 2: blank line after both required directives - prologue is complete
            const contexts = getContextAtPosition(afterBothRequired, 2, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });
    });

    describe("tp2 file structure", () => {
        const tp2Content = `BACKUP ~weidu_external/backup/mymod~
AUTHOR ~me~

LANGUAGE ~English~ ~en_US~ ~lang/en_US/setup.tra~

BEGIN ~My Component~
    COPY ~mymod/file.itm~ ~override~
        WRITE_BYTE 0x00 1
    END
`;

        it("detects prologue before LANGUAGE", () => {
            // Line 0: BACKUP
            const contexts = getContextAtPosition(tp2Content, 0, 0, ".tp2");
            expect(contexts).toEqual(["prologue"]);
        });

        it("detects flag after LANGUAGE, before BEGIN", () => {
            // Line 4: empty line after LANGUAGE, before BEGIN
            const contexts = getContextAtPosition(tp2Content, 4, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });

        it("detects action inside component", () => {
            // Line 6: COPY action
            const contexts = getContextAtPosition(tp2Content, 6, 4, ".tp2");
            expect(contexts).toEqual(["action"]);
        });

        it("detects patch inside COPY block", () => {
            // Line 7: WRITE_BYTE patch - at keyword position (command position)
            const contexts = getContextAtPosition(tp2Content, 7, 8, ".tp2");
            expect(contexts).toEqual(["patchKeyword"]);
        });
    });

    describe("tph action file", () => {
        const tphContent = `DEFINE_ACTION_FUNCTION my_func BEGIN
    COPY ~file.itm~ ~override~
        WRITE_BYTE 0x00 1
    END
END
`;

        it("detects action at function level", () => {
            // Line 1: COPY action inside function
            const contexts = getContextAtPosition(tphContent, 1, 4, ".tph");
            expect(contexts).toEqual(["action"]);
        });

        it("detects patch inside COPY", () => {
            // Line 2: WRITE_BYTE inside COPY - at keyword position (command position)
            const contexts = getContextAtPosition(tphContent, 2, 8, ".tph");
            expect(contexts).toEqual(["patchKeyword"]);
        });
    });

    describe("tpp patch file", () => {
        const tppContent = `WRITE_BYTE 0x00 1
READ_ASCII 0x08 name (8)
`;

        it("detects patch context", () => {
            // At start of file, command position
            const contexts = getContextAtPosition(tppContent, 0, 0, ".tpp");
            expect(contexts).toEqual(["patchKeyword"]);
        });
    });

    describe("DEFINE_PATCH_FUNCTION body", () => {
        it("detects patchKeyword inside DEFINE_PATCH_FUNCTION", () => {
            // Bug reproduction: patches missing from completion inside patch function
            const content = `DEFINE_PATCH_FUNCTION my_func BEGIN
    READ_SHORT 0x00 value
END
`;
            // Line 1, col 4: at start of READ_SHORT statement (command position)
            const contexts = getContextAtPosition(content, 1, 4, ".tph");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("detects patchKeyword with incomplete code in DEFINE_PATCH_FUNCTION", () => {
            // Exact user scenario: typing "read_s" inside patch function
            const content = `DEFINE_PATCH_FUNCTION unstack_armor_bonus
    INT_VAR bonus = 0 stacking_id_base = 0
BEGIN
    found = 0
    GET_OFFSET_ARRAY fx_offs ITM_V10_GEN_EFFECTS
    read_s
`;
            // Line 5, col 4: typing "read_s" at command position
            const contexts = getContextAtPosition(content, 5, 4, ".tph");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("allows patch items and constants in patchKeyword context", () => {
            // With minimal rules, patch items and constants both allowed in patchKeyword
            // Only action/actionFunctions are excluded
            const items = [
                createItem("READ_SHORT", CompletionCategory.Patch),
                createItem("WRITE_BYTE", CompletionCategory.Patch),
                createItem("SOME_CONSTANT", CompletionCategory.Constants),
                createItem("COPY", CompletionCategory.Action),  // Should be excluded
            ];
            const filtered = filterItemsByContext(items, ["patchKeyword"]);
            expect(filtered).toHaveLength(3);
            expect(filtered.map(i => i.label).sort()).toEqual(["READ_SHORT", "SOME_CONSTANT", "WRITE_BYTE"]);
        });
    });

    describe("DEFINE_ACTION_FUNCTION body", () => {
        it("detects actionKeyword inside DEFINE_ACTION_FUNCTION", () => {
            const content = `DEFINE_ACTION_FUNCTION my_func BEGIN
    PRINT ~Hello~
END
`;
            // Line 1, col 4: at start of PRINT statement (command position)
            const contexts = getContextAtPosition(content, 1, 4, ".tph");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects actionKeyword with incomplete code in DEFINE_ACTION_FUNCTION", () => {
            const content = `DEFINE_ACTION_FUNCTION setup_component
    INT_VAR component_number = 0
BEGIN
    component_id = 100
    cop
`;
            // Line 4, col 4: typing "cop" at command position
            const contexts = getContextAtPosition(content, 4, 4, ".tph");
            expect(contexts).toEqual(["actionKeyword"]);
        });
    });

    describe("DEFINE_PATCH_MACRO body", () => {
        it("detects patchKeyword inside DEFINE_PATCH_MACRO", () => {
            const content = `DEFINE_PATCH_MACRO my_macro BEGIN
    WRITE_BYTE 0x00 1
END
`;
            // Line 1, col 4: at start of WRITE_BYTE statement (command position)
            const contexts = getContextAtPosition(content, 1, 4, ".tpp");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("detects patchKeyword with incomplete code in DEFINE_PATCH_MACRO", () => {
            const content = `DEFINE_PATCH_MACRO apply_effect BEGIN
    effect_offset = 0
    writ
`;
            // Line 2, col 4: typing "writ" at command position
            const contexts = getContextAtPosition(content, 2, 4, ".tpp");
            expect(contexts).toEqual(["patchKeyword"]);
        });
    });

    describe("DEFINE_ACTION_MACRO body", () => {
        it("detects actionKeyword inside DEFINE_ACTION_MACRO", () => {
            const content = `DEFINE_ACTION_MACRO my_macro BEGIN
    INCLUDE ~file.tpa~
END
`;
            // Line 1, col 4: at start of INCLUDE statement (command position)
            const contexts = getContextAtPosition(content, 1, 4, ".tpa");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects actionKeyword with incomplete code in DEFINE_ACTION_MACRO", () => {
            const content = `DEFINE_ACTION_MACRO install_files BEGIN
    base_path = ~mymod~
    incl
`;
            // Line 2, col 4: typing "incl" at command position
            const contexts = getContextAtPosition(content, 2, 4, ".tpa");
            expect(contexts).toEqual(["actionKeyword"]);
        });
    });

    describe("nested contexts", () => {
        const nestedContent = `COPY ~file.itm~ ~override~
    INNER_ACTION BEGIN
        PRINT ~Hello~
    END
END
`;

        it("detects action inside INNER_ACTION", () => {
            // Line 2: PRINT inside INNER_ACTION - at keyword position (command position)
            const contexts = getContextAtPosition(nestedContent, 2, 8, ".tph");
            expect(contexts).toEqual(["actionKeyword"]);
        });
    });

    describe("filtering completions in patch context", () => {
        const copyBlockContent = `BEGIN ~Test~
    COPY ~file.itm~ ~override~
        WRITE_BYTE 0x00 1
    END
END
`;
        it("rejects LAF in patch context", () => {
            // Line 2 is inside COPY patches block - at keyword position (command position)
            const contexts = getContextAtPosition(copyBlockContent, 2, 8, ".tp2");
            expect(contexts).toEqual(["patchKeyword"]);
            // LAF has category "action" which should be rejected in patchKeyword context
            expectFiltering("patchKeyword", CompletionCategory.Action, false);
        });

        it("allows LPF in patch context", () => {
            // At keyword position (command position)
            const contexts = getContextAtPosition(copyBlockContent, 2, 8, ".tp2");
            expect(contexts).toEqual(["patchKeyword"]);
            // LPF has category "patch" which should be allowed in patchKeyword context
            expectFiltering("patchKeyword", CompletionCategory.Patch, true);
        });

        it("detects action with severely malformed COPY structure", () => {
            // User is typing, but code is so malformed tree-sitter can't parse the COPY structure
            const incomplete = `BEGIN ~Test~
    COPY ~file.itm~ ~override~
        WRITE_
END
`;
            // Line 2, column 14: tree-sitter likely can't parse this as COPY action
            // With incomplete code, returns permissive contexts to help user
            const contexts = getContextAtPosition(incomplete, 2, 14, ".tp2");
            // Should include action context (can type new action after incomplete patch)
            expect(contexts).toContain("action");
        });

        it("detects patch on empty line with patch below", () => {
            // User on empty line after COPY file pairs
            // Patches are below but cursor is outside COPY node - ambiguous (Case 3)
            const emptyLine = `BEGIN ~Test~
    COPY ~file.itm~ ~override~

        WRITE_BYTE 0x00 1
END
`;
            // Line 2: empty line after COPY - ambiguous position
            const contexts = getContextAtPosition(emptyLine, 2, 8, ".tp2");
            expect(contexts).toEqual(expect.arrayContaining(["patch", "when", "action"]));
        });
    });

    describe("function call name position", () => {
        it("detects lafName when typing function name after LAF", () => {
            // Incomplete LAF - user just typed "LAF " and is about to type function name
            const lafIncomplete = `BEGIN ~Test~
    LAF
END
`;
            // Line 1, column 8: right after "LAF " where function name goes
            const contexts = getContextAtPosition(lafIncomplete, 1, 8, ".tp2");
            expect(contexts).toEqual(["lafName"]);
        });

        it("detects lpfName when typing function name after LPF", () => {
            // Incomplete LPF - user just typed "LPF " and is about to type function name
            const lpfIncomplete = `COPY ~file.itm~ ~override~
    LPF
END
`;
            // Line 1, column 8: right after "LPF " where function name goes
            const contexts = getContextAtPosition(lpfIncomplete, 1, 8, ".tph");
            expect(contexts).toEqual(["lpfName"]);
        });

        it("detects lafName with LAUNCH_ACTION_FUNCTION", () => {
            // User typed "LAUNCH_ACTION_FUNCTION A" and cursor is after "A"
            const lafFull = `BEGIN ~Test~
    LAUNCH_ACTION_FUNCTION A
    COPY_EXISTING ~%spell%.spl~ ~override~
END
`;
            // Line 1, column 27: right after "LAUNCH_ACTION_FUNCTION A"
            const contexts = getContextAtPosition(lafFull, 1, 27, ".tp2");
            expect(contexts).toEqual(["lafName"]);
        });

        it("detects lafName with incomplete LAUNCH_ACTION_FUNCTION (no END)", () => {
            // Exact user scenario: LAF incomplete, followed by COPY_EXISTING
            const lafIncomplete = `BEGIN ~Test~
    LAUNCH_ACTION_FUNCTION A
    COPY_EXISTING ~%spell%.spl~ ~override~
        target = 1
`;
            // Line 1, column 27: right after "LAUNCH_ACTION_FUNCTION A"
            const contexts = getContextAtPosition(lafIncomplete, 1, 27, ".tp2");
            expect(contexts).toEqual(["lafName"]);
        });
    });

    describe("context after BEGIN", () => {
        it("detects componentFlag or action on line after BEGIN", () => {
            // User just typed BEGIN, now on next line
            const afterBegin = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN ~Test~

END
`;
            // Line 5: empty line after BEGIN, before END
            // At boundary: both componentFlags and actions are valid completions
            // actionKeyword excludes constants (command position)
            const contexts = getContextAtPosition(afterBegin, 5, 0, ".tp2");
            expect(contexts).toEqual(["componentFlag", "actionKeyword"]);
        });

        it("detects componentFlag when typing after BEGIN on same structure", () => {
            const withFlags = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN ~Test~
    DESIGNATED 100
    COPY ~file~ ~override~
END
`;
            // Line 5: DESIGNATED - this is a component flag
            const contexts = getContextAtPosition(withFlags, 5, 4, ".tp2");
            expect(contexts).toEqual(["componentFlag"]);
        });

        it("detects action after component flags", () => {
            const withFlags = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN ~Test~
    DESIGNATED 100
    COPY ~file~ ~override~
END
`;
            // Line 6: COPY - this is an action after the flag
            const contexts = getContextAtPosition(withFlags, 6, 4, ".tp2");
            expect(contexts).toEqual(["action"]);
        });

        it("detects both flags and actions valid after GROUP flag with action below", () => {
            const afterGroupFlag = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN @123
GROUP @122

INCLUDE ~lib.tpa~
`;
            // Line 6: empty line after GROUP flag, before INCLUDE action
            // Both flags and actions are valid here - user can still insert more flags
            // actionKeyword excludes constants (command position)
            const contexts = getContextAtPosition(afterGroupFlag, 6, 0, ".tp2");
            expect(contexts).toEqual(["componentFlag", "actionKeyword"]);
        });

        it("detects action on empty line inside component", () => {
            const withEmptyLine = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN ~Test~
    COPY ~file~ ~override~

END
`;
            // Line 6: empty line after COPY - ambiguous position (Case 2)
            const contexts = getContextAtPosition(withEmptyLine, 6, 4, ".tp2");
            expect(contexts).toEqual(expect.arrayContaining(["patch", "when", "action"]));
        });

        it("does not detect flag context inside component", () => {
            const insideComponent = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN ~Test~

END
`;
            // Line 5: inside component, should NOT be flag
            const contexts = getContextAtPosition(insideComponent, 5, 4, ".tp2");
            expect(contexts).not.toContain("flag");
        });
    });

    describe("Ambiguous Contexts (from README.md)", () => {
        /**
         * Test cases for the 8 ambiguous contexts documented in grammar README.
         * When uncertain, should return ["unknown"] to avoid filtering.
         */

        it("Case 1: Empty component - should allow componentFlag AND action", () => {
            const emptyComponent = `BACKUP ~backup~
LANGUAGE ~English~ ~en~ ~en.tra~
BEGIN @123

END
`;
            // Line 3: after BEGIN, nothing below - both contexts valid (actionKeyword at command position)
            const contexts = getContextAtPosition(emptyComponent, 3, 0, ".tp2");
            expect(contexts).toEqual(expect.arrayContaining(["componentFlag", "actionKeyword"]));
        });

        it("Case 2: After COPY file pairs - should allow patch, when, AND action", () => {
            const afterFilePairs = `BEGIN @123
COPY ~a~ ~b~

END
`;
            // Line 2: after file pairs, nothing below - all three contexts valid
            const contexts = getContextAtPosition(afterFilePairs, 2, 0, ".tp2");
            expect(contexts).toEqual(expect.arrayContaining(["patch", "when"]));
            // Should also allow action (ending COPY)
            expect(contexts).toEqual(expect.arrayContaining(["action"]));
        });

        it("Case 3: After COPY patches - should allow patch, when, AND action", () => {
            const afterPatches = `BEGIN @123
COPY ~a~ ~b~
  REPLACE_TEXTUALLY ~foo~ ~bar~

END
`;
            // Line 3: after patches - can continue, add when, or end COPY
            const contexts = getContextAtPosition(afterPatches, 3, 0, ".tp2");
            expect(contexts).toEqual(expect.arrayContaining(["patch", "when", "action"]));
        });

        it("Case 4: After COPY when - should allow when AND action (NOT patch)", () => {
            const afterWhen = `BEGIN @123
COPY ~a~ ~b~
  BUT_ONLY

END
`;
            // Line 3: after when - can add more when or end COPY, but NOT go back to patches
            const contexts = getContextAtPosition(afterWhen, 3, 0, ".tp2");
            expect(contexts).toEqual(expect.arrayContaining(["when", "action"]));
            expect(contexts).not.toContain("patch");
        });

        it("Case 5: After BACKUP and AUTHOR - prologue complete, flag context", () => {
            const afterPrologue = `BACKUP ~mymod~
AUTHOR ~me~

LANGUAGE ~English~ ~en~ ~en.tra~
`;
            // Line 2: after both required directives - prologue is complete
            const contexts = getContextAtPosition(afterPrologue, 2, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });

        it("Case 6: Between flags and language - should be flag context", () => {
            const betweenFlagLanguage = `BACKUP ~mymod~
AUTO_TRA ~foo~

LANGUAGE ~English~ ~en~ ~en.tra~
`;
            // Line 2: after flags, before language - should be flag context
            const contexts = getContextAtPosition(betweenFlagLanguage, 2, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });

        it("Case 7: After languages - should be flag context", () => {
            const afterLanguage = `BACKUP ~mymod~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN @123
`;
            // Line 2: after language - can add more LANGUAGE or BEGIN (both in flag context)
            const contexts = getContextAtPosition(afterLanguage, 2, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });

        it("Case 8: Empty .tpa file - should be action by default", () => {
            const emptyTpa = `
`;
            // Line 0: empty .tpa - defaults to action at command position
            const contexts = getContextAtPosition(emptyTpa, 0, 0, ".tpa");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("Case 8b: .tpa with component structure - switches to file context", () => {
            const tpaWithComponents = `BEGIN @123
  COPY ~a~ ~b~
END
`;
            // Line 1: .tpa with BEGIN - should detect component context
            const contexts = getContextAtPosition(tpaWithComponents, 1, 2, ".tpa");
            // Should be action context (inside component)
            expect(contexts).toEqual(expect.arrayContaining(["action"]));
        });
    });

    describe("Certain Contexts (should NOT be unknown)", () => {
        /**
         * Test cases where we CAN determine context with certainty.
         * These should return specific contexts, NOT "unknown".
         */

        it("Inside patches block - definitely patch", () => {
            const insidePatches = `BEGIN @123
COPY ~a~ ~b~ BEGIN
  REPLACE_TEXTUALLY ~foo~ ~bar~

END
END
`;
            // Line 3: inside patches block - definitely patch
            const contexts = getContextAtPosition(insidePatches, 3, 2, ".tp2");
            expect(contexts).toEqual(["patch"]);
        });

        it("After COPY action - ambiguous (can add patches/when/action)", () => {
            const afterAction = `BEGIN @123
  GROUP @111
  COPY ~a~ ~b~

END
`;
            // Line 3: after COPY action - ambiguous position (Case 2)
            const contexts = getContextAtPosition(afterAction, 3, 2, ".tp2");
            expect(contexts).toEqual(expect.arrayContaining(["patch", "when", "action"]));
        });

        it("Before file pairs end - definitely action (COPY header)", () => {
            const inFilePairs = `BEGIN @123
COPY ~a~ ~b~
END
`;
            // Line 1, col 10: within file pairs - COPY header is action context
            const contexts = getContextAtPosition(inFilePairs, 1, 10, ".tp2");
            expect(contexts).toEqual(["action"]);
        });

        it("With flag below - definitely componentFlag", () => {
            const flagBelow = `BEGIN @123

GROUP @111
COPY ~a~ ~b~
END
`;
            // Line 1: flag below - definitely componentFlag only
            const contexts = getContextAtPosition(flagBelow, 1, 0, ".tp2");
            expect(contexts).toEqual(["componentFlag"]);
        });

        it("With flag below (incomplete parse) - definitely componentFlag", () => {
            // Real-world case: user types incomplete code, flag becomes sibling
            const incomplete = `BEGIN @123
incl
GROUP @111
`;
            // Line 1, after "incl" - GROUP flag below (even if it's a sibling in parse tree)
            const contexts = getContextAtPosition(incomplete, 1, 4, ".tp2");
            expect(contexts).toEqual(["componentFlag"]);
        });

        it("After flag, next component's flags should not count as 'below cursor'", () => {
            // Real-world case from screenshot: GROUP @111, then incomplete text, then next component has GROUP @600
            const incomplete = `BEGIN @123
GROUP @111
incl
BEGIN @456
GROUP @600
`;
            // Line 2, after "incl" - no flags below in THIS component
            // GROUP @600 is in a different component and should be ignored
            const contexts = getContextAtPosition(incomplete, 2, 4, ".tp2");
            // Should allow action (no flags below in this component) - actionKeyword at command position
            expect(contexts).toContain("actionKeyword");
            expect(contexts).not.toEqual(["componentFlag"]);
        });
    });

    describe("Incomplete keywords - parser limitations", () => {
        // NOTE: These tests document current parser behavior. When incomplete text appears,
        // the parser enters error recovery and may not correctly parse valid keywords below.
        // This is a grammar limitation, not a completion logic bug.

        it("Cursor between patches and BUT_ONLY - should include patch and when", () => {
            const content = `BEGIN @123
COPY_EXISTING ~%WIZARD_GREASE%.spl~ ~override~
  WRITE_LONG SPL_flags THIS BAND BNOT FLAG_SPL_hostile
CO
BUT_ONLY
`;
            // Line 3: between WRITE_LONG (patch) and BUT_ONLY (when)
            // Both patch and when should be valid (user may be typing another patch command)
            const contexts = getContextAtPosition(content, 3, 2, ".tpa");
            expect(contexts).toContain("patch");
            expect(contexts).toContain("when");
        });

        it("Incomplete action after patches in COPY - should include action", () => {
            const incomplete = `BEGIN @123
COPY ~a~ ~b~
  PATCH_IF TRUE BEGIN
  END
cop
`;
            // Line 4, after "cop" - incomplete COPY (next action)
            // After patches, should allow patch, when, OR action
            const contexts = getContextAtPosition(incomplete, 4, 3, ".tp2");
            expect(contexts).toContain("action");
        });

        it("Incomplete COPY after GROUP flag - both flags and actions valid before first action", () => {
            const incomplete = `BEGIN @123
GROUP @111
cop
COPY ~a~ ~b~
`;
            // Line 2, after "cop" - COPY action exists below, but user could still insert flags
            // before it. Both componentFlag and action are valid at this position.
            // actionKeyword excludes constants (command position)
            const contexts = getContextAtPosition(incomplete, 2, 3, ".tp2");
            expect(contexts).toEqual(["componentFlag", "actionKeyword"]);
        });
    });

    describe("unknown context handling", () => {
        it("filterItemsByContext should pass all items when unknown", () => {
            const items = [
                createItem("COPY", CompletionCategory.Action),
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
                createItem("GROUP", CompletionCategory.ComponentFlag),
                createItem("AUTO_TRA", CompletionCategory.Flag),
            ];
            const filtered = filterItemsByContext(items, ["unknown"]);
            expect(filtered).toHaveLength(4);
        });

        it("filterItemsByContext should pass all items when unknown is in array", () => {
            const items = [
                createItem("COPY", CompletionCategory.Action),
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
            ];
            // Even with other contexts, "unknown" should bypass filtering
            const filtered = filterItemsByContext(items, ["unknown", "action"]);
            expect(filtered).toHaveLength(2);
        });
    });

    describe("non-COPY action contexts", () => {
        it("detects actionKeyword for PRINT at start of statement", () => {
            const content = `BEGIN ~Test~
    PRINT ~hello~
`;
            // Line 1, col 4: at start of PRINT statement (command position)
            const contexts = getContextAtPosition(content, 1, 4, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects action (not actionKeyword) inside PRINT argument", () => {
            const content = `BEGIN ~Test~
    PRINT ~hello~
`;
            // Line 1, col 10: inside the string argument
            const contexts = getContextAtPosition(content, 1, 10, ".tp2");
            expect(contexts).toEqual(["action"]);
            expect(contexts).not.toContain("actionKeyword");
        });

        it("detects actionKeyword for INCLUDE at start of statement", () => {
            const content = `BEGIN ~Test~
    INCLUDE ~lib.tpa~
`;
            // Line 1, col 4: at start of INCLUDE statement (command position)
            const contexts = getContextAtPosition(content, 1, 4, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects action (not actionKeyword) inside INCLUDE argument", () => {
            const content = `BEGIN ~Test~
    INCLUDE ~lib.tpa~
`;
            // Line 1, col 12: inside the string argument
            const contexts = getContextAtPosition(content, 1, 12, ".tp2");
            expect(contexts).toEqual(["action"]);
            expect(contexts).not.toContain("actionKeyword");
        });

        it("detects actionKeyword for OUTER_SET at start of statement", () => {
            const content = `BEGIN ~Test~
    OUTER_SET var = 1
`;
            // Line 1, col 4: at start of OUTER_SET statement (command position)
            const contexts = getContextAtPosition(content, 1, 4, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects action (not actionKeyword) inside OUTER_SET value", () => {
            const content = `BEGIN ~Test~
    OUTER_SET var = 1
`;
            // Line 1, col 17: at the value position
            const contexts = getContextAtPosition(content, 1, 17, ".tp2");
            expect(contexts).toEqual(["action"]);
            expect(contexts).not.toContain("actionKeyword");
        });
    });

    describe("unknown file extensions", () => {
        it("returns unknown as default for unrecognized extensions", () => {
            // Unknown extension gets "unknown" as default context from getDefaultContext
            const contexts = getContextAtPosition("BEGIN ~test~", 0, 0, ".txt");
            // With BEGIN present, parser can detect context - should be componentFlag + actionKeyword
            expect(contexts).toEqual(["componentFlag", "actionKeyword"]);
        });

        it("returns unknown as default for missing extension", () => {
            // Empty extension gets "unknown" as default context from getDefaultContext
            const contexts = getContextAtPosition("BEGIN ~test~", 0, 0, "");
            // With BEGIN present, parser can detect context - should be componentFlag + actionKeyword
            expect(contexts).toEqual(["componentFlag", "actionKeyword"]);
        });

        it("returns unknown for unparseable content with unknown extension", () => {
            // No valid structure and unknown extension → fallback to default "unknown"
            const contexts = getContextAtPosition("", 0, 0, ".txt");
            expect(contexts).toContain("unknown");
        });
    });

    describe("function name position edge cases", () => {
        it("detects funcParamName (not lafName) after function name in LAF", () => {
            const content = `BEGIN ~Test~
    LAF my_func INT_VAR foo = 1 END
`;
            // Line 1, col 16: after "my_func", before INT_VAR (in parameter section)
            const contexts = getContextAtPosition(content, 1, 16, ".tp2");
            expect(contexts).not.toContain("lafName");
            expect(contexts).toEqual(["funcParamName"]);
        });

        it("detects funcParamName (not lpfName) after function name in LPF", () => {
            const content = `COPY ~file.itm~ ~override~
    LPF my_func INT_VAR foo = 1 END
END
`;
            // Line 1, col 16: after "my_func", before INT_VAR (in parameter section)
            const contexts = getContextAtPosition(content, 1, 16, ".tph");
            expect(contexts).not.toContain("lpfName");
            expect(contexts).toEqual(["funcParamName"]);
        });
    });

    describe("text-based fallback for lafName/lpfName", () => {
        // Test cases for text-based lafName/lpfName fallback
        // Use getContextAtPosition(text, line, char, ext) directly

        describe("inside patch block (COPY body)", () => {
            it("detects lpfName after LPF with space", () => {
                const content = `COPY_EXISTING ~foo.itm~ ~override~
  LPF `;
                // Line 1, col 6: right after "LPF " (cursor at end)
                const contexts = getContextAtPosition(content, 1, 6, ".tp2");
                expect(contexts).toEqual(["lpfName"]);
            });

            it("detects lpfName while typing function name after LPF", () => {
                const content = `COPY_EXISTING ~foo.itm~ ~override~
  LPF xxx`;
                // Line 1, col 10: right after "LPF xxx" (cursor at end, still typing name)
                const contexts = getContextAtPosition(content, 1, 10, ".tp2");
                expect(contexts).toEqual(["lpfName"]);
            });

            it("detects lafName after LAF with space", () => {
                const content = `COPY_EXISTING ~foo.itm~ ~override~
  LAF `;
                // Line 1, col 6: right after "LAF " (cursor at end)
                const contexts = getContextAtPosition(content, 1, 6, ".tp2");
                expect(contexts).toEqual(["lafName"]);
            });

            it("detects lafName while typing function name after LAF", () => {
                const content = `COPY_EXISTING ~foo.itm~ ~override~
  LAF my_func`;
                // Line 1, col 13: right after "LAF my_func" (cursor at end, still typing name)
                const contexts = getContextAtPosition(content, 1, 13, ".tp2");
                expect(contexts).toEqual(["lafName"]);
            });
        });

        describe("inside action context (top-level .tpa file)", () => {
            it("detects lafName after LAF with space", () => {
                const content = `LAF `;
                // Line 0, col 4: right after "LAF " (cursor at end)
                const contexts = getContextAtPosition(content, 0, 4, ".tpa");
                expect(contexts).toEqual(["lafName"]);
            });

            it("detects lafName while typing function name", () => {
                const content = `LAF my_func`;
                // Line 0, col 11: right after "LAF my_func" (cursor at end, still typing name)
                const contexts = getContextAtPosition(content, 0, 11, ".tpa");
                expect(contexts).toEqual(["lafName"]);
            });
        });

        describe("case insensitive", () => {
            it("detects lafName with lowercase laf", () => {
                const content = `laf `;
                // Line 0, col 4: right after "laf " (cursor at end)
                const contexts = getContextAtPosition(content, 0, 4, ".tpa");
                expect(contexts).toEqual(["lafName"]);
            });

            it("detects lpfName with lowercase lpf and partial name", () => {
                const content = `COPY ~foo~ ~bar~
  lpf xxx`;
                // Line 1, col 9: right after "lpf xxx" (cursor at end, still typing name)
                const contexts = getContextAtPosition(content, 1, 9, ".tp2");
                expect(contexts).toEqual(["lpfName"]);
            });
        });

        describe("long form keywords", () => {
            it("detects lafName with LAUNCH_ACTION_FUNCTION and partial name", () => {
                const content = `LAUNCH_ACTION_FUNCTION xxx`;
                // Line 0, col 26: right after "LAUNCH_ACTION_FUNCTION xxx" (cursor at end)
                const contexts = getContextAtPosition(content, 0, 26, ".tpa");
                expect(contexts).toEqual(["lafName"]);
            });

            it("detects lpfName with LAUNCH_PATCH_FUNCTION and partial name", () => {
                const content = `COPY ~foo~ ~bar~
  LAUNCH_PATCH_FUNCTION xxx`;
                // Line 1, col 27: right after "LAUNCH_PATCH_FUNCTION xxx" (cursor at end)
                const contexts = getContextAtPosition(content, 1, 27, ".tp2");
                expect(contexts).toEqual(["lpfName"]);
            });
        });

        describe("should NOT match (past function name)", () => {
            it("does not detect lpfName when cursor is after whitespace following function name", () => {
                const content = `COPY ~foo~ ~bar~
  LPF xxx INT_VAR`;
                // Line 1, col 12: after "LPF xxx " with trailing space (past function name position)
                // Should detect funcParamName or similar, not lpfName
                const contexts = getContextAtPosition(content, 1, 12, ".tp2");
                expect(contexts).not.toEqual(["lpfName"]);
            });

            it("does not detect lpfName when there's a trailing space after function name", () => {
                const content = `COPY ~foo~ ~bar~
  LPF xxx `;
                // Line 1, col 11: right after "LPF xxx " with trailing space
                // The regex requires \S*$ (no trailing space), so this should NOT match
                const contexts = getContextAtPosition(content, 1, 11, ".tp2");
                expect(contexts).not.toEqual(["lpfName"]);
            });
        });
    });

    describe("SUPPORT directive", () => {
        it("recognizes SUPPORT directive in prologue", () => {
            const content = `BACKUP ~backup~
SUPPORT ~email~
`;
            // Line 1, col 0: at SUPPORT
            const contexts = getContextAtPosition(content, 1, 0, ".tp2");
            expect(contexts).toEqual(["prologue"]);
        });

        it("transitions to flag after BACKUP and SUPPORT", () => {
            const content = `BACKUP ~backup~
SUPPORT ~email~

`;
            // Line 2: after both prologue directives
            const contexts = getContextAtPosition(content, 2, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });

        it("allows AUTHOR on same line structure after BACKUP and SUPPORT", () => {
            // SUPPORT is an alternative to AUTHOR, but both can be present
            // After both BACKUP and SUPPORT, we're past prologue into flag context
            const content = `BACKUP ~backup~
SUPPORT ~email~
AUTHOR ~me~

`;
            // Line 3: after all prologue directives
            const contexts = getContextAtPosition(content, 3, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });

        it("detects flag context when AUTHOR comes after SUPPORT", () => {
            // At line 2 (AUTHOR line), after SUPPORT was already completed
            const content = `BACKUP ~backup~
SUPPORT ~email~
AUTHOR ~me~
`;
            // Line 2, col 0: AUTHOR line - but SUPPORT already satisfied prologue requirement
            // seenAuthorOrSupport=true after SUPPORT, so we're in flag context
            const contexts = getContextAtPosition(content, 2, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });
    });

    describe("funcParamName context", () => {
        it("detects funcParamName in DEFINE_ACTION_FUNCTION after name", () => {
            const content = `DEFINE_ACTION_FUNCTION my_func
    INT_VAR x = 1
BEGIN
    PRINT ~test~
END`;
            // Line 1, col 4: at INT_VAR position
            const contexts = getContextAtPosition(content, 1, 4, ".tph");
            expect(contexts).toEqual(["funcParamName"]);
        });

        it("detects funcParamName in DEFINE_PATCH_FUNCTION after name", () => {
            const content = `DEFINE_PATCH_FUNCTION my_func
    INT_VAR x = 1
BEGIN
    READ_SHORT 0x00 value
END`;
            // Line 1, col 4: at INT_VAR position
            const contexts = getContextAtPosition(content, 1, 4, ".tpp");
            expect(contexts).toEqual(["funcParamName"]);
        });

        it("detects funcParamName in LAF after function name", () => {
            const content = `BEGIN ~Test~
    LAF my_func INT_VAR x = 1 END
END`;
            // Line 1, col 16: after "my_func ", at INT_VAR position
            const contexts = getContextAtPosition(content, 1, 16, ".tp2");
            expect(contexts).toEqual(["funcParamName"]);
        });

        it("detects funcParamName in LPF after function name", () => {
            const content = `COPY ~file.itm~ ~override~
    LPF my_func INT_VAR x = 1 END
END`;
            // Line 1, col 16: after "my_func ", at INT_VAR position
            const contexts = getContextAtPosition(content, 1, 16, ".tp2");
            expect(contexts).toEqual(["funcParamName"]);
        });

        it("allows funcVarKeyword in funcParamName context", () => {
            expectFiltering("funcParamName", CompletionCategory.FuncVarKeyword, true);
        });

        it("rejects funcVarKeyword in action context", () => {
            expectFiltering("action", CompletionCategory.FuncVarKeyword, false);
        });

        it("rejects funcVarKeyword in patch context", () => {
            expectFiltering("patch", CompletionCategory.FuncVarKeyword, false);
        });

        it("rejects funcVarKeyword in actionKeyword context", () => {
            expectFiltering("actionKeyword", CompletionCategory.FuncVarKeyword, false);
        });

        it("rejects funcVarKeyword in patchKeyword context", () => {
            expectFiltering("patchKeyword", CompletionCategory.FuncVarKeyword, false);
        });

        it("rejects funcVarKeyword in prologue context", () => {
            expectFiltering("prologue", CompletionCategory.FuncVarKeyword, false);
        });

        it("rejects funcVarKeyword in flag context", () => {
            expectFiltering("flag", CompletionCategory.FuncVarKeyword, false);
        });

        it("rejects funcVarKeyword in lafName context", () => {
            expectFiltering("lafName", CompletionCategory.FuncVarKeyword, false);
        });

        it("rejects funcVarKeyword in lpfName context", () => {
            expectFiltering("lpfName", CompletionCategory.FuncVarKeyword, false);
        });
    });

    describe("between-component gaps", () => {
        it("detects context in gap between components", () => {
            const content = `BACKUP ~backup~
AUTHOR ~me~
BEGIN ~First~
    COPY ~a~ ~b~

BEGIN ~Second~
`;
            // Line 4: empty line after first component, before second
            // This is in the trailing area of the first component
            const contexts = getContextAtPosition(content, 4, 0, ".tp2");
            // Should be ambiguous (could be ending first component)
            expect(contexts).toContain("action");
        });

        it("detects flag context before first component", () => {
            const content = `BACKUP ~backup~
AUTHOR ~me~

BEGIN ~First~
`;
            // Line 2: empty line before first component
            const contexts = getContextAtPosition(content, 2, 0, ".tp2");
            expect(contexts).toEqual(["flag"]);
        });
    });

    describe("filtering with actionKeyword", () => {
        it("allows constants when action context is also present (permissive filtering)", () => {
            // With ["action", "actionKeyword"]:
            // - action allows constants
            // - actionKeyword excludes constants
            // Permissive logic: if ANY context allows it, show it
            const items = [
                createItem("COPY", CompletionCategory.Action),
                createItem("SOME_CONSTANT", CompletionCategory.Constants),
            ];
            const filtered = filterItemsByContext(items, ["action", "actionKeyword"]);
            // Both should pass - action context allows constants
            expect(filtered).toHaveLength(2);
        });

        it("allows constants and action items in actionKeyword context (minimal rules)", () => {
            // With minimal rules, only patch/patchFunctions are excluded from actionKeyword
            const items = [
                createItem("COPY", CompletionCategory.Action),
                createItem("SOME_CONSTANT", CompletionCategory.Constants),
                createItem("READ_LONG", CompletionCategory.Patch),  // Should be excluded
            ];
            const filtered = filterItemsByContext(items, ["actionKeyword"]);
            expect(filtered).toHaveLength(2);
            expect(filtered.map(i => i.label).sort()).toEqual(["COPY", "SOME_CONSTANT"]);
        });

        it("excludes patch items from actionKeyword context", () => {
            const items = [
                createItem("COPY", CompletionCategory.Action),
                createItem("READ_LONG", CompletionCategory.Patch),
                createItem("WRITE_BYTE", CompletionCategory.Patch),
            ];
            const filtered = filterItemsByContext(items, ["actionKeyword"]);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].label).toBe("COPY");
        });

        it("excludes patchFunctions from actionKeyword context", () => {
            const items = [
                createItem("COPY", CompletionCategory.Action),
                createItem("MY_PATCH_FUNC", CompletionCategory.PatchFunctions),
            ];
            const filtered = filterItemsByContext(items, ["actionKeyword"]);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].label).toBe("COPY");
        });

        it("allows action items when actionKeyword is in context", () => {
            const items = [
                createItem("COPY", CompletionCategory.Action),
                createItem("PRINT", CompletionCategory.Action),
                createItem("INCLUDE", CompletionCategory.Action),
            ];
            const filtered = filterItemsByContext(items, ["actionKeyword"]);
            expect(filtered).toHaveLength(3);
        });
    });

    describe("COPY body inside ACTION_PHP_EACH", () => {
        it("BUG REPRODUCTION: detects actionKeyword instead of patchKeyword inside COPY_EXISTING body when COPY is inside ACTION_PHP_EACH", () => {
            // Bug reproduction: COPY_EXISTING inside ACTION_PHP_EACH
            // Cursor at start of patch command line in COPY body
            // Context should be patchKeyword (for patch commands like LPF)
            // NOT actionKeyword (which would exclude patch category)
            const content = `BEGIN ~Test~
    ACTION_PHP_EACH items AS key => value BEGIN
        COPY_EXISTING ~%item%.itm~ ~override~

        END
    END
END
`;
            // Line 3, col 12: at start of line in COPY body, where user types patch commands
            const contexts = getContextAtPosition(content, 3, 12, ".tp2");
            // BUG: Currently returns ["actionKeyword"] because COPY is inside ACTION_PHP_EACH
            // EXPECTED: Should return ["patchKeyword"] because COPY body is always patch context
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("allows LPF (patch category) in COPY body inside ACTION_PHP_EACH", () => {
            // Verify that LPF (category "patch") appears in completion
            const content = `BEGIN ~Test~
    ACTION_PHP_EACH items AS key => value BEGIN
        COPY_EXISTING ~%item%.itm~ ~override~
            RE
        END
    END
END
`;
            const contexts = getContextAtPosition(content, 3, 12, ".tp2");
            // LPF has category "patch" which should NOT be excluded from patchKeyword context
            expectFiltering(contexts, CompletionCategory.Patch, true);
        });

        it("allows patch category in COPY body inside ACTION_PHP_EACH", () => {
            // Verify that patch items appear in COPY body even when COPY is in action control flow
            const content = `BEGIN ~Test~
    ACTION_PHP_EACH items AS key => value BEGIN
        COPY_EXISTING ~%item%.itm~ ~override~
            RE
        END
    END
END
`;
            const contexts = getContextAtPosition(content, 3, 12, ".tp2");
            // Incomplete code in COPY body returns permissive contexts including patch
            expect(contexts).toContain("patch");
            // Patch category items should be allowed
            expectFiltering(contexts, CompletionCategory.Patch, true);
        });
    });

    describe("control flow construct bodies", () => {
        it("detects patchKeyword inside patch_php_each body", () => {
            // Bug reproduction: cursor inside control flow body incorrectly detected as "patch" instead of "patchKeyword"
            const content = `COPY ~file.itm~ ~override~
    PATCH_PHP_EACH items AS key => value BEGIN
        READ_SHORT 0x00 offset
    END
END
`;
            // Line 2, col 8: at start of READ_SHORT statement (command position inside BEGIN...END body)
            const contexts = getContextAtPosition(content, 2, 8, ".tp2");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("detects patchKeyword with incomplete code inside patch_php_each body", () => {
            // User typing new statement inside control flow body
            const content = `COPY ~file.itm~ ~override~
    PATCH_PHP_EACH items AS key => value BEGIN
        read_s
    END
END
`;
            // Line 2, col 8: typing "read_s" at command position
            const contexts = getContextAtPosition(content, 2, 8, ".tp2");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("detects actionKeyword inside action_for_each body", () => {
            // Action control flow construct
            const content = `BEGIN ~Test~
    ACTION_FOR_EACH item IN items BEGIN
        PRINT ~%item%~
    END
END
`;
            // Line 2, col 8: at start of PRINT statement (command position inside BEGIN...END body)
            const contexts = getContextAtPosition(content, 2, 8, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects actionKeyword with incomplete code inside action_for_each body", () => {
            // User typing new statement inside action control flow body
            const content = `BEGIN ~Test~
    ACTION_FOR_EACH item IN items BEGIN
        pri
    END
END
`;
            // Line 2, col 8: typing "pri" at command position
            const contexts = getContextAtPosition(content, 2, 8, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects patchKeyword inside patch_if body", () => {
            const content = `COPY ~file.itm~ ~override~
    PATCH_IF condition BEGIN
        WRITE_BYTE 0x00 1
    END
END
`;
            // Line 2, col 8: at start of WRITE_BYTE statement
            const contexts = getContextAtPosition(content, 2, 8, ".tp2");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("detects actionKeyword inside action_if body", () => {
            const content = `BEGIN ~Test~
    ACTION_IF condition BEGIN
        COPY ~a~ ~b~
    END
END
`;
            // Line 2, col 8: at start of COPY statement
            const contexts = getContextAtPosition(content, 2, 8, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects actionKeyword after complete COPY inside action_if body", () => {
            // Bug: COPY followed by another action inside ACTION_IF was returning
            // patchKeyword because the detector assumed any position after a COPY
            // is in COPY patches area. When another action exists after the COPY,
            // the COPY is complete and we're back in action context.
            const content = `BEGIN ~Test~
    ACTION_IF condition BEGIN
        COPY ~a.bcs~ ~override/b.bcs~
        OUTER_SPRINT var ~value~

    END
END
`;
            // Line 4, col 8: empty line after OUTER_SPRINT (which proves COPY is complete)
            const contexts = getContextAtPosition(content, 4, 8, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects patchKeyword inside inner_patch body", () => {
            // INNER_PATCH must be inside a patch context (e.g., COPY block)
            const content = `BEGIN ~Test~
    COPY ~source.itm~ ~dest.itm~
        INNER_PATCH ~file.itm~ BEGIN
            READ_LONG 0x00 value
        END
    END
END
`;
            // Line 3, col 12: at start of READ_LONG statement inside INNER_PATCH body
            const contexts = getContextAtPosition(content, 3, 12, ".tp2");
            expect(contexts).toEqual(["patchKeyword"]);
        });

        it("detects actionKeyword inside with_tra body", () => {
            const content = `BEGIN ~Test~
    WITH_TRA ~lang/en/setup.tra~ BEGIN
        PRINT @1
    END
END
`;
            // Line 2, col 8: at start of PRINT statement
            const contexts = getContextAtPosition(content, 2, 8, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects actionKeyword inside nested control flow (ACTION_IF inside ACTION_FOR_EACH)", () => {
            const content = `BEGIN ~Test~
    ACTION_FOR_EACH item IN items BEGIN
        ACTION_IF condition BEGIN
            COPY ~a~ ~b~
        END
    END
END
`;
            // Line 3, col 12: at start of COPY inside nested control flow
            const contexts = getContextAtPosition(content, 3, 12, ".tp2");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("detects patch context inside COPY body when COPY is inside ACTION_PHP_EACH", () => {
            // Bug reproduction: COPY inside action control flow should still have patch context in its body
            const content = `BEGIN ~Test~
    ACTION_PHP_EACH items AS key => value BEGIN
        COPY_EXISTING ~%item%.itm~ override
            LAUNC
        END
    END
END
`;
            // Line 3, col 12: typing "LAUNC" inside COPY body (should be patch, not actionKeyword)
            // Incomplete code returns permissive contexts but must include patch
            const contexts = getContextAtPosition(content, 3, 12, ".tp2");
            expect(contexts).toContain("patch");
            // LPF has category "patch" and should appear in completions
            expectFiltering(contexts, CompletionCategory.Patch, true);
        });
    });

    describe("Bug #1: INNER_ACTION header returns wrong context", () => {
        it("BUG REPRODUCTION: returns action instead of null to continue tree walk", () => {
            // Bug: line 763 returns ["action"] when not in command position
            // Should return null to let parent walker continue
            const content = `COPY ~file.itm~ ~override~
    INNER_ACTION BEGIN
    END
END
`;
            // Line 1, col 17: inside INNER_ACTION keyword (not in BEGIN...END body)
            // This is the INNER_ACTION header itself, should continue walking up
            // to find the containing COPY context
            const contexts = getContextAtPosition(content, 1, 17, ".tp2");
            // EXPECTED: Should detect we're in COPY action header (not inside INNER_ACTION body)
            // Current behavior returns ["action"] from line 763
            // Correct behavior should continue up tree and detect patch context from COPY
            expect(contexts).toEqual(["patch"]);
        });
    });

    describe("Bug #2: LAF inside patches gets wrong context", () => {
        it("BUG REPRODUCTION: LAF funcParams inside patches block should return patch context", () => {
            // Bug: detectFunctionCallContext is checked before detectPatchContext
            // When LAF (action function) appears inside patches block with params, it should return patch context
            // LAF is invalid in patches, so we want to gracefully handle it by showing patch completions
            const content = `BEGIN ~Test~
    COPY ~file.itm~ ~override~
        LAF my_func INT_VAR x = 1 END
`;
            // Line 2, col 28: at INT_VAR position inside LAF params, which is inside patches
            const contexts = getContextAtPosition(content, 2, 28, ".tp2");
            // EXPECTED: Should return patch context (LAF is invalid in patches)
            // Bug causes it to return funcParams because detectFunctionCallContext runs first
            // Fixed by checking for patches block ancestor for LAF and returning null
            expect(contexts).toEqual(["patch"]);
        });
    });

    describe("Bug #3: Action inside DEFINE_PATCH_FUNCTION returns patch context", () => {
        it("BUG REPRODUCTION: OUTER_SET inside DEFINE_PATCH_FUNCTION should return action context", () => {
            // Bug: lines 1078-1083 return patch context for ALL statements inside patch function
            // Should check if the statement node is action vs patch before deciding
            // OUTER_SET is always parsed as action (outer_set node type)
            const content = `DEFINE_PATCH_FUNCTION my_func BEGIN
    OUTER_SET var = 1
END
`;
            // Line 1, col 4: at OUTER_SET action inside DEFINE_PATCH_FUNCTION
            // OUTER_SET is an action (invalid inside patch function)
            // Bug: returns ["patchKeyword"] because function is DEFINE_PATCH_FUNCTION
            // Expected: should return ["actionKeyword"] because OUTER_SET is an action node
            const contexts = getContextAtPosition(content, 1, 4, ".tph");
            expect(contexts).toEqual(["actionKeyword"]);
        });

        it("BUG REPRODUCTION: READ_SHORT inside DEFINE_ACTION_FUNCTION should return patch context", () => {
            // Inverse case: patch inside action function
            // READ_SHORT is always parsed as patch (read_var node type)
            const content = `DEFINE_ACTION_FUNCTION my_func BEGIN
    READ_SHORT 0x00 value
END
`;
            // Line 1, col 4: at READ_SHORT (patch statement) inside action function
            // READ_SHORT is a patch (invalid inside action function)
            // Bug: returns ["actionKeyword"] because function is DEFINE_ACTION_FUNCTION
            // Expected: should return ["patchKeyword"] because READ_SHORT is a patch node
            const contexts = getContextAtPosition(content, 1, 4, ".tph");
            expect(contexts).toEqual(["patchKeyword"]);
        });
    });

    describe("filtering with patchKeyword", () => {
        it("allows constants when patch context is also present (permissive filtering)", () => {
            // With ["patch", "patchKeyword"]:
            // - patch allows constants
            // - patchKeyword excludes constants
            // Permissive logic: if ANY context allows it, show it
            const items = [
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
                createItem("SOME_CONSTANT", CompletionCategory.Constants),
            ];
            const filtered = filterItemsByContext(items, ["patch", "patchKeyword"]);
            // Both should pass - patch context allows constants
            expect(filtered).toHaveLength(2);
        });

        it("allows constants and patch items in patchKeyword context (minimal rules)", () => {
            // With minimal rules, only action/actionFunctions are excluded from patchKeyword
            const items = [
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
                createItem("SOME_CONSTANT", CompletionCategory.Constants),
                createItem("COPY", CompletionCategory.Action),  // Should be excluded
            ];
            const filtered = filterItemsByContext(items, ["patchKeyword"]);
            expect(filtered).toHaveLength(2);
            expect(filtered.map(i => i.label).sort()).toEqual(["REPLACE_TEXTUALLY", "SOME_CONSTANT"]);
        });

        it("excludes action items from patchKeyword context", () => {
            const items = [
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
                createItem("COPY", CompletionCategory.Action),
                createItem("PRINT", CompletionCategory.Action),
            ];
            const filtered = filterItemsByContext(items, ["patchKeyword"]);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].label).toBe("REPLACE_TEXTUALLY");
        });

        it("excludes actionFunctions from patchKeyword context", () => {
            const items = [
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
                createItem("MY_ACTION_FUNC", CompletionCategory.ActionFunctions),
            ];
            const filtered = filterItemsByContext(items, ["patchKeyword"]);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].label).toBe("REPLACE_TEXTUALLY");
        });

        it("allows patch items when patchKeyword is in context", () => {
            const items = [
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
                createItem("WRITE_BYTE", CompletionCategory.Patch),
                createItem("READ_ASCII", CompletionCategory.Patch),
            ];
            const filtered = filterItemsByContext(items, ["patchKeyword"]);
            expect(filtered).toHaveLength(3);
        });
    });

    describe("filterItemsByContext with multiple contexts", () => {
        /**
         * Tests for multi-context filtering logic.
         * Design principle: "Only exclude when CERTAIN it's wrong."
         * An item should be hidden ONLY when ALL active contexts exclude it.
         */

        it("single context - item excluded → should hide", () => {
            // patch is excluded from action context
            const items = [createItem("READ_LONG", CompletionCategory.Patch)];
            const filtered = filterItemsByContext(items, ["action"]);
            expect(filtered).toHaveLength(0);
        });

        it("single context - item not excluded → should show", () => {
            // patch is NOT excluded from patch context
            const items = [createItem("READ_LONG", CompletionCategory.Patch)];
            const filtered = filterItemsByContext(items, ["patch"]);
            expect(filtered).toHaveLength(1);
        });

        it("multiple contexts - item excluded from ALL → should hide", () => {
            // patch is excluded from both action and actionKeyword
            const items = [createItem("READ_LONG", CompletionCategory.Patch)];
            const filtered = filterItemsByContext(items, ["action", "actionKeyword"]);
            expect(filtered).toHaveLength(0);
        });

        it("multiple contexts - item excluded from SOME but not all → should SHOW", () => {
            // patch is excluded from action, but NOT from patch
            // With contexts ["patch", "action"], should SHOW (permissive)
            const items = [createItem("READ_LONG", CompletionCategory.Patch)];
            const filtered = filterItemsByContext(items, ["patch", "action"]);
            expect(filtered).toHaveLength(1); // Should show because patch context allows it
        });

        it("multiple contexts - action item with mixed exclusions → should SHOW", () => {
            // action is excluded from patch, but NOT from action or when
            // With contexts ["patch", "when", "action"], should SHOW
            const items = [createItem("COPY", CompletionCategory.Action)];
            const filtered = filterItemsByContext(items, ["patch", "when", "action"]);
            expect(filtered).toHaveLength(1); // Should show because when/action allow it
        });

        it("multiple contexts - patch item with mixed exclusions → should SHOW", () => {
            // patch is excluded from action, but NOT from patch or when
            // With contexts ["patch", "when", "action"], should SHOW
            const items = [createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch)];
            const filtered = filterItemsByContext(items, ["patch", "when", "action"]);
            expect(filtered).toHaveLength(1); // Should show because patch/when allow it
        });

        it("multiple contexts - when item with mixed exclusions → should SHOW", () => {
            // when is excluded from patch, but NOT from action or when
            // With contexts ["patch", "when", "action"], should SHOW
            const items = [createItem("BUT_ONLY", CompletionCategory.When)];
            const filtered = filterItemsByContext(items, ["patch", "when", "action"]);
            expect(filtered).toHaveLength(1); // Should show because when/action allow it
        });

        it("multiple contexts with unknown → should show everything", () => {
            // With "unknown" present, ALL items should pass
            const items = [
                createItem("GROUP", CompletionCategory.ComponentFlag),
                createItem("COPY", CompletionCategory.Action),
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
            ];
            const filtered = filterItemsByContext(items, ["unknown", "action", "patch"]);
            expect(filtered).toHaveLength(3);
        });

        it("real-world case: after BEGIN with no actions (componentFlag + actionKeyword)", () => {
            // After BEGIN, both componentFlag and actionKeyword are valid
            // Component flags should show (allowed by componentFlag context)
            // Actions should show (allowed by actionKeyword - not excluded)
            const items = [
                createItem("GROUP", CompletionCategory.ComponentFlag),
                createItem("DESIGNATED", CompletionCategory.ComponentFlag),
                createItem("COPY", CompletionCategory.Action),
                createItem("INCLUDE", CompletionCategory.Action),
            ];
            const filtered = filterItemsByContext(items, ["componentFlag", "actionKeyword"]);
            expect(filtered).toHaveLength(4); // All should show
        });

        it("real-world case: after COPY file pairs (patch + when + action)", () => {
            // After COPY file pairs, can add patches, when, or end COPY (new action)
            // Each category should be allowed by its respective context
            const items = [
                createItem("REPLACE_TEXTUALLY", CompletionCategory.Patch),
                createItem("BUT_ONLY", CompletionCategory.When),
                createItem("COPY", CompletionCategory.Action),
            ];
            const filtered = filterItemsByContext(items, ["patch", "when", "action"]);
            expect(filtered).toHaveLength(3); // All should show
        });
    });
});
