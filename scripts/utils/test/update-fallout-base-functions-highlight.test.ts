import { describe, expect, it } from "vitest";
import { buildFalloutBaseFunctionPatterns } from "../src/update-fallout-base-functions-highlight.ts";
import { cmpStr } from "../src/yaml-helpers.ts";

describe("buildFalloutBaseFunctionPatterns", () => {
    it("marks deprecated base-data functions with the deprecated highlight scope", () => {
        const patterns = buildFalloutBaseFunctionPatterns("server/data/fallout-ssl-base.yml");

        const critterInvenObj = patterns.find((p) => p.match === "\\b(?i)(critter_inven_obj)\\b");
        expect(critterInvenObj).toBeDefined();
        expect(critterInvenObj!.name).toBe("invalid.deprecated.bgforge");

        const attack = patterns.find((p) => p.match === "\\b(?i)(attack)\\b");
        expect(attack).toBeDefined();
        expect(attack!.name).toBeUndefined();
    });

    it("globally sorts generated patterns by function name", () => {
        const patterns = buildFalloutBaseFunctionPatterns("server/data/fallout-ssl-base.yml");
        const names = patterns.map((pattern) => pattern.match.match(/^\\b\(\?i\)\((.*)\)\\b$/)?.[1] ?? "");
        expect(names).toEqual([...names].sort(cmpStr));
    });
});
