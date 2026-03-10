/**
 * Unit tests for fallout-ssl/call-sites.ts - SSL call site extractor.
 * Tests that identifiers are collected and grouped by name for cross-file indexing.
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
import { extractCallSites } from "../../src/fallout-ssl/call-sites";

const TEST_URI = "file:///test.ssl";

beforeAll(async () => {
    await initParser();
});

describe("fallout-ssl/call-sites", () => {
    it("collects procedure name identifiers", () => {
        const text = `
procedure helper begin end
procedure main begin
    call helper;
end
`;
        const refs = extractCallSites(text, TEST_URI);
        const helperRefs = refs.get("helper");
        // "helper" appears in: procedure definition name + call site = 2
        expect(helperRefs).toBeDefined();
        expect(helperRefs!.length).toBeGreaterThanOrEqual(2);
    });

    it("collects macro identifiers", () => {
        const text = `
#define MAX_VAL 100
procedure foo begin
    if (x > MAX_VAL) then begin end
end
`;
        const refs = extractCallSites(text, TEST_URI);
        const maxRefs = refs.get("MAX_VAL");
        // Definition + usage
        expect(maxRefs).toBeDefined();
        expect(maxRefs!.length).toBeGreaterThanOrEqual(2);
    });

    it("returns correct URIs", () => {
        const text = `
procedure test begin end
`;
        const refs = extractCallSites(text, TEST_URI);
        const testRefs = refs.get("test");
        expect(testRefs).toBeDefined();
        for (const loc of testRefs!) {
            expect(loc.uri).toBe(TEST_URI);
        }
    });

    it("returns empty map for empty text", () => {
        const refs = extractCallSites("", TEST_URI);
        expect(refs.size).toBe(0);
    });
});
