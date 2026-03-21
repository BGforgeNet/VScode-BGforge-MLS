import { describe, expect, it } from "vitest";
import { buildTp2HighlightPatterns } from "../src/update-tp2-highlight.ts";
import { loadData } from "../src/generate-data.ts";
import { cmpStr } from "../src/yaml-helpers.ts";

const DATA = loadData(["server/data/weidu-tp2-base.yml"]);

describe("buildTp2HighlightPatterns", () => {
    it("marks deprecated patch items with the deprecated highlight scope", () => {
        const patterns = buildTp2HighlightPatterns(DATA, "patch");

        const compileBaf = patterns.find((p) => p.match === "\\b(COMPILE_BAF_TO_BCS)\\b");
        expect(compileBaf).toBeDefined();
        expect(compileBaf!.name).toBe("invalid.deprecated.bgforge");

        const say = patterns.find((p) => p.match === "\\b(SAY)\\b");
        expect(say).toBeDefined();
        expect(say!.name).toBeUndefined();
    });

    it("sorts generated patterns by match string", () => {
        const patterns = buildTp2HighlightPatterns(DATA, "action");
        const matches = patterns.map((p) => p.match);
        expect(matches).toEqual([...matches].sort(cmpStr));
    });

    it("generates patterns for all mapped stanzas", () => {
        for (const stanza of ["action", "array_sort_type", "caching", "component_flag", "flag", "language", "opt_case", "opt_exact", "opt_glob", "patch", "patch_byte", "patch_long", "patch_string", "prologue", "when"]) {
            const patterns = buildTp2HighlightPatterns(DATA, stanza);
            expect(patterns.length).toBeGreaterThan(0);
        }
    });

    it("throws for unknown stanza", () => {
        expect(() => buildTp2HighlightPatterns(DATA, "nonexistent")).toThrow("not found");
    });
});
