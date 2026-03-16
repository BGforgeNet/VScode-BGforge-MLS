/**
 * Unit tests for weidu-d/format/core.ts - D file formatter.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { initParser, getParser } from "../../src/weidu-d/parser";
import { formatDocument } from "../../src/weidu-d/format/core";

beforeAll(async () => {
    await initParser();
});

function format(input: string): string {
    const parser = getParser();
    const tree = parser.parse(input);
    return formatDocument(tree.rootNode).text;
}

describe("weidu-d/format/core", () => {
    describe("EXTEND with position number (#N)", () => {
        it("preserves #N without inserting space", () => {
            const input = `EXTEND_TOP %dlg% %START_STATE% #4\n  + ~~ + @1 + g_item_type\nEND\n`;
            const output = format(input);

            expect(output).toContain("EXTEND_TOP %dlg% %START_STATE% #4");
            expect(output).not.toContain("# 4");
        });

        it("preserves #1 in EXTEND_TOP with IF trigger", () => {
            const input = `EXTEND_TOP finmel01 1 #1 IF ~Global("BalthazarFights","GLOBAL",1)~ THEN REPLY @591 GOTO mel1 END\n`;
            const output = format(input);

            expect(output).toContain("#1");
            expect(output).not.toContain("# 1");
        });

        it("preserves #0 in EXTEND_BOTTOM", () => {
            const input = `EXTEND_BOTTOM dlg 5 #0\n  IF ~~ THEN EXIT\nEND\n`;
            const output = format(input);

            expect(output).toContain("#0");
            expect(output).not.toContain("# 0");
        });
        });

        describe("END indentation", () => {
            it("does not double-indent END in multi-line states", () => {
                const input = `BEGIN ~dlg~\nIF ~~ THEN BEGIN state\n  SAY ~hello~\n  IF ~~ THEN EXIT\nEND\n`;
                const output = format(input);
                const lines = output.split("\n");

                const endLine = lines.find((l) => l.trim() === "END");
                const sayLine = lines.find((l) => l.trimStart().startsWith("SAY"));

                expect(endLine).toBeDefined();
                expect(sayLine).toBeDefined();

                // END should be at the same indentation depth as SAY (both are state body content)
                const endIndent = endLine!.length - endLine!.trimStart().length;
                const sayIndent = sayLine!.length - sayLine!.trimStart().length;
                expect(endIndent).toBe(sayIndent);
            });
        });

        describe("string preservation", () => {
            it("preserves newlines in triggers", () => {
                const input = `BEGIN ~dlg~\nIF ~Global("x",\n"y")~ THEN BEGIN state\n  SAY ~hello~\n  IF ~~ THEN EXIT\nEND\n`;
                const output = format(input);
                expect(output).toContain('~Global("x",\n"y")~');
            });

            it("preserves multiple spaces in strings", () => {
                const input = `BEGIN ~dlg~\nIF ~Global("x",  "y")~ THEN BEGIN state\n  SAY ~hello~\n  IF ~~ THEN EXIT\nEND\n`;
                const output = format(input);
                expect(output).toContain('~Global("x",  "y")~');
            });
        });

        describe("separator preservation before literals", () => {
            it("preserves space before string literal on multiline state header", () => {
                // The trigger string contains a newline, so reindentState is used.
                // Code token "IF " gets trimmed to "IF"; the space before ~ must not be lost.
                const input = `BEGIN ~dlg~\nIF ~Global("x",\n"y")~ THEN BEGIN state\n  SAY ~hello~\n  IF ~~ THEN EXIT\nEND\n`;
                const output = format(input);
                expect(output).toMatch(/IF ~/);
            });

            it("preserves space before string literal in SAY expression", () => {
                const input = `BEGIN ~dlg~\nIF ~~ THEN BEGIN state\n  SAY ~hello\nworld~\n  IF ~~ THEN EXIT\nEND\n`;
                const output = format(input);
                expect(output).toMatch(/SAY ~/);
            });

            it("preserves space before line comment after code", () => {
                const input = `BEGIN ~dlg~\nIF ~~ THEN BEGIN state\n  SAY ~hello~ // a comment\n  IF ~~ THEN EXIT\nEND\n`;
                const output = format(input);
                expect(output).toMatch(/SAY ~hello~\s+\/\/ a comment/);
            });

            it("preserves space before standalone comment after code token", () => {
                // EXIT is code, // comment is a comment token — space between them must be preserved
                const input = `BEGIN ~dlg~\nIF ~~ THEN BEGIN state\n  SAY ~hello~\n  IF ~~ THEN EXIT // done\nEND\n`;
                const output = format(input);
                expect(output).toMatch(/EXIT\s+\/\/ done/);
            });
        });
        });
