/**
 * Unit tests for WeiDU TP2 formatter.
 * Tests utility functions and formatting integration.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import type { Node as SyntaxNode } from "web-tree-sitter";

// Mock the server module to avoid LSP connection issues
vi.mock("../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import {
    normalizeLineComment,
    normalizeBlockComment,
    normalizeComment,
    normalizeWhitespace,
    withNormalizedComment,
    isComment,
    isAction,
    isPatch,
    isControlFlow,
    isCopyAction,
    isFunctionDef,
    isFunctionCall,
    isBodyContent,
} from "../src/weidu-tp2/format-utils";
import { formatDocument } from "../src/weidu-tp2/format-core";
import { initParser, getParser } from "../src/weidu-tp2/parser";

describe("format-utils: normalizeLineComment", () => {
    it("adds space after // if missing", () => {
        expect(normalizeLineComment("//comment")).toBe("// comment");
    });

    it("preserves existing space after //", () => {
        expect(normalizeLineComment("// comment")).toBe("// comment");
    });

    it("preserves multiple spaces after //", () => {
        expect(normalizeLineComment("//  indented")).toBe("//  indented");
    });

    it("handles empty comment", () => {
        expect(normalizeLineComment("//")).toBe("//");
    });

    it("handles tab after //", () => {
        expect(normalizeLineComment("//\tindented")).toBe("//\tindented");
    });

    it("trims leading whitespace", () => {
        expect(normalizeLineComment("  // comment")).toBe("// comment");
    });
});

describe("format-utils: normalizeBlockComment", () => {
    it("trims whitespace", () => {
        expect(normalizeBlockComment("  /* comment */  ")).toBe("/* comment */");
    });

    it("preserves internal formatting", () => {
        expect(normalizeBlockComment("/* line1\n   line2 */")).toBe("/* line1\n   line2 */");
    });
});

describe("format-utils: normalizeComment", () => {
    it("normalizes line comments", () => {
        expect(normalizeComment("//comment")).toBe("// comment");
    });

    it("normalizes block comments", () => {
        expect(normalizeComment("  /* test */  ")).toBe("/* test */");
    });
});

describe("format-utils: normalizeWhitespace", () => {
    it("collapses multiple spaces", () => {
        expect(normalizeWhitespace("hello    world")).toBe("hello world");
    });

    it("preserves line comments", () => {
        expect(normalizeWhitespace("code // comment")).toBe("code // comment");
    });

    it("handles multiline with comments", () => {
        expect(normalizeWhitespace("line1\ncode // comment")).toBe("line1\ncode // comment");
    });

    it("trims lines", () => {
        expect(normalizeWhitespace("  hello  ")).toBe("hello");
    });
});

describe("format-utils: withNormalizedComment", () => {
    it("returns line as-is without comment", () => {
        expect(withNormalizedComment("hello world")).toBe("hello world");
    });

    it("normalizes inline comment spacing", () => {
        expect(withNormalizedComment("code//comment")).toBe("code  // comment");
    });

    it("handles standalone comment", () => {
        expect(withNormalizedComment("  //comment")).toBe("  // comment");
    });

    it("handles empty comment", () => {
        expect(withNormalizedComment("code  //")).toBe("code  //");
    });
});

