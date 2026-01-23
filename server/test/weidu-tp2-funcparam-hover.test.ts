/**
 * Unit tests for WeiDU TP2 function parameter position-scoped hover.
 * Tests that hover only shows parameter info when cursor is inside a function call.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { Position } from "vscode-languageserver/node";

// Mock the LSP connection module
vi.mock("../src/lsp-connection", () => ({
    getConnection: vi.fn(() => ({
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    })),
    initLspConnection: vi.fn(),
}));

// Mock isSubpath to always return true
vi.mock("../src/common", async (importOriginal) => {
    const mod = await importOriginal<typeof import("../src/common")>();
    return {
        ...mod,
        isSubpath: vi.fn(() => true),
    };
});

import { weiduTp2Provider } from "../src/weidu-tp2/provider";
import { initParser } from "../src/weidu-tp2/parser";
import { defaultSettings } from "../src/settings";
import * as path from "path";

beforeAll(async () => {
    await initParser();
    await weiduTp2Provider.init?.({
        workspaceRoot: path.resolve(__dirname, "..", "src"),
        settings: defaultSettings,
    });
});

describe("weidu-tp2: function parameter hover (position-scoped)", () => {
    it("returns hover info for parameter when cursor is inside function call", () => {
        // Define a function in header file
        const headerText = `
DEFINE_ACTION_FUNCTION unstack_armor_bonus
    INT_VAR
        stacking_id_base = 0
BEGIN
    PRINT ~test~
END
`;
        const headerUri = "file:///lib.tph";
        weiduTp2Provider.reloadFileData?.(headerUri, headerText);

        // Test hover inside function call - cursor on parameter name
        const text = `OUTER_SET stacking_id_base = 123
LAF unstack_armor_bonus
    INT_VAR
        stacking_id_base = 100
END
`;
        const uri = "file:///test.tp2";
        // Position on "stacking_id_base" at line 3 (inside the function call)
        const position: Position = { line: 3, character: 10 };

        const hover = weiduTp2Provider.hover?.(text, "stacking_id_base", uri, position);

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        if (hover?.contents && typeof hover.contents === "object" && "value" in hover.contents) {
            // Should show parameter info
            expect(hover.contents.value).toContain("int stacking_id_base = 0");
        }
    });

    it("returns null for same-named variable when cursor is outside function call", () => {
        // Define a function in header file
        const headerText = `
DEFINE_ACTION_FUNCTION unstack_armor_bonus
    INT_VAR
        stacking_id_base = 0
BEGIN
    PRINT ~test~
END
`;
        const headerUri = "file:///lib.tph";
        weiduTp2Provider.reloadFileData?.(headerUri, headerText);

        // Test hover outside function call - cursor on variable declaration
        const text = `OUTER_SET stacking_id_base = 123
LAF unstack_armor_bonus
    INT_VAR
        stacking_id_base = 100
END
`;
        const uri = "file:///test.tp2";
        // Position on "stacking_id_base" at line 0 (outside the function call)
        const position: Position = { line: 0, character: 15 };

        const hover = weiduTp2Provider.hover?.(text, "stacking_id_base", uri, position);

        // Should NOT show function parameter hover (position is outside function call)
        expect(hover).toBeNull();
    });

    it("returns hover for parameter in nested function calls based on position", () => {
        const headerText1 = `
DEFINE_ACTION_FUNCTION outer_func
    INT_VAR
        outer_param = 1
BEGIN
END
`;
        const headerText2 = `
DEFINE_PATCH_FUNCTION inner_func
    INT_VAR
        inner_param = 2
BEGIN
END
`;
        const headerUri1 = "file:///lib1.tph";
        const headerUri2 = "file:///lib2.tph";
        weiduTp2Provider.reloadFileData?.(headerUri1, headerText1);
        weiduTp2Provider.reloadFileData?.(headerUri2, headerText2);

        const text = `LAF outer_func
    INT_VAR
        outer_param = 10
END

COPY ~file.bcs~ ~override~
    LPF inner_func
        INT_VAR
            inner_param = 20
    END
`;
        const uri = "file:///test.tp2";

        // Position inside outer_func call
        const positionOuter: Position = { line: 2, character: 10 };
        const hoverOuter = weiduTp2Provider.hover?.(text, "outer_param", uri, positionOuter);
        expect(hoverOuter).toBeDefined();
        if (hoverOuter?.contents && typeof hoverOuter.contents === "object" && "value" in hoverOuter.contents) {
            expect(hoverOuter.contents.value).toContain("int outer_param = 1");
        }

        // Position inside inner_func call
        const positionInner: Position = { line: 8, character: 15 };
        const hoverInner = weiduTp2Provider.hover?.(text, "inner_param", uri, positionInner);
        expect(hoverInner).toBeDefined();
        if (hoverInner?.contents && typeof hoverInner.contents === "object" && "value" in hoverInner.contents) {
            expect(hoverInner.contents.value).toContain("int inner_param = 2");
        }

        // Position between the two function calls (outside both)
        const positionBetween: Position = { line: 4, character: 0 };
        const hoverBetween = weiduTp2Provider.hover?.(text, "outer_param", uri, positionBetween);
        expect(hoverBetween).toBeNull();
    });

    it("returns hover for STR_VAR parameter when inside function call", () => {
        const headerText = `
DEFINE_ACTION_FUNCTION test_func
    STR_VAR
        message = "default"
BEGIN
END
`;
        const headerUri = "file:///lib.tph";
        weiduTp2Provider.reloadFileData?.(headerUri, headerText);

        const text = `OUTER_TEXT_SPRINT message ~global~

LAF test_func
    STR_VAR
        message = ~local~
END
`;
        const uri = "file:///test.tp2";

        // Inside function call
        const positionInside: Position = { line: 4, character: 10 };
        const hoverInside = weiduTp2Provider.hover?.(text, "message", uri, positionInside);
        expect(hoverInside).toBeDefined();
        if (hoverInside?.contents && typeof hoverInside.contents === "object" && "value" in hoverInside.contents) {
            expect(hoverInside.contents.value).toContain('string message = "default"');
        }

        // Outside function call (on global variable)
        const positionOutside: Position = { line: 0, character: 22 };
        const hoverOutside = weiduTp2Provider.hover?.(text, "message", uri, positionOutside);
        expect(hoverOutside).toBeNull();
    });

    it("shows JSDoc description in parameter hover when available", () => {
        const headerText = `
/**
 * Test function with documented parameters.
 * @param {int} stacking_id_base - Base ID for stacking groups
 */
