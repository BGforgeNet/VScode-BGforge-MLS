/**
 * Tests for generate-data module: completion, hover, and signature generation
 * from YAML data files.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
    generateCompletion,
    generateHover,
    generateSignatures,
    getDetail,
    getDoc,
    loadData,
} from "../src/generate-data.js";

const TMP_BASE = "tmp";
beforeAll(() => fs.mkdirSync(TMP_BASE, { recursive: true }));

describe("getDetail", () => {
    it("returns typed signature for item with args", () => {
        const item = {
            name: "my_func",
            type: "int",
            args: [
                { name: "a", type: "int", doc: "first" },
                { name: "b", type: "ObjectPtr", doc: "second" },
            ],
        };
        expect(getDetail(item)).toBe("int my_func(int a, ObjectPtr b)");
    });

    it("returns untyped signature when includeTypes is false", () => {
        const item = {
            name: "my_func",
            type: "int",
            args: [{ name: "a", type: "int", doc: "first" }],
        };
        expect(getDetail(item, false)).toBe("my_func(a)");
    });

    it("returns detail field when no args", () => {
        const item = { name: "my_func", detail: "void my_func()" };
        expect(getDetail(item)).toBe("void my_func()");
    });

    it("returns name when no args and no detail", () => {
        const item = { name: "my_keyword" };
        expect(getDetail(item)).toBe("my_keyword");
    });
});

describe("getDoc", () => {
    it("returns empty string for item with no args or doc", () => {
        expect(getDoc({ name: "x" })).toBe("");
    });

    it("returns arg list for item with args only", () => {
        const item = {
            name: "f",
            args: [{ name: "a", type: "int", doc: "the value" }],
        };
        expect(getDoc(item)).toBe("- `a` the value\n");
    });

    it("returns doc for item with doc only", () => {
        const item = { name: "f", doc: "Some docs." };
        expect(getDoc(item)).toBe("Some docs.");
    });

    it("returns args + separator + doc for item with both", () => {
        const item = {
            name: "f",
            doc: "Function docs.",
            args: [{ name: "a", type: "int", doc: "value" }],
        };
        const result = getDoc(item);
        expect(result).toBe("- `a` value\n\nFunction docs.");
    });
});

describe("loadData", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(TMP_BASE, ".gen-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("loads a single YAML file", () => {
        const yaml = `stanza1:\n  type: 3\n  items:\n    - name: func1\n`;
        fs.writeFileSync(path.join(tmpDir, "a.yml"), yaml, "utf8");
        const data = loadData([path.join(tmpDir, "a.yml")]);
        expect(data["stanza1"]).toBeDefined();
        expect(data["stanza1"]!.items).toHaveLength(1);
    });

    it("merges multiple YAML files (last-writer-wins)", () => {
        const y1 = `s1:\n  type: 1\n  items:\n    - name: a\n`;
        const y2 = `s1:\n  type: 2\n  items:\n    - name: b\ns2:\n  type: 3\n  items:\n    - name: c\n`;
        fs.writeFileSync(path.join(tmpDir, "a.yml"), y1, "utf8");
        fs.writeFileSync(path.join(tmpDir, "b.yml"), y2, "utf8");
        const data = loadData([path.join(tmpDir, "a.yml"), path.join(tmpDir, "b.yml")]);
        // s1 overwritten by b.yml
        expect(data["s1"]!.type).toBe(2);
        // s2 from b.yml
        expect(data["s2"]).toBeDefined();
    });
});

describe("generateCompletion", () => {
    it("generates basic completion items", () => {
        const data = {
            keywords: { type: 14, items: [{ name: "begin" }] },
        };
        const result = generateCompletion(data, "test-lang");
        expect(result).toHaveLength(1);
        expect(result[0]!.label).toBe("begin");
        expect(result[0]!.kind).toBe(14);
        expect(result[0]!.source).toBe("builtin");
        expect(result[0]!.category).toBe("keywords");
    });

    it("includes documentation when detail differs from name", () => {
        const data = {
            funcs: { type: 3, items: [{ name: "foo", detail: "void foo()" }] },
        };
        const result = generateCompletion(data, "test-lang");
        expect(result[0]!.documentation).toBeDefined();
        expect(result[0]!.documentation!.kind).toBe("markdown");
        expect(result[0]!.documentation!.value).toContain("void foo()");
    });

    it("skips documentation when label equals detail and no doc", () => {
        const data = {
            kw: { type: 14, items: [{ name: "begin" }] },
        };
        const result = generateCompletion(data, "test-lang");
        expect(result[0]!.documentation).toBeUndefined();
    });

    it("includes documentation when doc is present even if detail equals name", () => {
        const data = {
            kw: { type: 14, items: [{ name: "begin", doc: "Start a block." }] },
        };
        const result = generateCompletion(data, "test-lang");
        expect(result[0]!.documentation).toBeDefined();
        expect(result[0]!.documentation!.value).toContain("Start a block.");
    });

    it("adds deprecated tag", () => {
        const data = {
            old: { type: 3, items: [{ name: "old_func", deprecated: true }] },
        };
        const result = generateCompletion(data, "test-lang");
        expect(result[0]!.tags).toEqual([1]);
    });

    it("does not add tags when not deprecated", () => {
        const data = {
            kw: { type: 14, items: [{ name: "x" }] },
        };
        const result = generateCompletion(data, "test-lang");
        expect(result[0]!.tags).toBeUndefined();
    });

    it("generates documentation for items with args", () => {
        const data = {
            funcs: {
                type: 3,
                items: [{
                    name: "f",
                    type: "int",
                    args: [{ name: "a", type: "int", doc: "val" }],
                }],
            },
        };
        const result = generateCompletion(data, "lang");
        expect(result[0]!.documentation!.value).toContain("int f(int a)");
        expect(result[0]!.documentation!.value).toContain("`a` val");
    });
});

describe("generateHover", () => {
    it("generates hover for items with detail", () => {
        const data = {
            funcs: { type: 3, items: [{ name: "foo", detail: "void foo()" }] },
        };
        const result = generateHover(data, "lang");
        expect(result["foo"]).toBeDefined();
        expect(result["foo"]!.contents.value).toContain("void foo()");
    });

    it("skips items with only a name", () => {
        const data = {
            kw: { type: 14, items: [{ name: "begin" }] },
        };
        const result = generateHover(data, "lang");
        expect(result["begin"]).toBeUndefined();
    });

    it("includes doc in hover", () => {
        const data = {
            funcs: { type: 3, items: [{ name: "foo", doc: "Does stuff." }] },
        };
        const result = generateHover(data, "lang");
        expect(result["foo"]!.contents.value).toContain("Does stuff.");
    });

    it("generates hover for items with args", () => {
        const data = {
            funcs: {
                type: 3,
                items: [{
                    name: "f",
                    type: "int",
                    args: [{ name: "x", type: "int", doc: "val" }],
                    doc: "A function.",
                }],
            },
        };
        const result = generateHover(data, "lang");
        expect(result["f"]!.contents.value).toContain("int f(int x)");
    });
});

// -- WeiDU-format tests --

describe("getDetail (WeiDU)", () => {
    it("returns 'type function NAME' for WeiDU item with args", () => {
        const item = {
            name: "SUBSTRING",
            type: "dimorphic",
            args: [{ name: "start", type: "int" }],
        };
        expect(getDetail(item)).toBe("dimorphic function SUBSTRING");
    });

    it("returns 'patch function NAME' for patch type", () => {
        const item = {
            name: "MY_FUNC",
            type: "patch",
            args: [{ name: "x", type: "int" }],
        };
        expect(getDetail(item)).toBe("patch function MY_FUNC");
    });

    it("returns just name when includeTypes is false", () => {
        const item = {
            name: "SUBSTRING",
            type: "dimorphic",
            args: [{ name: "start", type: "int" }],
        };
        expect(getDetail(item, false)).toBe("SUBSTRING");
    });

    it("returns name for WeiDU item with rets only (no item.type)", () => {
        const item = {
            name: "GET_INDEX",
            rets: [{ name: "index", type: "int" }],
        };
        expect(getDetail(item)).toBe("GET_INDEX");
    });
});

describe("getDoc (WeiDU)", () => {
    it("generates INT vars table for int-category args", () => {
        const item = {
            name: "F",
            type: "dimorphic",
            doc: "A function.",
            args: [
                { name: "start", type: "int", doc: "start index" },
                { name: "length", type: "int", doc: "how many chars" },
            ],
        };
        const result = getDoc(item);
        expect(result).toContain("**INT vars**");
        // Type links must NOT be wrapped in backticks — backticks create code spans
        // that render markdown link syntax as literal text in VSCode completion popups.
        expect(result).toContain("[int](https://ielib.bgforge.net/types/#int)|start|");
        expect(result).not.toContain("`[int]");
        expect(result).toContain("&nbsp;&nbsp;start index");
        expect(result).toContain("[int](https://ielib.bgforge.net/types/#int)|length|");
        expect(result).not.toContain("**STR vars**");
    });

    it("generates STR vars table for str-category args", () => {
        const item = {
            name: "F",
            type: "patch",
            args: [
                { name: "file", type: "resref", doc: "resource reference" },
                { name: "text", type: "string", doc: "text value" },
            ],
        };
        const result = getDoc(item);
        expect(result).toContain("**STR vars**");
        expect(result).toContain("[resref](https://ielib.bgforge.net/types/#resref)|file|");
        expect(result).toContain("[string](https://ielib.bgforge.net/types/#string)|text|");
        expect(result).not.toContain("`[resref]");
        expect(result).not.toContain("**INT vars**");
    });

    it("generates both INT and STR sections for mixed args", () => {
        const item = {
            name: "SUBSTRING",
            type: "dimorphic",
            doc: "Returns a substring.",
            args: [
                { name: "start", type: "int", doc: "offset" },
                { name: "text", type: "string", doc: "source string" },
            ],
        };
        const result = getDoc(item);
        expect(result).toContain("**INT vars**");
        expect(result).toContain("**STR vars**");
    });

    it("generates RET vars table from rets", () => {
        const item = {
            name: "F",
            type: "patch",
            rets: [
                { name: "result", type: "int", doc: "the result" },
            ],
        };
        const result = getDoc(item);
        expect(result).toContain("**RET vars**");
        expect(result).toContain("[int](https://ielib.bgforge.net/types/#int)|result|");
        expect(result).not.toContain("`[int]");
        expect(result).toContain("&nbsp;&nbsp;the result");
    });

    it("generates doc with rets only (no args)", () => {
        const item = {
            name: "GET_AC",
            rets: [{ name: "base_ac", type: "int", doc: "base AC" }],
        };
        const result = getDoc(item);
        expect(result).toContain("**RET vars**");
        expect(result).not.toContain("**INT vars**");
        expect(result).not.toContain("**STR vars**");
    });

    it("shows required marker for required args", () => {
        const item = {
            name: "F",
            type: "patch",
            args: [
                { name: "index", type: "int", doc: "structure index", required: true },
            ],
        };
        const result = getDoc(item);
        expect(result).toContain("|_required_|");
    });

    it("shows default value for args with defaults", () => {
        const item = {
            name: "F",
            type: "dimorphic",
            args: [
                { name: "count", type: "int", doc: "how many", default: "1" },
            ],
        };
        const result = getDoc(item);
        expect(result).toContain("|=&nbsp;1|");
    });

    it("includes doc description before tables", () => {
        const item = {
            name: "F",
            type: "dimorphic",
            doc: "My description.",
            args: [{ name: "x", type: "int" }],
        };
        const result = getDoc(item);
        expect(result).toContain("My description.");
        // Description comes before tables
        const descIdx = result.indexOf("My description.");
        const tableIdx = result.indexOf("**INT vars**");
        expect(descIdx).toBeLessThan(tableIdx);
    });

    it("handles args with no doc", () => {
        const item = {
            name: "F",
            type: "patch",
            args: [{ name: "x", type: "int" }],
        };
        const result = getDoc(item);
        // No &nbsp; description, just empty
        expect(result).toContain("|x||");
    });

    it("generates full mixed args + rets output", () => {
        const item = {
            name: "SUBSTRING",
            type: "dimorphic",
            doc: "Returns a substring.",
            args: [
                { name: "start", type: "int", doc: "start index" },
                { name: "length", type: "int", doc: "length to read" },
                { name: "string", type: "string", doc: "source string" },
            ],
            rets: [
                { name: "substring", type: "string", doc: "the result" },
            ],
        };
        const result = getDoc(item);
        expect(result).toContain("**INT vars**");
        expect(result).toContain("**STR vars**");
        expect(result).toContain("**RET vars**");
        expect(result).toContain("Returns a substring.");
    });
});

describe("generateCompletion (WeiDU)", () => {
    it("generates documentation for WeiDU items with args", () => {
        const data = {
            dimorphicFunctions: {
                type: 3,
                items: [{
                    name: "SUBSTRING",
                    type: "dimorphic",
                    doc: "Returns a substring.",
                    args: [
                        { name: "start", type: "int", doc: "offset" },
                        { name: "text", type: "string", doc: "source" },
                    ],
                }],
            },
        };
        const result = generateCompletion(data, "weidu-tp2-tooltip");
        expect(result[0]!.documentation).toBeDefined();
        expect(result[0]!.documentation!.value).toContain("dimorphic function SUBSTRING");
        expect(result[0]!.documentation!.value).toContain("**INT vars**");
    });
});

describe("generateHover (WeiDU)", () => {
    it("generates hover with WeiDU tables", () => {
        const data = {
            dimorphicFunctions: {
                type: 3,
                items: [{
                    name: "SUBSTRING",
                    type: "dimorphic",
                    doc: "Returns a substring.",
                    args: [
                        { name: "start", type: "int", doc: "offset" },
                    ],
                    rets: [
                        { name: "result", type: "string", doc: "the substring" },
                    ],
                }],
            },
        };
        const result = generateHover(data, "weidu-tp2-tooltip");
        expect(result["SUBSTRING"]).toBeDefined();
        const value = result["SUBSTRING"]!.contents.value;
        expect(value).toContain("dimorphic function SUBSTRING");
        expect(value).toContain("**INT vars**");
        expect(value).toContain("**RET vars**");
    });

    it("generates hover for items with only rets", () => {
        const data = {
            patchFunctions: {
                type: 3,
                items: [{
                    name: "GET_AC",
                    rets: [{ name: "base_ac", type: "int", doc: "base AC" }],
                }],
            },
        };
        const result = generateHover(data, "weidu-tp2-tooltip");
        expect(result["GET_AC"]).toBeDefined();
        expect(result["GET_AC"]!.contents.value).toContain("**RET vars**");
    });
});

describe("generateSignatures (WeiDU)", () => {
    it("includes category prefix in WeiDU parameter docs", () => {
        const data = {
            dimorphicFunctions: {
                type: 3,
                items: [{
                    name: "SUBSTRING",
                    type: "dimorphic",
                    doc: "Returns a substring.",
                    args: [
                        { name: "start", type: "int", doc: "offset" },
                        { name: "text", type: "string", doc: "source" },
                    ],
                }],
            },
        };
        const result = generateSignatures(data, "weidu-tp2-tooltip");
        expect(result["SUBSTRING"]).toBeDefined();
        expect(result["SUBSTRING"]!.label).toBe("SUBSTRING");
        // INT_VAR prefix for int arg
        expect(result["SUBSTRING"]!.parameters[0]!.documentation.value).toContain("INT_VAR int start");
        // STR_VAR prefix for string arg
        expect(result["SUBSTRING"]!.parameters[1]!.documentation.value).toContain("STR_VAR string text");
    });
});

describe("generateSignatures", () => {
    it("generates signature for items with args", () => {
        const data = {
            funcs: {
                type: 3,
                items: [{
                    name: "f",
                    type: "int",
                    doc: "A function.",
                    args: [{ name: "x", type: "int", doc: "the value" }],
                }],
            },
        };
        const result = generateSignatures(data, "lang");
        expect(result["f"]).toBeDefined();
        expect(result["f"]!.label).toBe("f(x)");
        expect(result["f"]!.parameters).toHaveLength(1);
        expect(result["f"]!.parameters[0]!.label).toBe("x");
        expect(result["f"]!.parameters[0]!.documentation.value).toContain("int x");
        expect(result["f"]!.documentation.value).toContain("A function.");
    });

    it("skips items without args", () => {
        const data = {
            kw: { type: 14, items: [{ name: "begin" }] },
        };
        const result = generateSignatures(data, "lang");
        expect(Object.keys(result)).toHaveLength(0);
    });
});
