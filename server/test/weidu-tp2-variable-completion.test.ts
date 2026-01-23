/**
 * Unit tests for WeiDU TP2 variable completion.
 * Tests local variable completion and header variable completion (with JSDoc).
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

// Mock isSubpath to always return true (files don't actually exist on disk for these tests)
vi.mock("../src/common", async (importOriginal) => {
    const mod = await importOriginal<typeof import("../src/common")>();
    return {
        ...mod,
        isSubpath: vi.fn(() => true),
    };
});

import { weiduTp2Provider } from "../src/weidu-tp2/provider";
import { initParser } from "../src/weidu-tp2/parser";
import { Language, Features } from "../src/data-loader";
import { LANG_WEIDU_TP2 } from "../src/core/languages";
import { pathToUri } from "../src/common";
import { defaultSettings } from "../src/settings";
import * as path from "path";

beforeAll(async () => {
    await initParser();
    await weiduTp2Provider.init?.({
        workspaceRoot: path.resolve(__dirname, "..", "src"),
        settings: defaultSettings,
    });
});

const features: Features = {
    completion: true,
    definition: true,
    hover: true,
    udf: true,
    headers: true,
    externalHeaders: false,
    headerExtension: ".tph",
    parse: false,
    parseRequiresGame: false,
    signature: false,
    staticCompletion: false,
    staticHover: false,
    staticSignature: false,
};

describe("weidu-tp2: local variable completion", () => {
    it("provides completions for OUTER_SET variables", () => {
        const text = `
OUTER_SET my_var = 5
OUTER_SET result = %my_var% + 1
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 2, character: 20 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const myVarItem = filteredItems.find((item) => item.label === "my_var");
        expect(myVarItem).toBeDefined();
        expect(myVarItem?.kind).toBe(6); // CompletionItemKind.Variable
    });

    it("provides completions for OUTER_TEXT_SPRINT variables", () => {
        const text = `
OUTER_TEXT_SPRINT mod_folder ~mymod~
COPY ~%mod_folder%/file.txt~ ~override~
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 2, character: 9 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const modFolderItem = filteredItems.find((item) => item.label === "mod_folder");
        expect(modFolderItem).toBeDefined();
        expect(modFolderItem?.kind).toBe(6);
    });

    it("provides completions for SET variables in functions", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    INT_VAR param = 0
BEGIN
    SET local_var = param + 1
    PATCH_PRINT ~local_var = %local_var%~
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 5, character: 31 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const localVarItem = filteredItems.find((item) => item.label === "local_var");
        expect(localVarItem).toBeDefined();
        expect(localVarItem?.kind).toBe(6);
    });

    it("provides completions for INT_VAR parameters", () => {
        const text = `
DEFINE_PATCH_FUNCTION AddItem
    INT_VAR count = 1
BEGIN
    SET total = count * 2
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 4, character: 16 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const countItem = filteredItems.find((item) => item.label === "count");
        expect(countItem).toBeDefined();
        expect(countItem?.kind).toBe(6);
    });

    it("provides completions for STR_VAR parameters", () => {
        const text = `
DEFINE_ACTION_FUNCTION PrintMessage
    STR_VAR message = ~default~
BEGIN
    ACTION_PRINT ~%message%~
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 4, character: 20 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const messageItem = filteredItems.find((item) => item.label === "message");
        expect(messageItem).toBeDefined();
        expect(messageItem?.kind).toBe(6);
    });

    it("provides completions for FOR_EACH loop variables", () => {
        const text = `
ACTION_DEFINE_ARRAY colors BEGIN ~red~ ~green~ ~blue~ END
ACTION_FOR_EACH color IN colors BEGIN
    OUTER_SPRINT msg ~Color: %color%~
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 3, character: 31 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const colorItem = filteredItems.find((item) => item.label === "color");
        expect(colorItem).toBeDefined();
        expect(colorItem?.kind).toBe(6);
    });

    it("provides completions for PHP_EACH loop variables", () => {
        const text = `
ACTION_DEFINE_ASSOCIATIVE_ARRAY potion_string BEGIN
    POTION01, ~Healing~
END
ACTION_PHP_EACH potion_string AS potion => string BEGIN
    OUTER_SPRINT msg ~%potion%~
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 5, character: 24 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const potionItem = filteredItems.find((item) => item.label === "potion");
        const stringItem = filteredItems.find((item) => item.label === "string");
        expect(potionItem).toBeDefined();
        expect(stringItem).toBeDefined();
        expect(potionItem?.kind).toBe(6);
        expect(stringItem?.kind).toBe(6);
    });

    it("provides completions for array variables", () => {
        const text = `
ACTION_DEFINE_ARRAY my_array BEGIN ~item1~ ~item2~ END
ACTION_FOR_EACH item IN my_array BEGIN
    PRINT ~%item%~
END
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 2, character: 30 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const arrayItem = filteredItems.find((item) => item.label === "my_array");
        expect(arrayItem).toBeDefined();
        expect(arrayItem?.kind).toBe(6);
    });

    it("does not duplicate variables with same name", () => {
        const text = `
OUTER_SET x = 1
OUTER_SET x = 2
OUTER_SET x = 3
`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 3, character: 10 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const xItems = filteredItems.filter((item) => item.label === "x");
        // Should only have one completion for 'x' despite multiple declarations
        expect(xItems.length).toBe(1);
    });
});

describe("weidu-tp2: header variable completion", () => {
    const workspaceRoot = path.resolve(__dirname, "..", "src");

    it("includes header variables with JSDoc in completions", async () => {
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tph file with a variable that has JSDoc
        const tphUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test-header.tph"));
        const tphContent = `
/**
 * Module folder path.
 * @type {string}
 */
