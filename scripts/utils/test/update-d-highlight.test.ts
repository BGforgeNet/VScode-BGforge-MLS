import { describe, expect, it } from "vitest";
import { buildHighlightPatterns } from "../src/update-tp2-highlight.ts";
import { loadData } from "../src/generate-data.ts";
import { cmpStr } from "../src/yaml-helpers.ts";

const DATA = loadData(["server/data/weidu-d-base.yml"]);

const D_STANZAS = ["actions", "chain_epilogue", "keywords", "trans_feature", "trans_next", "when"] as const;

describe("D highlight patterns", () => {
    it("generates patterns for all mapped stanzas", () => {
        for (const stanza of D_STANZAS) {
            const patterns = buildHighlightPatterns(DATA, stanza);
            expect(patterns.length).toBeGreaterThan(0);
        }
    });

    it("sorts generated patterns by match string", () => {
        const patterns = buildHighlightPatterns(DATA, "actions");
        const matches = patterns.map((p) => p.match);
        expect(matches).toEqual([...matches].sort(cmpStr));
    });

    it("includes REPLACE_ACTION_TEXT_PROCESS_REGEXP in actions", () => {
        const patterns = buildHighlightPatterns(DATA, "actions");
        expect(patterns.some((p) => p.match === "\\b(REPLACE_ACTION_TEXT_PROCESS_REGEXP)\\b")).toBe(true);
    });

    it("includes IF in when stanza", () => {
        const patterns = buildHighlightPatterns(DATA, "when");
        expect(patterns.some((p) => p.match === "\\b(IF)\\b")).toBe(true);
        expect(patterns.some((p) => p.match === "\\b(UNLESS)\\b")).toBe(true);
    });

    it("chain_epilogue has COPY_TRANS and COPY_TRANS_LATE", () => {
        const patterns = buildHighlightPatterns(DATA, "chain_epilogue");
        const names = patterns.map((p) => p.match);
        expect(names).toContain("\\b(COPY_TRANS)\\b");
        expect(names).toContain("\\b(COPY_TRANS_LATE)\\b");
        // END, EXIT, EXTERN are chain epilogue keywords in the grammar but
        // live in keywords/trans_next to avoid duplicate completion entries.
    });

    it("trans_next includes EXIT, EXTERN, GOTO", () => {
        const patterns = buildHighlightPatterns(DATA, "trans_next");
        const names = patterns.map((p) => p.match);
        expect(names).toContain("\\b(EXIT)\\b");
        expect(names).toContain("\\b(EXTERN)\\b");
        expect(names).toContain("\\b(GOTO)\\b");
    });
});
