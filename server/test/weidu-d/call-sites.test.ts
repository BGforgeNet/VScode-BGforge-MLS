/**
 * Unit tests for weidu-d/call-sites.ts - D call site extractor.
 * Tests that state label references are collected with composite keys.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { initParser } from "../../src/weidu-d/parser";
import { extractCallSites } from "../../src/weidu-d/call-sites";

const TEST_URI = "file:///test.d";

beforeAll(async () => {
    await initParser();
});

describe("weidu-d/call-sites", () => {
    it("collects state definitions and GOTO references", () => {
        const text = `
BEGIN ~MYMOD~
IF ~~ THEN BEGIN state1
  SAY ~Hello~
  IF ~~ THEN GOTO state1
END
`;
        const refs = extractCallSites(text, TEST_URI);
        // composite key: "mymod:state1"
        const stateRefs = refs.get("mymod:state1");
        expect(stateRefs).toBeDefined();
        // definition + GOTO = 2
        expect(stateRefs!.length).toBe(2);
    });

    it("collects EXTERN references with correct dialog file", () => {
        const text = `
BEGIN ~MYMOD~
IF ~~ THEN BEGIN state1
  SAY ~Hello~
  IF ~~ THEN EXTERN ~OTHER~ other_state
END
`;
        const refs = extractCallSites(text, TEST_URI);
        const externRef = refs.get("other:other_state");
        expect(externRef).toBeDefined();
        expect(externRef!.length).toBe(1);
    });

    it("collects EXTEND_TOP state references", () => {
        const text = `
EXTEND_TOP ~MYMOD~ state1
  IF ~~ THEN GOTO state2
END
`;
        const refs = extractCallSites(text, TEST_URI);
        const stateRef = refs.get("mymod:state1");
        expect(stateRef).toBeDefined();
        expect(stateRef!.length).toBe(1);
    });

    it("collects APPEND state definitions", () => {
        const text = `
APPEND ~MYMOD~
IF ~~ THEN BEGIN new_state
  SAY ~Appended~
  IF ~~ THEN GOTO new_state
END
END
`;
        const refs = extractCallSites(text, TEST_URI);
        const stateRefs = refs.get("mymod:new_state");
        expect(stateRefs).toBeDefined();
        // definition + GOTO = 2
        expect(stateRefs!.length).toBe(2);
    });

    it("returns correct URIs", () => {
        const text = `
BEGIN ~MYMOD~
IF ~~ THEN BEGIN state1
  SAY ~Hello~
END
`;
        const refs = extractCallSites(text, TEST_URI);
        const stateRefs = refs.get("mymod:state1");
        expect(stateRefs).toBeDefined();
        for (const loc of stateRefs!) {
            expect(loc.uri).toBe(TEST_URI);
        }
    });

    it("returns empty map for empty text", () => {
        const refs = extractCallSites("", TEST_URI);
        expect(refs.size).toBe(0);
    });
});