OUTER_TEXT_SPRINT mod_folder ~mymod~
`;
        lang.reloadFileData(tphUri, tphContent);

        // Get completions for a different file (.tp2)
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test.tp2"));
        const completions = lang.completion(tp2Uri);

        // The variable with JSDoc should appear
        const modFolderItem = completions?.find((item) => item.label === "mod_folder");
        expect(modFolderItem).toBeDefined();
        expect(modFolderItem?.kind).toBe(6); // CompletionItemKind.Variable
    });

    it("includes header variables without JSDoc in completions", async () => {
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tph file with a variable that has NO JSDoc
        const tphUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test-header.tph"));
        const tphContent = `
OUTER_TEXT_SPRINT no_jsdoc ~value~
`;
        lang.reloadFileData(tphUri, tphContent);

        // Get completions for a different file (.tp2)
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test.tp2"));
        const completions = lang.completion(tp2Uri);

        // All top-level variables from .tph should appear, even without JSDoc
        const noJsdocItem = completions?.find((item) => item.label === "no_jsdoc");
        expect(noJsdocItem).toBeDefined();
        expect(noJsdocItem?.kind).toBe(6); // CompletionItemKind.Variable
    });

    it("includes header variables only from .tph files", async () => {
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tpa file with a variable with JSDoc
        const tpaUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test.tpa"));
        const tpaContent = `
/**
 * Local variable.
 * @type {int}
 */
OUTER_SET local_var = 5
`;
        lang.reloadFileData(tpaUri, tpaContent);

        // Get completions for a different file (.tp2)
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test.tp2"));
        const completions = lang.completion(tp2Uri);

        // Variables from .tpa files should NOT appear in other files' completions
        const localVarItem = completions?.find((item) => item.label === "local_var");
        expect(localVarItem).toBeUndefined();
    });

    it("provides hover info for header variables with JSDoc", async () => {
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tph file with a variable that has JSDoc
        const tphUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test-header.tph"));
        const tphContent = `
/**
 * Configuration flag for debug mode.
 * @type {int}
 */
OUTER_SET debug_mode = 0
`;
        lang.reloadFileData(tphUri, tphContent);

        // Get hover for the variable
        const hover = lang.hover(tphUri, "debug_mode");

        expect(hover).toBeDefined();
        expect(hover?.contents).toBeDefined();
        if (hover?.contents && typeof hover.contents === "object" && "value" in hover.contents) {
            // Updated to match new format: "int debug_mode = 0" instead of "variable debug_mode" + "Type: `int`"
            expect(hover.contents.value).toContain("int debug_mode = 0");
            expect(hover.contents.value).toContain("Configuration flag for debug mode");
        }
    });

    it("clears header variables when file is deleted", async () => {
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tph file with a variable with JSDoc
        const tphUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test-header.tph"));
        const tphContent = `
/**
 * Temporary variable.
 * @type {string}
 */
