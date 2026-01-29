/**
 * Tests for sfall-data module: loading functions.yml and hooks.yml,
 * building completion items and highlight patterns.
 * Shared litscal tests are in utils/test/yaml-helpers.test.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadSfallFunctions, loadSfallHooks } from "../src/fallout/sfall-data.js";

const TMP_BASE = "tmp";
beforeAll(() => fs.mkdirSync(TMP_BASE, { recursive: true }));

describe("loadSfallFunctions", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(TMP_BASE, ".fallout-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("loads and sorts categories and functions", () => {
        const yaml = `
- name: "Category B"
  items:
    - name: func_b
      detail: "void func_b()"
    - name: func_a
      detail: "int func_a()"
- name: "Category A"
  items:
    - name: func_c
      detail: "void func_c()"
`;
        fs.writeFileSync(path.join(tmpDir, "functions.yml"), yaml, "utf8");
        const result = loadSfallFunctions(tmpDir);

        // Categories sorted: A before B; functions sorted within each category
        expect(result.completionItems[0]!.name).toBe("func_c");
        expect(result.completionItems[1]!.name).toBe("func_a");
        expect(result.completionItems[2]!.name).toBe("func_b");
    });

    it("merges category doc into function doc", () => {
        const yaml = `
- name: "Category"
  doc: "Category docs"
  items:
    - name: func_no_doc
      detail: "void func_no_doc()"
    - name: func_with_doc
      detail: "void func_with_doc()"
      doc: "Function docs"
`;
        fs.writeFileSync(path.join(tmpDir, "functions.yml"), yaml, "utf8");
        const result = loadSfallFunctions(tmpDir);

        const noDoc = result.completionItems.find((i) => i.name === "func_no_doc");
        expect(noDoc?.doc).toBe("Category docs");

        const withDoc = result.completionItems.find((i) => i.name === "func_with_doc");
        expect(withDoc?.doc).toBe("Function docs\nCategory docs");
    });

    it("generates case-insensitive highlight patterns for functions", () => {
        const yaml = `
- name: "Cat"
  items:
    - name: my_func
      detail: "void my_func()"
`;
        fs.writeFileSync(path.join(tmpDir, "functions.yml"), yaml, "utf8");
        const result = loadSfallFunctions(tmpDir);

        expect(result.highlightPatterns).toHaveLength(1);
        expect(result.highlightPatterns[0]!.match).toBe("\\b(?i)(my_func)\\b");
    });

    it("skips exponentiation operator from highlight", () => {
        const yaml = `
- name: "Math"
  items:
    - name: "^"
      detail: "int exponentiation"
    - name: sqrt
      detail: "float sqrt(float)"
`;
        fs.writeFileSync(path.join(tmpDir, "functions.yml"), yaml, "utf8");
        const result = loadSfallFunctions(tmpDir);

        expect(result.highlightPatterns).toHaveLength(1);
        expect(result.highlightPatterns[0]!.match).toContain("sqrt");
        // But ^ should still be in completion items
        expect(result.completionItems.find((i) => i.name === "^")).toBeDefined();
    });

    it("preserves args and type when present", () => {
        const yaml = `
- name: "Cat"
  items:
    - name: typed_func
      detail: "int typed_func(int x)"
      type: "int"
      args:
        - name: x
          type: int
          doc: "the value"
`;
        fs.writeFileSync(path.join(tmpDir, "functions.yml"), yaml, "utf8");
        const result = loadSfallFunctions(tmpDir);

        const item = result.completionItems[0]!;
        expect(item.args).toHaveLength(1);
        expect(item.type).toBe("int");
    });

    it("throws when functions.yml not found", () => {
        expect(() => loadSfallFunctions(tmpDir)).toThrow("functions.yml not found");
    });
});

describe("loadSfallHooks", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(TMP_BASE, ".fallout-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("loads hooks and generates HOOK_ prefix", () => {
        const yaml = `
- name: AdjustFid
  doc: "Runs after calculating character figure FID."
- name: AdjustPoison
  doc: "Runs when poison level changes."
`;
        fs.writeFileSync(path.join(tmpDir, "hooks.yml"), yaml, "utf8");
        const result = loadSfallHooks(tmpDir);

        expect(result.completionItems).toHaveLength(2);
        expect(result.completionItems[0]!.name).toBe("HOOK_ADJUSTFID");
        expect(result.completionItems[1]!.name).toBe("HOOK_ADJUSTPOISON");
    });

    it("sorts hooks alphabetically by name", () => {
        const yaml = `
- name: Zebra
  doc: "Z hook"
- name: Alpha
  doc: "A hook"
`;
        fs.writeFileSync(path.join(tmpDir, "hooks.yml"), yaml, "utf8");
        const result = loadSfallHooks(tmpDir);

        expect(result.completionItems[0]!.name).toBe("HOOK_ALPHA");
        expect(result.completionItems[1]!.name).toBe("HOOK_ZEBRA");
    });

    it("generates highlight patterns without case-insensitive flag", () => {
        const yaml = `
- name: TestHook
  doc: "A test hook."
`;
        fs.writeFileSync(path.join(tmpDir, "hooks.yml"), yaml, "utf8");
        const result = loadSfallHooks(tmpDir);

        expect(result.highlightPatterns).toHaveLength(1);
        expect(result.highlightPatterns[0]!.match).toBe("\\b(HOOK_TESTHOOK)\\b");
    });

    it("throws when hooks.yml not found", () => {
        expect(() => loadSfallHooks(tmpDir)).toThrow("hooks.yml not found");
    });
});
