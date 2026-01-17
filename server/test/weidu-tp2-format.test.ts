/**
 * Unit tests for WeiDU TP2 formatter.
 * Tests utility functions and formatting integration.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import type { Node as SyntaxNode } from "web-tree-sitter";
import type { MarkupContent } from "vscode-languageserver/node";

/** Extract markdown value from hover contents. */
function getHoverValue(contents: unknown): string {
    return (contents as MarkupContent).value;
}

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

    it("preserves multi-line JSDoc comments before function definition", () => {
        const input = `/**
 * test123
 * @arg {int} bonus nvli23yr4gbpy324b li2u.hj1bo81264g108y4vb120834612vo4y1jvt189ftvgt1
 */
DEFINE_PATCH_FUNCTION unstack_armor_bonus
  INT_VAR bonus = 0 stacking_id_base = 0
BEGIN
  PATCH_PRINT ~test~
END`;
        const output = format(input);

        // Should preserve the multi-line structure
        expect(output).toContain("/**");
        expect(output).toContain(" * test123");
        expect(output).toContain(" * @arg {int} bonus");
        expect(output).toContain(" */");

        // Should NOT flatten to a single line
        expect(output).not.toContain("/** * test123 * @arg");
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

describe("header-parser: parseHeader", () => {
    // Lazy-load module after parser initialization
    let parseHeader: typeof import("../src/weidu-tp2/header-parser").parseHeader;
    let updateFileIndex: typeof import("../src/weidu-tp2/header-parser").updateFileIndex;
    let lookupFunction: typeof import("../src/weidu-tp2/header-parser").lookupFunction;
    let clearIndex: typeof import("../src/weidu-tp2/header-parser").clearIndex;

    beforeAll(async () => {
        await initParser();
        const mod = await import("../src/weidu-tp2/header-parser");
        parseHeader = mod.parseHeader;
        updateFileIndex = mod.updateFileIndex;
        lookupFunction = mod.lookupFunction;
        clearIndex = mod.clearIndex;
    });

    it("extracts function definitions", () => {
        const code = `DEFINE_ACTION_FUNCTION my_function BEGIN END`;
        const functions = parseHeader(code, "file:///test.tph");
        expect(functions).toHaveLength(1);
        expect(functions[0].name).toBe("my_function");
        expect(functions[0].context).toBe("action");
        expect(functions[0].dtype).toBe("function");
    });

    it("extracts macro definitions", () => {
        const code = `DEFINE_PATCH_MACRO my_macro BEGIN END`;
        const functions = parseHeader(code, "file:///test.tph");
        expect(functions).toHaveLength(1);
        expect(functions[0].name).toBe("my_macro");
        expect(functions[0].context).toBe("patch");
        expect(functions[0].dtype).toBe("macro");
    });

    it("extracts function parameters", () => {
        const code = `DEFINE_ACTION_FUNCTION test_func
INT_VAR
    foo = 1
    bar = 2
STR_VAR
    name = ~~
RET
    result
BEGIN
END`;
        const functions = parseHeader(code, "file:///test.tph");
        expect(functions).toHaveLength(1);
        const params = functions[0].params;
        expect(params).toBeDefined();
        expect(params?.intVar).toHaveLength(2);
        expect(params?.strVar).toHaveLength(1);
        expect(params?.ret).toHaveLength(1);
    });

    it("extracts JSDoc comments", () => {
        const code = `/**
 * This is a test function.
 * @param {int} foo - A parameter
 */
DEFINE_ACTION_FUNCTION documented_func BEGIN END`;
        const functions = parseHeader(code, "file:///test.tph");
        expect(functions).toHaveLength(1);
        expect(functions[0].jsdoc).toBeDefined();
        expect(functions[0].jsdoc?.desc).toContain("test function");
    });

    it("handles multiple functions", () => {
        const code = `
DEFINE_ACTION_FUNCTION func1 BEGIN END
DEFINE_PATCH_FUNCTION func2 BEGIN END
DEFINE_ACTION_MACRO macro1 BEGIN END
`;
        const functions = parseHeader(code, "file:///test.tph");
        expect(functions).toHaveLength(3);
        expect(functions.map(f => f.name)).toEqual(["func1", "func2", "macro1"]);
    });

    it("function index lookup works", () => {
        clearIndex();
        const code = `DEFINE_ACTION_FUNCTION indexed_func BEGIN END`;
        updateFileIndex("file:///indexed.tph", code);

        const func = lookupFunction("indexed_func");
        expect(func).toBeDefined();
        expect(func?.name).toBe("indexed_func");
        expect(func?.location.uri).toBe("file:///indexed.tph");
    });
});

describe("definition: getDefinition", () => {
    // Lazy-load modules after parser initialization
    let getDefinition: typeof import("../src/weidu-tp2/definition").getDefinition;
    let clearIndex: typeof import("../src/weidu-tp2/header-parser").clearIndex;
    let updateFileIndex: typeof import("../src/weidu-tp2/header-parser").updateFileIndex;

    beforeAll(async () => {
        await initParser();
        const defMod = await import("../src/weidu-tp2/definition");
        const headerMod = await import("../src/weidu-tp2/header-parser");
        getDefinition = defMod.getDefinition;
        clearIndex = headerMod.clearIndex;
        updateFileIndex = headerMod.updateFileIndex;
    });

    it("finds same-file function definition", () => {
        const code = `
DEFINE_ACTION_FUNCTION my_func BEGIN END

BEGIN @1
    LAF my_func END
`;
        // Position on "my_func" in the LAF call (line 4, roughly character 8)
        const result = getDefinition(code, "file:///test.tp2", { line: 4, character: 8 });
        expect(result).toBeDefined();
        expect(result?.uri).toBe("file:///test.tp2");
        expect(result?.range.start.line).toBe(1); // Definition is on line 1
    });

    it("finds cross-file function definition", () => {
        clearIndex();
        // Index a header file
        const headerCode = `DEFINE_ACTION_FUNCTION header_func BEGIN END`;
        updateFileIndex("file:///header.tph", headerCode);

        // Main file calls the function
        const mainCode = `
BEGIN @1
    LAF header_func END
`;
        const result = getDefinition(mainCode, "file:///main.tp2", { line: 2, character: 8 });
        expect(result).toBeDefined();
        expect(result?.uri).toBe("file:///header.tph");
    });

    it("returns null for unknown function", () => {
        clearIndex();
        const code = `
BEGIN @1
    LAF unknown_func END
`;
        const result = getDefinition(code, "file:///test.tp2", { line: 2, character: 8 });
        expect(result).toBeNull();
    });
});

describe("hover formatting: loadFileData", () => {
    let loadFileData: typeof import("../src/weidu").loadFileData;

    beforeAll(async () => {
        await initParser();
        const mod = await import("../src/weidu");
        loadFileData = mod.loadFileData;
    });

    it("generates hover with function signature", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "lib/test.tph");
        const hover = result.hover.get("my_func");
        expect(hover).toBeDefined();
        expect(getHoverValue(hover?.contents)).toContain("action function my_func");
    });

    it("generates hover with file path", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "lib/test.tph");
        const hover = result.hover.get("my_func");
        expect(getHoverValue(hover?.contents)).toContain("lib/test.tph");
    });

    it("generates hover with JSDoc description", () => {
        const code = `/**
 * Does something useful.
 */
DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        expect(getHoverValue(hover?.contents)).toContain("Does something useful.");
    });

    it("generates hover with INT_VAR parameters", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func
INT_VAR count = 0
BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        const value = getHoverValue(hover?.contents);
        expect(value).toContain("INT vars");
        expect(value).toContain("count");
        expect(value).toContain("0");
    });

    it("generates hover with STR_VAR parameters", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func
STR_VAR name = ~~
BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        const value = getHoverValue(hover?.contents);
        expect(value).toContain("STR vars");
        expect(value).toContain("name");
    });

    it("generates hover with RET parameters", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func
RET result
BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        const value = getHoverValue(hover?.contents);
        expect(value).toContain("RET vars");
        expect(value).toContain("result");
    });

    it("generates hover with type links for known types", () => {
        const code = `/**
 * @param {int} count
 */
DEFINE_ACTION_FUNCTION my_func
INT_VAR count = 0
BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        expect(getHoverValue(hover?.contents)).toContain("[int](https://ielib.bgforge.net/types/#int)");
    });

    it("generates hover with default type int for INT_VAR", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func
INT_VAR count = 0
BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        // Default type is int, which should be linked
        expect(getHoverValue(hover?.contents)).toContain("[int]");
    });

    it("generates hover with default type string for STR_VAR", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func
STR_VAR name = ~~
BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        // Default type is string, which should be linked
        expect(getHoverValue(hover?.contents)).toContain("[string]");
    });

    it("generates hover with @return type", () => {
        const code = `/**
 * @return {int}
 */
DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        expect(getHoverValue(hover?.contents)).toContain("Returns `int`");
    });

    it("generates hover with @deprecated notice", () => {
        const code = `/**
 * @deprecated Use new_func instead
 */
DEFINE_ACTION_FUNCTION old_func BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("old_func");
        const value = getHoverValue(hover?.contents);
        expect(value).toContain("Deprecated");
        expect(value).toContain("Use new_func instead");
    });

    it("truncates long descriptions to 80 chars", () => {
        const longDesc = "A".repeat(100);
        const code = `/**
 * @param {int} count - ${longDesc}
 */
DEFINE_ACTION_FUNCTION my_func
INT_VAR count = 0
BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const hover = result.hover.get("my_func");
        const value = getHoverValue(hover?.contents);
        // Should be truncated with ...
        expect(value).toContain("...");
        // Should not contain the full 100 chars
        expect(value).not.toContain(longDesc);
    });

    it("generates completion item", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        expect(result.completion).toHaveLength(1);
        expect(result.completion[0].label).toBe("my_func");
    });

    it("generates definition location", () => {
        const code = `DEFINE_ACTION_FUNCTION my_func BEGIN END`;
        const result = loadFileData("file:///test.tph", code, "test.tph");
        const def = result.definition.get("my_func");
        expect(def).toBeDefined();
        expect(def?.uri).toBe("file:///test.tph");
    });
});
