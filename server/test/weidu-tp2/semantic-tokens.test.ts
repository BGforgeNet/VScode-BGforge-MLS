/**
 * Unit tests for weidu-tp2/semantic-tokens.ts - function parameter reference highlighting.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { SemanticTokenTypes } from "vscode-languageserver/node";

vi.mock("../../src/lsp-connection", () => ({
    getConnection: () => ({
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    }),
    getDocuments: () => ({ get: vi.fn() }),
    initLspConnection: vi.fn(),
}));

import { initParser } from "../../src/weidu-tp2/parser";
import { getSemanticTokenSpans } from "../../src/weidu-tp2/semantic-tokens";

beforeAll(async () => {
    await initParser();
});

function getLine(text: string, line: number): string {
    return text.split("\n")[line] ?? "";
}

function tokenTexts(text: string): string[] {
    return getSemanticTokenSpans(text).map((span) =>
        getLine(text, span.line).slice(span.startChar, span.startChar + span.length)
    );
}

describe("weidu-tp2/semantic-tokens", () => {
    it("highlights INT_VAR parameter references in function body", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    INT_VAR count = 0
BEGIN
    SET total = count * 2
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(1);
        expect(spans[0]!.tokenType).toBe(SemanticTokenTypes.parameter);
        expect(tokenTexts(text)).toEqual(["count"]);
    });

    it("highlights STR_VAR parameter references in function body", () => {
        const text = `
DEFINE_ACTION_FUNCTION MyFunc
    STR_VAR name = ~~
BEGIN
    PRINT ~Hello %name%~
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(1);
        expect(spans[0]!.tokenType).toBe(SemanticTokenTypes.parameter);
        expect(tokenTexts(text)).toEqual(["name"]);
    });

    it("highlights RET parameter references in function body", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    RET result
BEGIN
    SET result = 42
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(1);
        expect(tokenTexts(text)).toEqual(["result"]);
    });

    it("highlights multiple parameters from different declaration types", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    INT_VAR x = 0
    STR_VAR label = ~~
    RET output
BEGIN
    SET output = x
    SPRINT output ~%label%~
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans.every((s) => s.tokenType === SemanticTokenTypes.parameter)).toBe(true);
        expect(tokenTexts(text)).toEqual(["output", "x", "output", "label"]);
    });

    it("does not highlight parameter names in the declaration itself", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    INT_VAR count = 0
BEGIN
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(0);
    });

    it("does not highlight variables that are not function parameters", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    INT_VAR count = 0
BEGIN
    SET local_var = 5
    SET total = count + local_var
END
`;

        expect(tokenTexts(text)).toEqual(["count"]);
    });

    it("does not highlight variables outside function definitions", () => {
        const text = `
OUTER_SET my_var = 5
OUTER_SET result = my_var + 1
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(0);
    });

    it("keeps parameters scoped to their own function", () => {
        const text = `
DEFINE_PATCH_FUNCTION First
    INT_VAR value = 0
BEGIN
    SET x = value
END

DEFINE_PATCH_FUNCTION Second
    INT_VAR value = 0
BEGIN
    SET y = value
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(2);
        expect(spans[0]!.line).not.toBe(spans[1]!.line);
    });

    it("highlights RET_ARRAY parameter references", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    RET_ARRAY results
BEGIN
    SET $results(~key~) = 1
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(1);
        expect(tokenTexts(text)).toEqual(["results"]);
    });

    it("handles DEFINE_ACTION_FUNCTION the same as DEFINE_PATCH_FUNCTION", () => {
        const text = `
DEFINE_ACTION_FUNCTION MyFunc
    INT_VAR count = 0
BEGIN
    PRINT ~%count%~
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(1);
        expect(tokenTexts(text)).toEqual(["count"]);
    });

    it("handles multiple params declared on the same INT_VAR line", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    INT_VAR a = 0 b = 0 c = 0
BEGIN
    SET x = a + b + c
END
`;

        expect(tokenTexts(text)).toEqual(["a", "b", "c"]);
    });

    it("handles multiple param references on the same body line", () => {
        const text = `
DEFINE_PATCH_FUNCTION MyFunc
    INT_VAR x = 0 y = 0
BEGIN
    SET total = x + y + x
END
`;

        expect(tokenTexts(text)).toEqual(["x", "y", "x"]);
    });

    it("handles multiple %var% references in the same string", () => {
        const text = `
DEFINE_ACTION_FUNCTION MyFunc
    STR_VAR first = ~~ last = ~~
BEGIN
    PRINT ~%first% %last%~
END
`;

        expect(tokenTexts(text)).toEqual(["first", "last"]);
    });

    it("handles %var% in multiline string content", () => {
        const text = `
DEFINE_ACTION_FUNCTION MyFunc
    STR_VAR name = ~~
BEGIN
    PRINT ~Hello
%name%
world~
END
`;

        const spans = getSemanticTokenSpans(text);

        expect(spans).toHaveLength(1);
        expect(tokenTexts(text)).toEqual(["name"]);
    });

    it("produces no tokens for macro definitions", () => {
        const text = `
DEFINE_ACTION_MACRO MyMacro BEGIN
    SET x = 1
END

DEFINE_PATCH_MACRO MyPatchMacro BEGIN
    SET y = 2
END
`;

        expect(getSemanticTokenSpans(text)).toEqual([]);
    });

    it("returns empty array for empty or unparseable text", () => {
        expect(getSemanticTokenSpans("")).toEqual([]);
    });
});
