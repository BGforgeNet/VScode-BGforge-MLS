/**
 * Integration tests for Fallout SSL language features using real fixture files.
 *
 * Uses files from external/fallout/ repos (Restoration Project, FO2tweaks, sfall)
 * to test all SSL LSP features against real-world code.
 */

import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { FoldingRangeKind, type Position } from "vscode-languageserver/node";
import { initParser } from "../../src/fallout-ssl/parser";
import { getDocumentSymbols } from "../../src/fallout-ssl/symbol";
import { getLocalDefinition } from "../../src/fallout-ssl/definition";
import { findReferences } from "../../src/fallout-ssl/references";
import { renameSymbol, prepareRenameSymbol } from "../../src/fallout-ssl/rename";
import { getLocalSignature } from "../../src/fallout-ssl/signature";
import { getSslCompletionContext, SslCompletionContext } from "../../src/fallout-ssl/completion-context";
import { getLocalSymbols } from "../../src/fallout-ssl/local-symbols";
import { createFoldingRangesProvider } from "../../src/shared/folding-ranges";
import { isInitialized, parseWithCache } from "../../src/fallout-ssl/parser";
import { SyntaxType } from "../../src/fallout-ssl/tree-sitter.d";
import { loadFixture, findIdentifierPosition, FALLOUT_FIXTURES } from "./test-helpers";

const RP_BASE = join(FALLOUT_FIXTURES, "Fallout2_Restoration_Project/scripts_src");
const TWEAKS_BASE = join(FALLOUT_FIXTURES, "FO2tweaks");
const SFALL_BASE = join(FALLOUT_FIXTURES, "sfall/artifacts/scripting");

beforeAll(async () => {
    await initParser();
});

