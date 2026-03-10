/**
 * Unit tests for fallout-ssl/references.ts - findReferences LSP feature.
 * Tests that references are returned as Location[] with correct scoping
 * and includeDeclaration filtering.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

vi.mock("../../src/lsp-connection", () => ({
    getConnection: () => ({
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    }),
    getDocuments: () => ({ get: vi.fn() }),
    initLspConnection: vi.fn(),
}));

import { initParser } from "../../src/fallout-ssl/parser";
import { findReferences } from "../../src/fallout-ssl/references";

const TEST_URI = "file:///test.ssl";

beforeAll(async () => {
    await initParser();
});

describe("fallout-ssl/references", () => {
    describe("procedure references (file-scoped)", () => {
        const text = `
procedure helper begin end
procedure main begin
    call helper;
    call helper;
end
`;
        it("finds definition and all call sites", () => {
            // cursor on "helper" at line 1, character 10
            const refs = findReferences(text, { line: 1, character: 10 }, TEST_URI, true);
            // definition + 2 call sites = 3
            expect(refs).toHaveLength(3);
            for (const ref of refs) {
                expect(ref.uri).toBe(TEST_URI);
            }
        });

        it("excludes definition when includeDeclaration is false", () => {
            const refs = findReferences(text, { line: 1, character: 10 }, TEST_URI, false);
            // 2 call sites only (definition excluded)
            expect(refs).toHaveLength(2);
        });
    });

    describe("variable references (procedure-scoped)", () => {
        const text = `
procedure foo begin
    variable counter;
    counter := 0;
    counter := counter + 1;
end
procedure bar begin
    variable counter;
    counter := 99;
end
`;
        it("finds references only within the containing procedure", () => {
            // cursor on "counter" in foo at line 2, character 13
            const refs = findReferences(text, { line: 2, character: 13 }, TEST_URI, true);
            // declaration + 3 usages in foo = 4, NOT including bar's counter
            expect(refs).toHaveLength(4);
            // All refs should be within foo's range (lines 1-5)
            for (const ref of refs) {
                expect(ref.range.start.line).toBeGreaterThanOrEqual(1);
                expect(ref.range.end.line).toBeLessThanOrEqual(5);
            }
        });

        it("excludes declaration when includeDeclaration is false", () => {
            const refs = findReferences(text, { line: 2, character: 13 }, TEST_URI, false);
            // 3 usages only
            expect(refs).toHaveLength(3);
        });
    });

    describe("macro references (file-scoped)", () => {
        it("finds macro definition and all usages", () => {
            const text = `
#define MAX_ITEMS 100

procedure foo begin
    if (count > MAX_ITEMS) then begin
    end
end
procedure bar begin
    display_msg(MAX_ITEMS);
end
`;
            const refs = findReferences(text, { line: 1, character: 8 }, TEST_URI, true);
            // definition + usage in foo + usage in bar = 3
            expect(refs).toHaveLength(3);
        });
    });

    describe("shadow exclusion", () => {
        it("skips procedure-local shadows for file-scoped symbols", () => {
            const text = `
#define x 42

procedure foo begin
    variable x;
    x := 1;
end
procedure bar begin
    display_msg(x);
end
`;
            // cursor on "x" at the #define line 1
            const refs = findReferences(text, { line: 1, character: 8 }, TEST_URI, true);
            // definition + bar usage = 2 (foo shadows x, so skipped)
            expect(refs).toHaveLength(2);
        });
    });

    describe("edge cases", () => {
        it("returns empty array for unknown symbol", () => {
            const text = `
procedure foo begin
    display_msg("hello");
end
`;
            // cursor on "display_msg" — not a local definition
            const refs = findReferences(text, { line: 2, character: 4 }, TEST_URI, true);
            expect(refs).toHaveLength(0);
        });

        it("returns empty array for position not on an identifier", () => {
            const text = `
procedure foo begin end
`;
            // cursor on whitespace
            const refs = findReferences(text, { line: 0, character: 0 }, TEST_URI, true);
            expect(refs).toHaveLength(0);
        });
    });
});