OUTER_TEXT_SPRINT temp_var ~value~
`;
        lang.reloadFileData(tphUri, tphContent);

        // Verify it appears in completions
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test.tp2"));
        let completions = lang.completion(tp2Uri);
        let tempVarItem = completions?.find((item) => item.label === "temp_var");
        expect(tempVarItem).toBeDefined();

        // Delete the file
        lang.clearFileData(tphUri);

        // Verify it no longer appears in completions
        completions = lang.completion(tp2Uri);
        tempVarItem = completions?.find((item) => item.label === "temp_var");
        expect(tempVarItem).toBeUndefined();
    });

    it("displays variable type and value correctly", async () => {
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        const tphUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test-header.tph"));
        // Test without JSDoc first
        const tphContent1 = `OUTER_SET test123 = 120
OUTER_TEXT_SPRINT mod_folder ~mymod~`;
        lang.reloadFileData(tphUri, tphContent1);

        // Test OUTER_SET displays as "int test123 = 120"
        const hoverSet = lang.hover(tphUri, "test123");
        expect(hoverSet?.contents).toBeDefined();
        if (hoverSet?.contents && typeof hoverSet.contents === "object" && "value" in hoverSet.contents) {
            expect(hoverSet.contents.value).toContain("int test123 = 120");
        }

        // Test OUTER_TEXT_SPRINT displays as "string mod_folder = ~mymod~"
        const hoverString = lang.hover(tphUri, "mod_folder");
        expect(hoverString?.contents).toBeDefined();
        if (hoverString?.contents && typeof hoverString.contents === "object" && "value" in hoverString.contents) {
            expect(hoverString.contents.value).toContain("string mod_folder = ~mymod~");
        }
    });

    it("respects JSDoc @type override for variables", async () => {
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        const tphUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "test-jsdoc-type.tph"));
        // Test JSDoc @type override - resref instead of string
        const tphContent = `/**
 * @type {resref}
 */
OUTER_TEXT_SPRINT spell ~SPWI101~`;
        lang.reloadFileData(tphUri, tphContent);

        // Test JSDoc @type overrides inferred type: "resref spell = ~SPWI101~" instead of "string spell = ~SPWI101~"
        const hoverResref = lang.hover(tphUri, "spell");
        expect(hoverResref?.contents).toBeDefined();
        if (hoverResref?.contents && typeof hoverResref.contents === "object" && "value" in hoverResref.contents) {
            expect(hoverResref.contents.value).toContain("resref spell = ~SPWI101~");
        }
    });
});

describe("weidu-tp2: JSDoc comment completions", () => {
    it("returns JSDoc tags and types inside single-line JSDoc comment", () => {
        const text = `/** @type  */\nOUTER_SET x = 1\n`;
        const uri = "file:///test.tp2";
        // Cursor inside the JSDoc comment (line 0, col 9 - after "@type ")
        const position: Position = { line: 0, character: 9 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        // Should have JSDoc tags and types, no code completions
        const labels = filteredItems.map(item => item.label);
        expect(labels).toContain("@type");
        expect(labels).toContain("@param");
        expect(labels).toContain("int");
        expect(labels).toContain("string");
        // Should NOT have code completions
        expect(labels).not.toContain("x");
    });

    it("returns JSDoc tags inside multi-line JSDoc comment", () => {
        const text = `/**\n * \n */\nOUTER_SET x = 1\n`;
        const uri = "file:///test.tp2";
        // Cursor on line 1 (the " * " line), col 3
        const position: Position = { line: 1, character: 3 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        const labels = filteredItems.map(item => item.label);
        expect(labels).toContain("@type");
        expect(labels).toContain("@param");
        expect(labels).toContain("int");
    });

    it("returns empty completions inside regular block comment", () => {
        const text = `/* regular comment */\nOUTER_SET x = 1\n`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 0, character: 10 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        expect(filteredItems).toHaveLength(0);
    });

    it("returns empty completions inside line comment", () => {
        const text = `// line comment\nOUTER_SET x = 1\n`;
        const uri = "file:///test.tp2";
        const position: Position = { line: 0, character: 5 };

        const allItems = weiduTp2Provider.getCompletions?.(uri) ?? [];
        const filteredItems = weiduTp2Provider.filterCompletions?.(allItems, text, position, uri) ?? [];

        expect(filteredItems).toHaveLength(0);
    });
});
