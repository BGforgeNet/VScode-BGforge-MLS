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
