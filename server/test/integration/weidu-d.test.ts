/**
 * Integration tests for WeiDU D language features using real fixture files.
 *
 * Tests: document symbols, definition, references, rename, folding ranges.
 * Uses files from external/infinity-engine/ repos (BGT-WeiDU, rr, Ascension).
 */

import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { initParser, isInitialized, parseWithCache } from "../../src/weidu-d/parser";
import { getDocumentSymbols } from "../../src/weidu-d/symbol";
import { getDefinition } from "../../src/weidu-d/definition";
import { findReferences } from "../../src/weidu-d/references";
import { renameSymbol, prepareRenameSymbol } from "../../src/weidu-d/rename";
import { createFoldingRangesProvider } from "../../src/shared/folding-ranges";
import { SyntaxType } from "../../src/weidu-d/tree-sitter.d";
import { loadFixture, findIdentifierPosition, IE_FIXTURES } from "./test-helpers";

const BGT_BASE = join(IE_FIXTURES, "BGT-WeiDU");

beforeAll(async () => {
    await initParser();
});

describe("weidu-d integration", () => {

    // =========================================================================
    // Document Symbols
    // =========================================================================

    describe("document symbols", () => {
        it("extracts state labels from a dialog file", () => {
            const f = loadFixture(BGT_BASE, "bgt/base/d_bg1/durlyle1.d");
            const symbols = getDocumentSymbols(f.text);

            // durlyle1.d has many dialog states (0, 1, 2, 3, 4, 5, 6, 7, 8, ...)
            expect(symbols.length).toBeGreaterThan(10);

            // State labels are numeric in this file
            const names = symbols.map(s => s.name);
            expect(names).toContain("0");
            expect(names).toContain("1");
            expect(names).toContain("7");
        });

        it("extracts named state labels from Ascension balth.d", () => {
            const f = loadFixture(IE_FIXTURES, "Ascension/ascension/balthazar/d/balth.d");
            const symbols = getDocumentSymbols(f.text);

            // balth.d has named states like a31, a32, a33, etc.
            const names = symbols.map(s => s.name);
            expect(names).toContain("a31");
            expect(names).toContain("a32");
            expect(symbols.length).toBeGreaterThan(5);
        });
    });

    // =========================================================================
    // Go to Definition
    // =========================================================================

    describe("go to definition", () => {
        it("navigates from GOTO reference to state definition", () => {
            const f = loadFixture(BGT_BASE, "bgt/base/d_bg1/durlyle1.d");

            // "GOTO 1" in state 0 — cursor on "1"
            // The first GOTO target in the file
            const pos = findIdentifierPosition(f.text, "GOTO 1");
            expect(pos).not.toBeNull();
            // Move cursor to the "1" after GOTO
            const targetPos = { line: pos!.line, character: pos!.character + 5 };

            const location = getDefinition(f.text, f.uri, targetPos);
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(f.uri);
        });

        it("navigates from GOTO to a named state label", () => {
            const f = loadFixture(IE_FIXTURES, "Ascension/ascension/balthazar/d/balth.d");

            // Find "GOTO a39" — this label is used in transitions and defined later
            const pos = findIdentifierPosition(f.text, "a39", 1);
            expect(pos).not.toBeNull();

            const location = getDefinition(f.text, f.uri, pos!);
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(f.uri);
        });
    });

    // =========================================================================
    // Find References
    // =========================================================================

    describe("find references", () => {
        it("finds all references to a state label", () => {
            const f = loadFixture(BGT_BASE, "bgt/base/d_bg1/durlyle1.d");

            // State "3" is referenced multiple times (GOTO 3 in various states)
            // Find the definition of state 3
            const pos = findIdentifierPosition(f.text, "BEGIN 3");
            expect(pos).not.toBeNull();
            // Move cursor to "3"
            const targetPos = { line: pos!.line, character: pos!.character + 6 };

            const refs = findReferences(f.text, targetPos, f.uri, true);
            // definition + at least 2 GOTO references
            expect(refs.length).toBeGreaterThanOrEqual(3);
            for (const ref of refs) {
                expect(ref.uri).toBe(f.uri);
            }
        });

        it("excludes declaration when includeDeclaration is false", () => {
            const f = loadFixture(BGT_BASE, "bgt/base/d_bg1/durlyle1.d");

            const pos = findIdentifierPosition(f.text, "BEGIN 3");
            expect(pos).not.toBeNull();
            const targetPos = { line: pos!.line, character: pos!.character + 6 };

            const refsInclude = findReferences(f.text, targetPos, f.uri, true);
            const refsExclude = findReferences(f.text, targetPos, f.uri, false);

            expect(refsExclude.length).toBe(refsInclude.length - 1);
        });
    });

    // =========================================================================
    // Rename
    // =========================================================================

    describe("rename", () => {
        it("renames a named state label and all its references", () => {
            const f = loadFixture(IE_FIXTURES, "Ascension/ascension/balthazar/d/balth.d");

            // Find state "a39" at its definition (BEGIN a39) — 5th occurrence
            // a39 has 4 GOTO refs + 1 definition, all within APPEND BALTH
            const pos = findIdentifierPosition(f.text, "a39", 5);
            expect(pos).not.toBeNull();

            const result = renameSymbol(f.text, pos!, "round2_entry", f.uri);
            expect(result).not.toBeNull();

            const edits = result!.changes?.[f.uri];
            expect(edits).toBeDefined();
            // definition + 4 GOTO references = 5
            expect(edits!.length).toBe(5);
            for (const edit of edits!) {
                expect(edit.newText).toBe("round2_entry");
            }
        });

        it("prepareRename returns range and placeholder", () => {
            const f = loadFixture(IE_FIXTURES, "Ascension/ascension/balthazar/d/balth.d");

            // Use the definition occurrence (BEGIN a31)
            const pos = findIdentifierPosition(f.text, "a31", 2);
            expect(pos).not.toBeNull();

            const prep = prepareRenameSymbol(f.text, pos!);
            expect(prep).not.toBeNull();
            expect(prep!.placeholder).toBe("a31");
        });
    });

    // =========================================================================
    // Folding Ranges
    // =========================================================================

    describe("folding ranges", () => {
        const D_FOLDABLE_TYPES = new Set([
            SyntaxType.BeginAction,
            SyntaxType.AppendAction,
            SyntaxType.ChainAction,
            SyntaxType.ExtendAction,
            SyntaxType.InterjectAction,
            SyntaxType.InterjectCopyTrans,
            SyntaxType.ReplaceAction,
            SyntaxType.State,
            SyntaxType.Transition,
        ]);
        const getFoldingRanges = createFoldingRangesProvider(isInitialized, parseWithCache, D_FOLDABLE_TYPES);

        it("produces folding ranges for dialog states", () => {
            const f = loadFixture(BGT_BASE, "bgt/base/d_bg1/durlyle1.d");

            const ranges = getFoldingRanges(f.text);
            // Many states should produce folding ranges
            expect(ranges.length).toBeGreaterThan(10);
        });

        it("produces folding ranges for APPEND blocks", () => {
            const f = loadFixture(IE_FIXTURES, "Ascension/ascension/balthazar/d/balth.d");

            const ranges = getFoldingRanges(f.text);
            // balth.d has APPEND blocks containing multiple states
            expect(ranges.length).toBeGreaterThan(5);
        });

        it("produces correct range counts for a file with many states", () => {
            const f = loadFixture(IE_FIXTURES, "Ascension/ascension/balthazar/d/balth.d");

            const ranges = getFoldingRanges(f.text);
            // balth.d has REPLACE + APPEND + many states + transitions
            expect(ranges.length).toBeGreaterThan(10);
        });
    });
});