describe("format-utils: type predicates", () => {
    it("isAction detects action types", () => {
        expect(isAction("action_copy")).toBe(true);
        expect(isAction("action_assignment")).toBe(true);
        expect(isAction("action_fail")).toBe(true);
        expect(isAction("identifier")).toBe(false);
    });

    it("isPatch detects patch types", () => {
        expect(isPatch("patch_write_byte")).toBe(true);
        expect(isPatch("read_var")).toBe(true);
        expect(isPatch("set_var")).toBe(true);
        expect(isPatch("action")).toBe(false);
    });

    it("isControlFlow detects control flow types", () => {
        expect(isControlFlow("action_if")).toBe(true);
        expect(isControlFlow("patch_match")).toBe(true);
        expect(isControlFlow("outer_for")).toBe(true);
        expect(isControlFlow("action_copy")).toBe(false);
    });

    it("isCopyAction detects copy action types", () => {
        expect(isCopyAction("action_copy")).toBe(true);
        expect(isCopyAction("action_copy_existing")).toBe(true);
        // inner_action has its own formatter, not a copy action
        expect(isCopyAction("inner_action")).toBe(false);
        expect(isCopyAction("action_if")).toBe(false);
    });

    it("isFunctionDef detects function definition types", () => {
        expect(isFunctionDef("action_define_function")).toBe(true);
        expect(isFunctionDef("action_define_patch_macro")).toBe(true);
        expect(isFunctionDef("action_launch_function")).toBe(false);
    });

    it("isFunctionCall detects function call types", () => {
        expect(isFunctionCall("action_launch_function")).toBe(true);
        expect(isFunctionCall("patch_launch_macro")).toBe(true);
        expect(isFunctionCall("action_define_function")).toBe(false);
    });

    it("isBodyContent detects valid body content", () => {
        expect(isBodyContent("action_copy")).toBe(true);
        expect(isBodyContent("patch_write_byte")).toBe(true);
        expect(isBodyContent("action_if")).toBe(true);
        expect(isBodyContent("string")).toBe(false);
    });
});

describe("formatDocument integration", () => {
    beforeAll(async () => {
        await initParser();
    });

    function format(code: string): string {
        const parser = getParser();
        const tree = parser.parse(code);
        const result = formatDocument(tree.rootNode);
        return result.text;
    }

    it("formats simple BACKUP directive", () => {
        const input = "BACKUP   ~weidu_external/backup/mymod~";
        const output = format(input);
        expect(output).toBe("BACKUP ~weidu_external/backup/mymod~\n");
    });

    it("formats simple component", () => {
        const input = 'BEGIN @1';
        const output = format(input);
        expect(output).toBe("BEGIN @1\n");
    });

    it("formats component with action", () => {
        const input = `BEGIN @1
COPY ~src~ ~dst~`;
        const output = format(input);
        expect(output).toContain("BEGIN @1");
        expect(output).toContain("    COPY ~src~ ~dst~");
    });

    it("normalizes whitespace in directives", () => {
        const input = "BACKUP     ~path/to/backup~";
        const output = format(input);
        expect(output).toBe("BACKUP ~path/to/backup~\n");
    });

    it("preserves comments", () => {
        const input = `// This is a comment
BEGIN @1`;
        const output = format(input);
        expect(output).toContain("// This is a comment");
        expect(output).toContain("BEGIN @1");
    });

    it("adds space after // in comments", () => {
        const input = `//comment without space
BEGIN @1`;
        const output = format(input);
        expect(output).toContain("// comment without space");
    });

    it("preserves intentional comment indentation", () => {
        const input = `//     indented content
BEGIN @1`;
        const output = format(input);
        expect(output).toContain("//     indented content");
    });

    it("formats ALWAYS block", () => {
        const input = `ALWAYS
OUTER_SET foo = 1
END`;
        const output = format(input);
        expect(output).toContain("ALWAYS");
        expect(output).toContain("    OUTER_SET foo = 1");
        expect(output).toContain("END");
    });

    it("formats ACTION_IF with condition", () => {
        const input = `BEGIN @1
ACTION_IF foo BEGIN
PRINT ~test~
END`;
        const output = format(input);
        expect(output).toContain("ACTION_IF foo BEGIN");
        expect(output).toContain("        PRINT ~test~");
        expect(output).toContain("    END");
    });

    it("formats function definition", () => {
        const input = `DEFINE_ACTION_FUNCTION test
BEGIN
PRINT ~hello~
END`;
        const output = format(input);
        expect(output).toContain("DEFINE_ACTION_FUNCTION test");
        expect(output).toContain("BEGIN");
        expect(output).toContain("    PRINT ~hello~");
        expect(output).toContain("END");
    });

    it("formats function call with INT_VAR", () => {
        const input = `BEGIN @1
LAF test
INT_VAR
foo = 1
bar = 2
END`;
        const output = format(input);
        expect(output).toContain("LAF test");
        expect(output).toContain("INT_VAR");
        expect(output).toMatch(/foo\s+=\s+1/);
        expect(output).toMatch(/bar\s+=\s+2/);
    });

    it("aligns INT_VAR assignments", () => {
        const input = `BEGIN @1
LAF test
INT_VAR
x = 1
longname = 2
END`;
        const output = format(input);
        // Both assignments should have same alignment
        const lines = output.split("\n");
        const xLine = lines.find((l) => l.includes("x "));
        const longnameLine = lines.find((l) => l.includes("longname"));
        if (xLine && longnameLine) {
            const xEqPos = xLine.indexOf("=");
            const longEqPos = longnameLine.indexOf("=");
            expect(xEqPos).toBe(longEqPos);
        }
    });

    it("handles inline comments", () => {
        const input = `BEGIN @1  // component comment`;
        const output = format(input);
        expect(output).toContain("BEGIN @1  // component comment");
    });

    it("preserves inline comments on INT_VAR assignments", () => {
        const input = `BEGIN @1
LAF test
INT_VAR
projectile = 191  // ice scorcher
target = 4  // area
END`;
        const output = format(input);
        // Comments should stay inline with their assignments
        expect(output).toMatch(/projectile\s+=\s+191\s+\/\/ ice scorcher/);
        expect(output).toMatch(/target\s+=\s+4\s+\/\/ area/);
    });

    it("preserves inline comments in nested function calls", () => {
        const input = `BEGIN @1
COPY_EXISTING ~item.itm~ ~override~
  PATCH_IF foo = 0 BEGIN
    LPF ALTER_ITEM
      INT_VAR
        value = 100  // important value
    END
  END`;
        const output = format(input);
        expect(output).toMatch(/value\s+=\s+100\s+\/\/ important value/);
    });
});

