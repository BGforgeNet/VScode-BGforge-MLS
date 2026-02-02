/**
 * Integration tests for snippet insertion in completion flow.
 * Verifies that filterCompletions produces correct snippets when selecting
 * functions from the lpfName context (after typing LPF).
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { InsertTextFormat } from "vscode-languageserver/node";

vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

vi.mock("../../src/lsp-connection", () => ({
    getConnection: vi.fn(() => ({
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    })),
    initLspConnection: vi.fn(),
}));

import { initParser } from "../../src/weidu-tp2/parser";
import { weiduTp2Provider, getSymbols } from "../../src/weidu-tp2/provider";
import { parseHeaderToSymbols } from "../../src/weidu-tp2/header-parser";
import { defaultSettings } from "../../src/settings";
import * as path from "path";

const HEADER_URI = "file:///test-snippet.tph";
const CURRENT_URI = "file:///test-mod.tp2";

beforeAll(async () => {
    await initParser();
    await weiduTp2Provider.init?.({
        workspaceRoot: path.resolve(__dirname, "..", "src"),
        settings: defaultSettings,
    });

    const headerContent = `
DEFINE_PATCH_FUNCTION func_with_params
    INT_VAR opcode = 206
    STR_VAR resource = ~~
BEGIN
    WRITE_BYTE 0x00 0
END

DEFINE_PATCH_FUNCTION func_no_params
BEGIN
    WRITE_BYTE 0x00 0
END

/**
 * @arg {int} count! required int
 * @arg {string} name! required string
 */
DEFINE_PATCH_FUNCTION func_required_params
    INT_VAR count = 0
    STR_VAR name = ~~
BEGIN
    WRITE_BYTE 0x00 0
END

DEFINE_PATCH_MACRO my_patch_macro
BEGIN
    WRITE_BYTE 0x00 0
END
`;
    const store = getSymbols()!;
    store.updateFile(HEADER_URI, parseHeaderToSymbols(HEADER_URI, headerContent));
});

describe("weidu-tp2: snippet integration in lpfName context", () => {
    it("inserts multi-line snippet for function with params", () => {
        const text = "COPY_EXISTING ~spell.spl~ ~override~\n  LPF ";
        const position = { line: 1, character: 6 };

        const completions = weiduTp2Provider.getCompletions!(CURRENT_URI);
        const filtered = weiduTp2Provider.filterCompletions!(
            completions, text, position, CURRENT_URI
        );

        const item = filtered.find(c => c.label === "func_with_params");
        expect(item).toBeDefined();
        expect(item!.insertTextFormat).toBe(InsertTextFormat.Snippet);
        expect(item!.insertText).toBe("func_with_params\n    $0\nEND");
    });

    it("inserts single-line snippet for function without params", () => {
        const text = "COPY_EXISTING ~spell.spl~ ~override~\n  LPF ";
        const position = { line: 1, character: 6 };

        const completions = weiduTp2Provider.getCompletions!(CURRENT_URI);
        const filtered = weiduTp2Provider.filterCompletions!(
            completions, text, position, CURRENT_URI
        );

        const item = filtered.find(c => c.label === "func_no_params");
        expect(item).toBeDefined();
        // No params → no snippet, just plain text insert
        expect(item!.insertTextFormat).toBeUndefined();
        expect(item!.insertText).toBeUndefined();
    });

    it("auto-inserts required param blocks for function with required params", () => {
        const text = "COPY_EXISTING ~spell.spl~ ~override~\n  LPF ";
        const position = { line: 1, character: 6 };

        const completions = weiduTp2Provider.getCompletions!(CURRENT_URI);
        const filtered = weiduTp2Provider.filterCompletions!(
            completions, text, position, CURRENT_URI
        );

        const item = filtered.find(c => c.label === "func_required_params");
        expect(item).toBeDefined();
        expect(item!.insertTextFormat).toBe(InsertTextFormat.Snippet);
        expect(item!.insertText).toBe(
            "func_required_params\n"
            + "    INT_VAR\n"
            + "        count = ${1}\n"
            + "    STR_VAR\n"
            + "        name = ${2}\n"
            + "END\n$0"
        );
    });

    it("filters out macros from lpfName context", () => {
        const text = "COPY_EXISTING ~spell.spl~ ~override~\n  LPF ";
        const position = { line: 1, character: 6 };

        const completions = weiduTp2Provider.getCompletions!(CURRENT_URI);
        const filtered = weiduTp2Provider.filterCompletions!(
            completions, text, position, CURRENT_URI
        );

        const item = filtered.find(c => c.label === "my_patch_macro");
        expect(item).toBeUndefined();
    });
});
