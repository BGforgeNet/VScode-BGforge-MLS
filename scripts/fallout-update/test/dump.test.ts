/**
 * Tests for dump module: round-trip YAML updates for completion and highlight files.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import { dumpFalloutCompletion, dumpFalloutHighlight } from "../src/fallout/dump.ts";
import {
    HIGHLIGHT_STANZAS,
    SFALL_FUNCTIONS_STANZA,
    SFALL_HOOKS_STANZA,
    type FalloutCompletionItem,
    type HighlightPattern,
} from "../src/fallout/types.ts";

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
        const stanza = result[SFALL_FUNCTIONS_STANZA] as { type: number; items: Array<{ name: string }> };
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
        const stanza = result[SFALL_HOOKS_STANZA] as { type: number; items: Array<{ name: string }> };
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
  fallout-base-functions:
    name: support.function.fallout-ssl.base
    patterns: []
  sfall_functions:
    name: support.function.fallout-ssl.sfall
    patterns: []
  hooks:
    name: constant.language.fallout-ssl
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
        dumpFalloutHighlight(filePath, { sfallFunctionPatterns: sfallPatterns, hookPatterns: [] });

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { patterns: Array<{ match: string }> }>;
        expect(repo[HIGHLIGHT_STANZAS.sfallFunctions]!.patterns).toHaveLength(1);
        expect(repo[HIGHLIGHT_STANZAS.sfallFunctions]!.patterns[0]!.match).toBe("\\b(?i)(my_func)\\b");
    });

    it("updates fallout-base-functions patterns from base data and marks the stanza as generated", () => {
        const basePatterns: HighlightPattern[] = [
            { match: "\\b(?i)(base_a)\\b" },
            { match: "\\b(?i)(base_b)\\b" },
        ];
        dumpFalloutHighlight(filePath, { baseFunctionPatterns: basePatterns, sfallFunctionPatterns: [], hookPatterns: [] });

        const content = fs.readFileSync(filePath, "utf8");
        expect(content).toContain("This stanza is generated from server/data/fallout-ssl-base.yml.");
        expect(content).toContain("Do not edit manually.");

        const result = YAML.parse(content) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { patterns: Array<{ match: string }> }>;
        expect(repo["fallout-base-functions"]!.patterns).toHaveLength(2);
        expect(repo["fallout-base-functions"]!.patterns[0]!.match).toBe("\\b(?i)(base_a)\\b");
        expect(repo["fallout-base-functions"]!.patterns[1]!.match).toBe("\\b(?i)(base_b)\\b");
    });

    it("updates hook patterns", () => {
        const hookPatterns: HighlightPattern[] = [
            { match: "\\b(HOOK_TEST)\\b" },
        ];
        dumpFalloutHighlight(filePath, { baseFunctionPatterns: [], sfallFunctionPatterns: [], hookPatterns });

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { patterns: Array<{ match: string }> }>;
        expect(repo[HIGHLIGHT_STANZAS.hooks]!.patterns).toHaveLength(1);
        expect(repo[HIGHLIGHT_STANZAS.hooks]!.patterns[0]!.match).toBe("\\b(HOOK_TEST)\\b");
    });

    it("preserves other repository stanzas", () => {
        dumpFalloutHighlight(filePath, { baseFunctionPatterns: [], sfallFunctionPatterns: [], hookPatterns: [] });

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { name: string }>;
        expect(repo["other-stanza"]!.name).toBe("other");
    });

    it("preserves stanza names (scope names)", () => {
        dumpFalloutHighlight(filePath, { baseFunctionPatterns: [], sfallFunctionPatterns: [], hookPatterns: [] });

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { name: string }>;
        expect(repo[HIGHLIGHT_STANZAS.sfallFunctions]!.name).toBe("support.function.fallout-ssl.sfall");
        expect(repo[HIGHLIGHT_STANZAS.hooks]!.name).toBe("constant.language.fallout-ssl");
    });

    it("leaves untouched stanzas unchanged when their pattern sets are omitted", () => {
        const initial = `scopeName: source.fallout-ssl
repository:
  fallout-base-functions:
    name: support.function.fallout-ssl.base
    patterns:
      - match: \\b(?i)(legacy_base)\\b
  sfall_functions:
    name: support.function.fallout-ssl.sfall
    patterns:
      - match: \\b(?i)(legacy_sfall)\\b
  hooks:
    name: constant.language.fallout-ssl
    patterns:
      - match: \\b(HOOK_LEGACY)\\b
`;
        fs.writeFileSync(filePath, initial, "utf8");

        dumpFalloutHighlight(filePath, { sfallFunctionPatterns: [{ match: "\\b(?i)(new_sfall)\\b" }] });

        const result = YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const repo = result["repository"] as Record<string, { patterns: Array<{ match: string }> }>;
        expect(repo["fallout-base-functions"]!.patterns[0]!.match).toBe("\\b(?i)(legacy_base)\\b");
        expect(repo["sfall_functions"]!.patterns[0]!.match).toBe("\\b(?i)(new_sfall)\\b");
        expect(repo["hooks"]!.patterns[0]!.match).toBe("\\b(HOOK_LEGACY)\\b");
    });
});
