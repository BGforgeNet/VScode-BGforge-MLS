/**
 * Unit tests for WeiDU TP2 contextual completion.
 * Tests context detection at various cursor positions.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

// Mock the server module to avoid LSP connection issues
vi.mock("../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { getContextAtPosition, filterItemsByContext, CompletionContext } from "../src/weidu-tp2/completion-context";
import { initParser } from "../src/weidu-tp2/parser";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";

beforeAll(async () => {
    await initParser();
});

/**
 * Helper to create a completion item with optional category.
 */
function createItem(label: string, category?: string): CompletionItem {
    const item: CompletionItem & { category?: string } = {
        label,
        kind: CompletionItemKind.Keyword,
    };
    if (category) {
        item.category = category;
    }
    return item;
}

/**
 * Helper to check if items are filtered correctly.
 */
function expectFiltering(context: CompletionContext, category: string, shouldBeIncluded: boolean) {
    const items = [createItem("TEST_ITEM", category)];
    const filtered = filterItemsByContext(items, context);
    if (shouldBeIncluded) {
        expect(filtered).toHaveLength(1);
        expect(filtered[0].label).toBe("TEST_ITEM");
    } else {
        expect(filtered).toHaveLength(0);
    }
}

describe("completion-context: category filtering", () => {
    it("allows prologue category in prologue", () => {
        expectFiltering("prologue", "prologue", true);
    });

    it("rejects prologue category in action context", () => {
        expectFiltering("action", "prologue", false);
    });

    it("allows action category in action context", () => {
        expectFiltering("action", "action", true);
    });

    it("rejects action category in patch context", () => {
        expectFiltering("patch", "action", false);
    });

    it("allows patch category in patch context", () => {
        expectFiltering("patch", "patch", true);
    });

    it("rejects patch category in action context", () => {
        expectFiltering("action", "patch", false);
    });

    it("allows constants in both action and patch", () => {
        expectFiltering("action", "constants", true);
        expectFiltering("patch", "constants", true);
    });

    it("allows actionFunctions in action and lafName", () => {
        expectFiltering("action", "actionFunctions", true);
        expectFiltering("lafName", "actionFunctions", true);
    });

    it("rejects actionFunctions in patch context", () => {
        expectFiltering("patch", "actionFunctions", false);
    });

    it("allows everything in unknown context (fallback)", () => {
        expectFiltering("unknown", "prologue", true);
        expectFiltering("unknown", "action", true);
        expectFiltering("unknown", "patch", true);
    });

    it("allows items without category everywhere", () => {
        const itemNoCategory = createItem("NO_CATEGORY");
        expect(filterItemsByContext([itemNoCategory], "prologue")).toHaveLength(1);
        expect(filterItemsByContext([itemNoCategory], "action")).toHaveLength(1);
        expect(filterItemsByContext([itemNoCategory], "patch")).toHaveLength(1);
    });

    it("allows unmapped categories everywhere", () => {
        expectFiltering("prologue", "some-unknown-category", true);
        expectFiltering("action", "some-unknown-category", true);
    });
});

