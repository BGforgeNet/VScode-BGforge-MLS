/**
 * Unit tests for weidu-tp2/call-sites.ts - TP2 call site extractor.
 * Tests that function/macro definitions and calls are collected with lowercased keys.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { initParser } from "../../src/weidu-tp2/parser";
import { extractCallSites } from "../../src/weidu-tp2/call-sites";

const TEST_URI = "file:///test.tp2";

beforeAll(async () => {
    await initParser();
});

describe("weidu-tp2/call-sites", () => {
    it("collects function definitions and calls", () => {
        const text = `
DEFINE_ACTION_FUNCTION my_func BEGIN END
LAF my_func END
LAF my_func END
`;
        const refs = extractCallSites(text, TEST_URI);
        const funcRefs = refs.get("my_func");
        // 1 definition + 2 calls = 3
        expect(funcRefs).toBeDefined();
        expect(funcRefs!.length).toBe(3);
    });

    it("preserves case in keys (case-sensitive)", () => {
        const text = `
DEFINE_ACTION_FUNCTION MY_FUNC BEGIN END
LAF my_func END
`;
        const refs = extractCallSites(text, TEST_URI);
        // Different cases are separate keys
        const upperRefs = refs.get("MY_FUNC");
        const lowerRefs = refs.get("my_func");
        expect(upperRefs).toBeDefined();
        expect(upperRefs!.length).toBe(1);
        expect(lowerRefs).toBeDefined();
        expect(lowerRefs!.length).toBe(1);
    });

    it("collects macro definitions and calls", () => {
        const text = `
DEFINE_ACTION_MACRO my_macro BEGIN END
LAM my_macro
`;
        const refs = extractCallSites(text, TEST_URI);
        const macroRefs = refs.get("my_macro");
        expect(macroRefs).toBeDefined();
        expect(macroRefs!.length).toBe(2);
    });

    it("collects patch functions", () => {
        const text = `
DEFINE_PATCH_FUNCTION patch_func BEGIN END
`;
        const refs = extractCallSites(text, TEST_URI);
        const funcRefs = refs.get("patch_func");
        expect(funcRefs).toBeDefined();
        expect(funcRefs!.length).toBe(1);
    });

    it("does not index variable assignments", () => {
        const text = `
OUTER_SET my_var = 5
OUTER_SET result = %my_var% + 1
`;
        const refs = extractCallSites(text, TEST_URI);
        // Variables are not indexed (only functions/macros)
        expect(refs.has("my_var")).toBe(false);
    });

    it("returns correct URIs", () => {
        const text = `
DEFINE_ACTION_FUNCTION test_func BEGIN END
`;
        const refs = extractCallSites(text, TEST_URI);
        const funcRefs = refs.get("test_func");
        expect(funcRefs).toBeDefined();
        for (const loc of funcRefs!) {
            expect(loc.uri).toBe(TEST_URI);
        }
    });

    it("returns empty map for empty text", () => {
        const refs = extractCallSites("", TEST_URI);
        expect(refs.size).toBe(0);
    });
});