describe("formatDocument TRY blocks", () => {
    beforeAll(async () => {
        await initParser();
    });

    function format(code: string): string {
        const parser = getParser();
        const tree = parser.parse(code);
        const result = formatDocument(tree.rootNode);
        return result.text;
    }

    it("formats PATCH_TRY with body", () => {
        const input = `BEGIN @1
COPY_EXISTING ~test.itm~ ~override~
PATCH_TRY
READ_ASCII 0 sig (4)
WITH DEFAULT
PATCH_WARN ~error~
END`;
        const output = format(input);
        expect(output).toContain("PATCH_TRY");
        expect(output).toContain("READ_ASCII 0 sig (4)");
        expect(output).toContain("WITH DEFAULT");
        expect(output).toContain("PATCH_WARN ~error~");
    });

    it("formats PATCH_TRY with INNER_PATCH_FILE", () => {
        const input = `BEGIN @1
COPY_EXISTING ~test.2da~ ~override~
PATCH_TRY
INNER_PATCH_FILE ~item.itm~ BEGIN
READ_STRREF 0 name
END
WITH DEFAULT
PATCH_WARN ~error~
END`;
        const output = format(input);
        expect(output).toContain("PATCH_TRY");
        expect(output).toContain("INNER_PATCH_FILE ~item.itm~ BEGIN");
        expect(output).toContain("READ_STRREF 0 name");
        expect(output).toContain("WITH DEFAULT");
    });

    it("formats ACTION_TRY", () => {
        const input = `BEGIN @1
ACTION_TRY
COPY ~src~ ~dst~
WITH DEFAULT
WARN ~error~
END`;
        const output = format(input);
        expect(output).toContain("ACTION_TRY");
        expect(output).toContain("COPY ~src~ ~dst~");
        expect(output).toContain("WITH DEFAULT");
        expect(output).toContain("WARN ~error~");
    });

    it("preserves comments in PATCH_TRY", () => {
        const input = `BEGIN @1
COPY_EXISTING ~test.itm~ ~override~
PATCH_TRY
// Try to read
READ_ASCII 0 sig (4)
WITH DEFAULT
// Handle error
PATCH_WARN ~error~
END`;
        const output = format(input);
        expect(output).toContain("// Try to read");
        expect(output).toContain("// Handle error");
    });

    it("indents PATCH_TRY body content", () => {
        const input = `BEGIN @1
COPY_EXISTING ~test.itm~ ~override~
PATCH_TRY
READ_ASCII 0 sig (4)
WITH DEFAULT
PATCH_WARN ~error~
END`;
        const output = format(input);
        const lines = output.split("\n");
        const readLine = lines.find((l) => l.includes("READ_ASCII"));
        const warnLine = lines.find((l) => l.includes("PATCH_WARN"));
        // Body content should be indented more than PATCH_TRY
        expect(readLine).toMatch(/^\s{12}READ_ASCII/);
        expect(warnLine).toMatch(/^\s{12}PATCH_WARN/);
    });
});