describe("completion-context: getContextAtPosition", () => {
    describe("file extension defaults", () => {
        it("returns patch for .tpp files", () => {
            const context = getContextAtPosition("", 0, 0, ".tpp");
            expect(context).toBe("patch");
        });

        it("returns action for .tpa files", () => {
            const context = getContextAtPosition("", 0, 0, ".tpa");
            expect(context).toBe("action");
        });

        it("returns action for .tph files", () => {
            const context = getContextAtPosition("", 0, 0, ".tph");
            expect(context).toBe("action");
        });

        it("returns prologue for empty .tp2 files", () => {
            const context = getContextAtPosition("", 0, 0, ".tp2");
            expect(context).toBe("prologue");
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
            const context = getContextAtPosition(tp2Content, 0, 0, ".tp2");
            expect(context).toBe("prologue");
        });

        it("detects flag after LANGUAGE, before BEGIN", () => {
            // Line 4: empty line after LANGUAGE, before BEGIN
            const context = getContextAtPosition(tp2Content, 4, 0, ".tp2");
            expect(context).toBe("flag");
        });

        it("detects action inside component", () => {
            // Line 6: COPY action
            const context = getContextAtPosition(tp2Content, 6, 4, ".tp2");
            expect(context).toBe("action");
        });

        it("detects patch inside COPY block", () => {
            // Line 7: WRITE_BYTE patch
            const context = getContextAtPosition(tp2Content, 7, 8, ".tp2");
            expect(context).toBe("patch");
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
            const context = getContextAtPosition(tphContent, 1, 4, ".tph");
            expect(context).toBe("action");
        });

        it("detects patch inside COPY", () => {
            // Line 2: WRITE_BYTE inside COPY
            const context = getContextAtPosition(tphContent, 2, 8, ".tph");
            expect(context).toBe("patch");
        });
    });

    describe("tpp patch file", () => {
        const tppContent = `WRITE_BYTE 0x00 1
READ_ASCII 0x08 name (8)
`;

        it("detects patch context", () => {
            const context = getContextAtPosition(tppContent, 0, 0, ".tpp");
            expect(context).toBe("patch");
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
            // Line 2: PRINT inside INNER_ACTION
            const context = getContextAtPosition(nestedContent, 2, 8, ".tph");
            expect(context).toBe("action");
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
            // Line 2 is inside COPY patches block
            const context = getContextAtPosition(copyBlockContent, 2, 8, ".tp2");
            expect(context).toBe("patch");
            // LAF has category "action" which should be rejected in patch context
            expectFiltering("patch", "action", false);
        });

        it("allows LPF in patch context", () => {
            const context = getContextAtPosition(copyBlockContent, 2, 8, ".tp2");
            expect(context).toBe("patch");
            // LPF has category "patch" which should be allowed in patch context
            expectFiltering("patch", "patch", true);
        });

        it("detects patch when typing incomplete patch command", () => {
            // User is typing inside COPY block, cursor after incomplete "WRITE_"
            const incomplete = `BEGIN ~Test~
    COPY ~file.itm~ ~override~
        WRITE_
END
`;
            // Line 2, column 14: right after "WRITE_" where user is typing
            const context = getContextAtPosition(incomplete, 2, 14, ".tp2");
            expect(context).toBe("patch");
        });

        it("detects patch on empty line inside COPY block", () => {
            // User on empty line after COPY, before first patch
            const emptyLine = `BEGIN ~Test~
    COPY ~file.itm~ ~override~

        WRITE_BYTE 0x00 1
END
`;
            // Line 2: empty line inside COPY patches area
            const context = getContextAtPosition(emptyLine, 2, 8, ".tp2");
            expect(context).toBe("patch");
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
            const context = getContextAtPosition(lafIncomplete, 1, 8, ".tp2");
            expect(context).toBe("lafName");
        });

        it("detects lpfName when typing function name after LPF", () => {
            // Incomplete LPF - user just typed "LPF " and is about to type function name
            const lpfIncomplete = `COPY ~file.itm~ ~override~
    LPF
END
`;
            // Line 1, column 8: right after "LPF " where function name goes
            const context = getContextAtPosition(lpfIncomplete, 1, 8, ".tph");
            expect(context).toBe("lpfName");
        });

        it("detects lafName with LAUNCH_ACTION_FUNCTION", () => {
            // User typed "LAUNCH_ACTION_FUNCTION A" and cursor is after "A"
            const lafFull = `BEGIN ~Test~
    LAUNCH_ACTION_FUNCTION A
    COPY_EXISTING ~%spell%.spl~ ~override~
END
`;
            // Line 1, column 27: right after "LAUNCH_ACTION_FUNCTION A"
            const context = getContextAtPosition(lafFull, 1, 27, ".tp2");
            expect(context).toBe("lafName");
        });

        it("detects lafName with incomplete LAUNCH_ACTION_FUNCTION (no END)", () => {
            // Exact user scenario: LAF incomplete, followed by COPY_EXISTING
            const lafIncomplete = `BEGIN ~Test~
    LAUNCH_ACTION_FUNCTION A
    COPY_EXISTING ~%spell%.spl~ ~override~
        target = 1
`;
            // Line 1, column 27: right after "LAUNCH_ACTION_FUNCTION A"
            const context = getContextAtPosition(lafIncomplete, 1, 27, ".tp2");
            expect(context).toBe("lafName");
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
            const context = getContextAtPosition(afterBegin, 5, 0, ".tp2");
            expect(context).toBe("componentFlagBoundary");
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
            const context = getContextAtPosition(withFlags, 5, 4, ".tp2");
            expect(context).toBe("componentFlag");
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
            const context = getContextAtPosition(withFlags, 6, 4, ".tp2");
            expect(context).toBe("action");
        });

        it("detects boundary after GROUP flag when no actions yet", () => {
            const afterGroupFlag = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN @123
GROUP @122

INCLUDE ~lib.tpa~
`;
            // Line 6: empty line after GROUP flag, before INCLUDE action
            // At boundary: both componentFlags and actions are valid completions
            const context = getContextAtPosition(afterGroupFlag, 6, 0, ".tp2");
            expect(context).toBe("componentFlagBoundary");
        });

        it("detects action on empty line inside component", () => {
            const withEmptyLine = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN ~Test~
    COPY ~file~ ~override~

END
`;
            // Line 6: empty line after COPY, inside component
            const context = getContextAtPosition(withEmptyLine, 6, 4, ".tp2");
            expect(context).toBe("action");
        });

        it("does not detect flag context inside component", () => {
            const insideComponent = `BACKUP ~backup~
AUTHOR ~me~
LANGUAGE ~English~ ~en~ ~en.tra~

BEGIN ~Test~

END
`;
            // Line 5: inside component, should NOT be flag
            const context = getContextAtPosition(insideComponent, 5, 4, ".tp2");
            expect(context).not.toBe("flag");
        });
    });
});
