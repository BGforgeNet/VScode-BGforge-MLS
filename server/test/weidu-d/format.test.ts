/**
 * Unit tests for weidu-d/format-core.ts - D file formatter.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { initParser, getParser } from "../../src/weidu-d/parser";
import { formatDocument } from "../../src/weidu-d/format-core";

beforeAll(async () => {
    await initParser();
});

function format(input: string): string {
    const parser = getParser();
    const tree = parser.parse(input);
    return formatDocument(tree.rootNode).text;
}

describe("weidu-d/format-core", () => {
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
});