describe("formatDocument MATCH statements", () => {
    beforeAll(async () => {
        await initParser();
    });

    function format(code: string): string {
        const parser = getParser();
        const tree = parser.parse(code);
        const result = formatDocument(tree.rootNode);
        return result.text;
    }

    it("formats PATCH_MATCH with cases", () => {
        const input = `BEGIN @1
COPY_EXISTING ~test.itm~ ~override~
PATCH_MATCH type
WITH 1 BEGIN
SET foo = 1
END
WITH 2 BEGIN
SET foo = 2
END
DEFAULT
SET foo = 0
END`;
        const output = format(input);
        expect(output).toContain("PATCH_MATCH type");
        expect(output).toContain("WITH");
        expect(output).toContain("1 BEGIN");
        expect(output).toContain("SET foo = 1");
        expect(output).toContain("DEFAULT");
    });

    it("formats ACTION_MATCH", () => {
        const input = `BEGIN @1
ACTION_MATCH %var%
WITH 1 BEGIN
PRINT ~one~
END
DEFAULT
PRINT ~default~
END`;
        const output = format(input);
        expect(output).toContain("ACTION_MATCH %var%");
        expect(output).toContain("WITH");
        expect(output).toContain("1 BEGIN");
        expect(output).toContain("PRINT ~one~");
        expect(output).toContain("DEFAULT");
    });

    it("preserves comments in MATCH cases", () => {
        const input = `BEGIN @1
COPY_EXISTING ~test.itm~ ~override~
PATCH_MATCH type
// First case
WITH 1 BEGIN
SET foo = 1
END
DEFAULT
SET foo = 0
END`;
        const output = format(input);
        expect(output).toContain("// First case");
    });
});

describe("formatDocument error collection", () => {
    beforeAll(async () => {
        await initParser();
    });

    function formatWithErrors(code: string): { text: string; errors: Array<{ message: string; line: number; column: number }> } {
        const parser = getParser();
        const tree = parser.parse(code);
        return formatDocument(tree.rootNode);
    }

    it("returns empty errors for valid code", () => {
        const input = `BACKUP ~backup~
BEGIN @1
    COPY ~src~ ~dst~`;
        const result = formatWithErrors(input);
        expect(result.errors).toEqual([]);
    });

    it("collects errors in result object", () => {
        const input = `BEGIN @1`;
        const result = formatWithErrors(input);
        // Valid simple code should have no errors
        expect(Array.isArray(result.errors)).toBe(true);
    });

    it("error object has correct structure", () => {
        const input = `BEGIN @1`;
        const result = formatWithErrors(input);
        // Verify errors array exists and has correct type
        expect(result).toHaveProperty("text");
        expect(result).toHaveProperty("errors");
        expect(typeof result.text).toBe("string");
        expect(Array.isArray(result.errors)).toBe(true);
    });

    it("formats despite errors", () => {
        // Even with potential issues, formatter should produce output
        const input = `BEGIN @1
COPY ~src~ ~dst~`;
        const result = formatWithErrors(input);
        expect(result.text).toContain("BEGIN @1");
        expect(result.text).toContain("COPY");
    });
});
