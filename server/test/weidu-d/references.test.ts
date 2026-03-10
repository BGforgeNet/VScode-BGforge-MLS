/**
 * Unit tests for weidu-d/references.ts - findReferences LSP feature.
 * Tests that state label references are returned as Location[] with correct
 * dialog scoping and includeDeclaration filtering.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { initParser } from "../../src/weidu-d/parser";
import { findReferences } from "../../src/weidu-d/references";
import { ReferencesIndex } from "../../src/shared/references-index";

const TEST_URI = "file:///test.d";

beforeAll(async () => {
    await initParser();
});

describe("weidu-d/references", () => {
    describe("state label refs within BEGIN block", () => {
        const text = `
BEGIN ~MYMOD~
  IF ~True()~ THEN BEGIN state1
    SAY ~Hello~
    IF ~~ THEN GOTO state1
    IF ~~ THEN GOTO state2
  END

  IF ~True()~ THEN BEGIN state2
    SAY ~World~
    IF ~~ THEN GOTO state1
  END
`;
        it("finds definition and GOTO refs for state1", () => {
            // cursor on "state1" at definition, line 2, character 28
            const refs = findReferences(text, { line: 2, character: 28 }, TEST_URI, true);
            // definition + GOTO on line 4 + GOTO on line 10 = 3
            expect(refs).toHaveLength(3);
            for (const ref of refs) {
                expect(ref.uri).toBe(TEST_URI);
            }
        });

        it("excludes definition when includeDeclaration is false", () => {
            const refs = findReferences(text, { line: 2, character: 28 }, TEST_URI, false);
            // 2 GOTO refs only
            expect(refs).toHaveLength(2);
        });

        it("works from a GOTO reference site", () => {
            // cursor on "state1" at GOTO on line 4
            const refs = findReferences(text, { line: 4, character: 22 }, TEST_URI, true);
            expect(refs).toHaveLength(3);
        });
    });

    describe("refs across BEGIN and APPEND blocks", () => {
        it("finds refs in both BEGIN and APPEND for same dialog", () => {
            const text = `
BEGIN ~MYMOD~
  IF ~True()~ THEN BEGIN start
    SAY ~Hello~
    IF ~~ THEN GOTO added
  END

APPEND ~MYMOD~
  IF ~True()~ THEN BEGIN added
    SAY ~Appended~
    IF ~~ THEN GOTO start
  END
END
`;
            // cursor on "added" at GOTO on line 4
            const refs = findReferences(text, { line: 4, character: 22 }, TEST_URI, true);
            // GOTO in BEGIN + definition in APPEND = 2
            expect(refs).toHaveLength(2);
        });
    });

    describe("top-level action refs", () => {
        it("finds EXTEND_TOP state reference", () => {
            const text = `
BEGIN ~MYMOD~
  IF ~True()~ THEN BEGIN target
    SAY ~Hello~
  END

EXTEND_TOP ~MYMOD~ target
  IF ~~ THEN GOTO target
`;
            // cursor on "target" definition
            const refs = findReferences(text, { line: 2, character: 28 }, TEST_URI, true);
            // definition + EXTEND_TOP states ref + GOTO in EXTEND = 3
            expect(refs).toHaveLength(3);
        });
    });

    describe("edge cases", () => {
        it("returns empty for position not on a label", () => {
            const text = `
BEGIN ~MYMOD~
  IF ~True()~ THEN BEGIN state1
    SAY ~Hello~
  END
`;
            // cursor on "SAY" keyword
            const refs = findReferences(text, { line: 3, character: 4 }, TEST_URI, true);
            expect(refs).toHaveLength(0);
        });

        it("returns empty for label without definition in file and no index", () => {
            const text = `
BEGIN ~MYMOD~
  IF ~True()~ THEN BEGIN state1
    SAY ~Hello~
    IF ~~ THEN EXTERN ~OTHER~ missing_state
  END
`;
            // cursor on "missing_state" — EXTERN to another dialog, no definition here
            const refs = findReferences(text, { line: 4, character: 29 }, TEST_URI, true);
            // The label belongs to dialog OTHER, which has no definition in this file
            expect(refs).toHaveLength(0);
        });

        it("returns cross-file refs for label without local definition when index provided", () => {
            const text = `
BEGIN ~MYMOD~
  IF ~True()~ THEN BEGIN state1
    SAY ~Hello~
    IF ~~ THEN EXTERN ~OTHER~ missing_state
  END
`;
            const OTHER_URI = "file:///other.d";
            const index = new ReferencesIndex();
            index.updateFile(OTHER_URI, new Map([
                ["other:missing_state", [{ uri: OTHER_URI, range: { start: { line: 1, character: 0 }, end: { line: 1, character: 13 } } }]],
            ]));

            // cursor on "missing_state" — EXTERN to OTHER dialog (starts at col 30)
            const refs = findReferences(text, { line: 4, character: 30 }, TEST_URI, true, index);
            // No local definition, but cross-file index has the definition in other.d
            expect(refs).toHaveLength(1);
            expect(refs[0].uri).toBe(OTHER_URI);
        });
    });
});