describe("fallout-ssl integration", () => {

    // =========================================================================
    // Document Symbols
    // =========================================================================

    describe("document symbols", () => {
        it("extracts procedures from a real .ssl file (gl_g_scenepid)", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");
            const symbols = getDocumentSymbols(f.text);

            const names = symbols.map(s => s.name);
            expect(names).toContain("print_scenery");
            expect(names).toContain("start");
            expect(names).toContain("map_enter_p_proc");
            // 3 procedures + SCRIPT_REALNAME macro = 4
            expect(symbols.length).toBe(4);
        });

        it("extracts procedures with forward declarations from dclara.ssl", () => {
            const f = loadFixture(RP_BASE, "den/dclara.ssl");
            const symbols = getDocumentSymbols(f.text);

            // dclara.ssl has many procedures: start, critter_p_proc, talk_p_proc, Node001..Node034, etc.
            const names = symbols.map(s => s.name);
            expect(names).toContain("start");
            expect(names).toContain("talk_p_proc");
            expect(names).toContain("Node001");
            // Should have a significant number of procedures
            expect(symbols.length).toBeGreaterThan(20);
        });

        it("extracts macros from a real .h header file", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");
            const symbols = getDocumentSymbols(f.text);

            const names = symbols.map(s => s.name);
            // define.h has macros like ndebug, no_proc, start_proc, etc.
            expect(names).toContain("ndebug");
            expect(names).toContain("DEFINE_H");
            expect(symbols.length).toBeGreaterThan(10);
        });

        it("extracts procedures with local variables as children", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");
            const symbols = getDocumentSymbols(f.text);

            const printScenery = symbols.find(s => s.name === "print_scenery");
            expect(printScenery).toBeDefined();
            // print_scenery has "variable s, scenery = ..." — should have children
            expect(printScenery!.children).toBeDefined();
            expect(printScenery!.children!.length).toBeGreaterThanOrEqual(1);
            const childNames = printScenery!.children!.map(c => c.name);
            expect(childNames).toContain("s");
        });
    });

    // =========================================================================
    // Go to Definition
    // =========================================================================

    describe("go to definition", () => {
        it("navigates to a procedure definition from a call site", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            // "call print_scenery" in the start procedure
            const pos = findIdentifierPosition(f.text, "print_scenery", 2);
            expect(pos).not.toBeNull();

            const location = getLocalDefinition(f.text, f.uri, pos!);
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(f.uri);
            // Should point to the procedure definition (line 4, 0-indexed)
            expect(location!.range.start.line).toBe(4);
        });

        it("navigates to a variable declaration within a procedure", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            // "s" variable used in foreach — find its usage
            const pos = findIdentifierPosition(f.text, "scenery", 2);
            expect(pos).not.toBeNull();

            const location = getLocalDefinition(f.text, f.uri, pos!);
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(f.uri);
        });

        it("navigates to macro definition in a header file", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");

            // Find usage of METARULE_TEST_FIRSTRUN in map_first_run macro
            const pos = findIdentifierPosition(f.text, "METARULE_TEST_FIRSTRUN", 2);
            expect(pos).not.toBeNull();

            const location = getLocalDefinition(f.text, f.uri, pos!);
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(f.uri);
        });

        it("returns null for built-in functions (not locally defined)", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            // "debug_msg" is a built-in — should return null for local definition
            const pos = findIdentifierPosition(f.text, "obj_name");
            expect(pos).not.toBeNull();

            const location = getLocalDefinition(f.text, f.uri, pos!);
            expect(location).toBeNull();
        });
    });

    // =========================================================================
    // Find References
    // =========================================================================

    describe("find references", () => {
        it("finds all references to a procedure within the file", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            // print_scenery: defined once, called twice (in start and map_enter_p_proc)
            const pos = findIdentifierPosition(f.text, "print_scenery", 1);
            expect(pos).not.toBeNull();

            const refs = findReferences(f.text, pos!, f.uri, true);
            // definition + 2 call sites = 3
            expect(refs).toHaveLength(3);
            for (const ref of refs) {
                expect(ref.uri).toBe(f.uri);
            }
        });

        it("excludes declaration when includeDeclaration is false", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            const pos = findIdentifierPosition(f.text, "print_scenery", 1);
            expect(pos).not.toBeNull();

            const refs = findReferences(f.text, pos!, f.uri, false);
            // 2 call sites only
            expect(refs).toHaveLength(2);
        });

        it("finds variable references scoped to containing procedure", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            // "scenery" variable in print_scenery procedure
            const pos = findIdentifierPosition(f.text, "scenery", 1);
            expect(pos).not.toBeNull();

            const refs = findReferences(f.text, pos!, f.uri, true);
            expect(refs.length).toBeGreaterThanOrEqual(2);
            // All refs should be within print_scenery's range (lines 4-11)
            for (const ref of refs) {
                expect(ref.range.start.line).toBeGreaterThanOrEqual(4);
                expect(ref.range.end.line).toBeLessThanOrEqual(11);
            }
        });

        it("finds macro references across the file", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");

            // METARULE_TEST_FIRSTRUN defined and used within the same file
            const pos = findIdentifierPosition(f.text, "METARULE_TEST_FIRSTRUN", 1);
            expect(pos).not.toBeNull();

            const refs = findReferences(f.text, pos!, f.uri, true);
            // definition + at least 1 usage
            expect(refs.length).toBeGreaterThanOrEqual(2);
        });
    });

    // =========================================================================
    // Rename
    // =========================================================================

    describe("rename", () => {
        it("renames a procedure and all its call sites", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            // Rename print_scenery to print_all_scenery
            const pos = findIdentifierPosition(f.text, "print_scenery", 1);
            expect(pos).not.toBeNull();

            const result = renameSymbol(f.text, pos!, "print_all_scenery", f.uri);
            expect(result).not.toBeNull();

            const edits = result!.changes?.[f.uri];
            expect(edits).toBeDefined();
            // Definition + forward decl (if any) + 2 call sites
            expect(edits!.length).toBeGreaterThanOrEqual(3);
            for (const edit of edits!) {
                expect(edit.newText).toBe("print_all_scenery");
            }
        });

        it("prepareRename returns range and placeholder for a procedure", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            const pos = findIdentifierPosition(f.text, "print_scenery", 1);
            expect(pos).not.toBeNull();

            const prep = prepareRenameSymbol(f.text, pos!);
            expect(prep).not.toBeNull();
            expect(prep!.placeholder).toBe("print_scenery");
        });

        it("renames a macro within a header file", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");

            const pos = findIdentifierPosition(f.text, "METARULE_TEST_FIRSTRUN", 1);
            expect(pos).not.toBeNull();

            const result = renameSymbol(f.text, pos!, "METARULE_FIRST_RUN_CHECK", f.uri);
            expect(result).not.toBeNull();

            const edits = result!.changes?.[f.uri];
            expect(edits).toBeDefined();
            expect(edits!.length).toBeGreaterThanOrEqual(2);
        });
    });

    // =========================================================================
    // Signature Help
    // =========================================================================

    describe("signature help", () => {
        it("returns signature for a local parameterized macro", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");

            // ndebug(message) macro
            const sig = getLocalSignature(f.text, "ndebug", 0);
            expect(sig).not.toBeNull();
            expect(sig!.signatures).toHaveLength(1);
            expect(sig!.signatures[0].parameters).toBeDefined();
            expect(sig!.signatures[0].parameters!.length).toBe(1);
        });

        it("returns signature for a multi-parameter macro", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");

            // create_object(X,Y,Z) macro
            const sig = getLocalSignature(f.text, "create_object", 0);
            expect(sig).not.toBeNull();
            expect(sig!.signatures[0].parameters!.length).toBe(3);
        });

        it("returns null for a non-existent symbol", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");
            const sig = getLocalSignature(f.text, "nonexistent_function", 0);
            expect(sig).toBeNull();
        });
    });

    // =========================================================================
    // Completion Context
    // =========================================================================

    describe("completion context", () => {
        it("detects code context in a procedure body", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            // Position inside print_scenery body
            const pos: Position = { line: 6, character: 2 };
            const ctx = getSslCompletionContext(f.text, pos);
            expect(ctx).toBe(SslCompletionContext.Code);
        });

        it("detects comment context in a block comment", () => {
            const f = loadFixture(RP_BASE, "den/dclara.ssl");

            // Line 1 is inside the copyright block comment
            const ctx = getSslCompletionContext(f.text, { line: 1, character: 5 });
            expect(ctx).toBe(SslCompletionContext.Comment);
        });
    });

    // =========================================================================
    // Local Symbols (completion source)
    // =========================================================================

    describe("local symbols", () => {
        it("extracts all local symbols from a file for completion", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            const symbols = getLocalSymbols(f.text, f.uri);
            const names = symbols.map(s => s.name);

            expect(names).toContain("print_scenery");
            expect(names).toContain("start");
            expect(names).toContain("map_enter_p_proc");
        });

        it("extracts macros from header files", () => {
            const f = loadFixture(RP_BASE, "headers/define.h");

            const symbols = getLocalSymbols(f.text, f.uri);
            const names = symbols.map(s => s.name);

            expect(names).toContain("ndebug");
            expect(names).toContain("METARULE_TEST_FIRSTRUN");
        });

        it("extracts symbols from sfall header", () => {
            const f = loadFixture(SFALL_BASE, "headers/sfall.h");

            const symbols = getLocalSymbols(f.text, f.uri);
            const names = symbols.map(s => s.name);

            expect(names).toContain("WORLDMAP");
            expect(names).toContain("COMBAT");
            expect(names).toContain("HOOK_TOHIT");
            expect(symbols.length).toBeGreaterThan(20);
        });
    });

    // =========================================================================
    // Folding Ranges
    // =========================================================================

    describe("folding ranges", () => {
        const SSL_FOLDABLE_TYPES = new Set([
            SyntaxType.Procedure,
            SyntaxType.IfStmt,
            SyntaxType.WhileStmt,
            SyntaxType.ForStmt,
            SyntaxType.ForeachStmt,
            SyntaxType.SwitchStmt,
        ]);
        const getFoldingRanges = createFoldingRangesProvider(isInitialized, parseWithCache, SSL_FOLDABLE_TYPES);

        it("produces folding ranges for procedures in a real file", () => {
            const f = loadFixture(TWEAKS_BASE, "source_test/gl_g_scenepid.ssl");

            const ranges = getFoldingRanges(f.text);
            // Should have folding ranges for 3 procedures + foreach loop
            expect(ranges.length).toBeGreaterThanOrEqual(3);
        });

        it("produces folding ranges for a large file with many procedures", () => {
            const f = loadFixture(RP_BASE, "den/dclara.ssl");

            const ranges = getFoldingRanges(f.text);
            // dclara.ssl has 30+ procedures — should have many folding ranges
            expect(ranges.length).toBeGreaterThan(20);
        });

        it("includes block comment folding", () => {
            const f = loadFixture(RP_BASE, "den/dclara.ssl");

            const ranges = getFoldingRanges(f.text);
            // The file starts with a multi-line block comment
            const commentRanges = ranges.filter(r => r.kind === FoldingRangeKind.Comment);
            expect(commentRanges.length).toBeGreaterThanOrEqual(1);
        });
    });
});
