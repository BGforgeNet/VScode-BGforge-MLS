/**
 * Tests for dump module: round-trip YAML updates for completion and highlight files.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import { dumpFalloutCompletion, dumpFalloutHighlight } from "../src/fallout/dump.js";
import type { DefineKind, FalloutCompletionItem, HighlightPattern } from "../src/fallout/types.js";

const TMP_BASE = "tmp";
beforeAll(() => fs.mkdirSync(TMP_BASE, { recursive: true }));

describe("dumpFalloutCompletion", () => {
    let tmpDir: string;
    let filePath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(TMP_BASE, ".fallout-test-"));
        filePath = path.join(tmpDir, "sfall.yml");
        // Create initial YAML with existing stanzas
        const initial = `sfall_functions:
  type: 3
  items: []
hooks:
  type: 21
  items: []
other-stanza:
  preserved: true
`;
        fs.writeFileSync(filePath, initial, "utf8");
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("writes function completion items", () => {
        const functions: FalloutCompletionItem[] = [
            { name: "my_func", detail: "void my_func()", doc: "A function." },
        ];
        const hooks: FalloutCompletionItem[] = [];

        dumpFalloutCompletion(filePath, functions, hooks);

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const stanza = result["sfall_functions"] as { type: number; items: Array<{ name: string }> };
        expect(stanza.type).toBe(3);
        expect(stanza.items).toHaveLength(1);
        expect(stanza.items[0]!.name).toBe("my_func");
    });

    it("writes hook completion items", () => {
        const functions: FalloutCompletionItem[] = [];
        const hooks: FalloutCompletionItem[] = [
            { name: "HOOK_TEST", doc: "A test hook." },
        ];

        dumpFalloutCompletion(filePath, functions, hooks);

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const stanza = result["hooks"] as { type: number; items: Array<{ name: string }> };
        expect(stanza.type).toBe(21);
        expect(stanza.items).toHaveLength(1);
        expect(stanza.items[0]!.name).toBe("HOOK_TEST");
    });

    it("preserves other stanzas", () => {
        dumpFalloutCompletion(filePath, [], []);

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const other = result["other-stanza"] as { preserved: boolean };
        expect(other.preserved).toBe(true);
    });

    it("uses block scalar for multiline doc", () => {
        const functions: FalloutCompletionItem[] = [
            { name: "func", detail: "void func()", doc: "Line 1\nLine 2" },
        ];
        dumpFalloutCompletion(filePath, functions, []);

        const content = fs.readFileSync(filePath, "utf8");
        // Block scalar starts with |- or |
        expect(content).toMatch(/doc: [|]/);
    });
});

describe("dumpFalloutHighlight", () => {
    let tmpDir: string;
    let filePath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(TMP_BASE, ".fallout-test-"));
        filePath = path.join(tmpDir, "highlight.yml");
        const initial = `scopeName: source.fallout-ssl
repository:
  sfall_functions:
    name: support.function.fallout-ssl.sfall
    patterns: []
  hooks:
    name: constant.language.fallout-ssl
    patterns: []
  header-constants:
    name: constant.language.fallout-ssl.macro-constant
    patterns: []
  header-variables:
    name: constant.language.fallout-ssl.macro-var
    patterns: []
  header-procedures:
    name: entity.name.function.fallout-ssl.header-functions
    patterns: []
  header-defines-with-vars:
    name: entity.name.function.fallout-ssl.header-defines
    patterns: []
  header-aliases:
    name: constant.language.fallout-ssl.macro-alias
    patterns: []
  other-stanza:
    name: other
`;
        fs.writeFileSync(filePath, initial, "utf8");
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("updates sfall_functions patterns", () => {
        const sfallPatterns: HighlightPattern[] = [
            { match: "\\b(?i)(my_func)\\b" },
        ];
        dumpFalloutHighlight(filePath, sfallPatterns, [], new Map());

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { patterns: Array<{ match: string }> }>;
        expect(repo["sfall_functions"]!.patterns).toHaveLength(1);
        expect(repo["sfall_functions"]!.patterns[0]!.match).toBe("\\b(?i)(my_func)\\b");
    });

    it("updates hook patterns", () => {
        const hookPatterns: HighlightPattern[] = [
            { match: "\\b(HOOK_TEST)\\b" },
        ];
        dumpFalloutHighlight(filePath, [], hookPatterns, new Map());

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { patterns: Array<{ match: string }> }>;
        expect(repo["hooks"]!.patterns).toHaveLength(1);
        expect(repo["hooks"]!.patterns[0]!.match).toBe("\\b(HOOK_TEST)\\b");
    });

    it("partitions header defines into correct stanzas", () => {
        const headerDefines = new Map<string, DefineKind>([
            ["my_const", "constant"],
            ["GVAR_QUEST", "variable"],
            ["do_stuff", "procedure"],
            ["my_macro", "define_with_vars"],
            ["my_alias", "alias"],
        ]);
        dumpFalloutHighlight(filePath, [], [], headerDefines);

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { patterns: Array<{ match: string }> }>;

        expect(repo["header-constants"]!.patterns).toHaveLength(1);
        expect(repo["header-constants"]!.patterns[0]!.match).toBe("\\b(my_const)\\b");

        expect(repo["header-variables"]!.patterns).toHaveLength(1);
        expect(repo["header-variables"]!.patterns[0]!.match).toBe("\\b(GVAR_QUEST)\\b");

        expect(repo["header-procedures"]!.patterns).toHaveLength(1);
        expect(repo["header-procedures"]!.patterns[0]!.match).toBe("\\b(do_stuff)\\b");

        expect(repo["header-defines-with-vars"]!.patterns).toHaveLength(1);
        expect(repo["header-defines-with-vars"]!.patterns[0]!.match).toBe("\\b(my_macro)\\b");

        expect(repo["header-aliases"]!.patterns).toHaveLength(1);
        expect(repo["header-aliases"]!.patterns[0]!.match).toBe("\\b(my_alias)\\b");
    });

    it("preserves other repository stanzas", () => {
        dumpFalloutHighlight(filePath, [], [], new Map());

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { name: string }>;
        expect(repo["other-stanza"]!.name).toBe("other");
    });

    it("preserves stanza names (scope names)", () => {
        dumpFalloutHighlight(filePath, [], [], new Map());

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { name: string }>;
        expect(repo["sfall_functions"]!.name).toBe("support.function.fallout-ssl.sfall");
        expect(repo["hooks"]!.name).toBe("constant.language.fallout-ssl");
    });
});