DEFINE_PATCH_FUNCTION unstack_armor_bonus
    INT_VAR
        stacking_id_base = 0
BEGIN
END
`;
        const headerUri = "file:///lib.tph";
        weiduTp2Provider.reloadFileData?.(headerUri, headerText);

        const text = `LPF unstack_armor_bonus
    INT_VAR
        stacking_id_base = 100
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 2, character: 10 };

        const hover = weiduTp2Provider.hover?.(text, "stacking_id_base", uri, position);

        expect(hover).toBeDefined();
        if (hover?.contents && typeof hover.contents === "object" && "value" in hover.contents) {
            expect(hover.contents.value).toContain("int stacking_id_base = 0");
            expect(hover.contents.value).toContain("Base ID for stacking groups");
        }
    });

    it("hides default value for required parameters in hover", () => {
        const headerText = `
/**
 * Test function with required parameter.
 * @param {int} required_param! - Required parameter (note the ! marker)
 */
DEFINE_ACTION_FUNCTION test_func
    INT_VAR
        required_param = 0
BEGIN
END
`;
        const headerUri = "file:///lib.tph";
        weiduTp2Provider.reloadFileData?.(headerUri, headerText);

        const text = `LAF test_func
    INT_VAR
        required_param = 42
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 2, character: 10 };

        const hover = weiduTp2Provider.hover?.(text, "required_param", uri, position);

        expect(hover).toBeDefined();
        if (hover?.contents && typeof hover.contents === "object" && "value" in hover.contents) {
            // Required param should NOT show "= 0" default value
            expect(hover.contents.value).toContain("int required_param");
            expect(hover.contents.value).not.toContain("= 0");
            expect(hover.contents.value).toContain("Required parameter");
        }
    });
});
