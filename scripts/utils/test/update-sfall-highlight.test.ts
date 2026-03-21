/**
 * Tests for update-sfall-highlight: pattern generation from fallout-ssl-sfall.yml.
 */

import { describe, expect, it } from "vitest";
import { buildHooksPatterns, buildSfallFunctionPatterns } from "../src/update-sfall-highlight.ts";
import { cmpStr } from "../src/yaml-helpers.ts";

const SFALL_YAML = "server/data/fallout-ssl-sfall.yml";

describe("buildSfallFunctionPatterns", () => {
    it("produces case-insensitive patterns", () => {
        const patterns = buildSfallFunctionPatterns(SFALL_YAML);
        expect(patterns.length).toBeGreaterThan(0);
        for (const p of patterns) {
            expect(p.match).toMatch(/^\\b\(\?i\)\(.*\)\\b$/);
        }
    });

    it("skips non-identifier items (non-word chars like ^ or spaces)", () => {
        const patterns = buildSfallFunctionPatterns(SFALL_YAML);
        const names = patterns.map((p) => p.match.match(/^\\b\(\?i\)\((.*)\)\\b$/)?.[1] ?? "");
        expect(names).not.toContain("^");
        for (const name of names) {
            expect(name).toMatch(/^\w+$/);
        }
    });

    it("sorts patterns by function name", () => {
        const patterns = buildSfallFunctionPatterns(SFALL_YAML);
        const names = patterns.map((p) => p.match.match(/^\\b\(\?i\)\((.*)\)\\b$/)?.[1] ?? "");
        expect(names).toEqual([...names].sort(cmpStr));
    });
});

describe("buildHooksPatterns", () => {
    it("produces case-sensitive patterns", () => {
        const patterns = buildHooksPatterns(SFALL_YAML);
        expect(patterns.length).toBeGreaterThan(0);
        for (const p of patterns) {
            expect(p.match).toMatch(/^\\b\(HOOK_/);
            expect(p.match).not.toContain("(?i)");
        }
    });

    it("skips non-identifier hook names", () => {
        const patterns = buildHooksPatterns(SFALL_YAML);
        const names = patterns.map((p) => p.match.match(/^\\b\((.*)\)\\b$/)?.[1] ?? "");
        for (const name of names) {
            expect(name).toMatch(/^\w+$/);
        }
    });

    it("sorts patterns by hook name", () => {
        const patterns = buildHooksPatterns(SFALL_YAML);
        const names = patterns.map((p) => p.match.match(/^\\b\((.*)\)\\b$/)?.[1] ?? "");
        expect(names).toEqual([...names].sort(cmpStr));
    });
});
