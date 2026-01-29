/**
 * Tests for common YAML I/O and utility functions.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    checkCompletion,
    dumpCompletion,
    dumpDefinition,
    dumpHighlight,
    findFiles,
    litscal,
    stripLiquid,
} from "../src/ie/common.js";
import YAML from "yaml";
import type { IEData } from "../src/ie/types.js";

describe("litscal", () => {
    it("dedents text with common indentation", () => {
        const input = "  line1\n  line2\n  line3";
        expect(litscal(input)).toBe("line1\nline2\nline3");
    });

    it("preserves relative indentation", () => {
        const input = "  line1\n    line2\n  line3";
        expect(litscal(input)).toBe("line1\n  line2\nline3");
    });

    it("handles text without common indentation", () => {
        const input = "line1\nline2";
        expect(litscal(input)).toBe("line1\nline2");
    });

    it("handles empty lines in indentation calculation", () => {
        const input = "  line1\n\n  line2";
        expect(litscal(input)).toBe("line1\n\nline2");
    });
});

describe("findFiles", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ie-test-"));
        fs.mkdirSync(path.join(tmpDir, "sub"), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, "skip"), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, "a.yml"), "", "utf8");
        fs.writeFileSync(path.join(tmpDir, "sub", "b.yml"), "", "utf8");
        fs.writeFileSync(path.join(tmpDir, "skip", "c.yml"), "", "utf8");
        fs.writeFileSync(path.join(tmpDir, "d.txt"), "", "utf8");
        fs.writeFileSync(path.join(tmpDir, "iesdp.tpp"), "", "utf8");
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("finds files by extension", () => {
        const result = findFiles(tmpDir, "yml");
        expect(result).toHaveLength(3);
    });

    it("skips specified directories", () => {
        const result = findFiles(tmpDir, "yml", ["skip"]);
        expect(result).toHaveLength(2);
    });

    it("skips specified files", () => {
        const result = findFiles(tmpDir, "yml", [], ["b.yml"]);
        expect(result).toHaveLength(2);
    });

    it("skips iesdp.tpp by default", () => {
        const result = findFiles(tmpDir, "tpp");
        expect(result).toHaveLength(0);
    });
});

describe("stripLiquid", () => {
    it("removes capture note tags", () => {
        const input = "{% capture note %}Some note{% endcapture %} {% include note.html %}";
        expect(stripLiquid(input)).toBe("Some note");
    });

    it("removes capture info tags", () => {
        const input = "{% capture note %}Some info{% endcapture %} {% include info.html %}";
        expect(stripLiquid(input)).toBe("Some info");
    });

    it("leaves plain text unchanged", () => {
        expect(stripLiquid("plain text")).toBe("plain text");
    });
});

describe("dumpCompletion", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ie-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("writes completion items to YAML file", () => {
        const filePath = path.join(tmpDir, "data.yml");
        // Create initial YAML structure with an existing stanza
        fs.writeFileSync(filePath, "# comment\nexisting:\n  type: 21\n  items: []\n", "utf8");

        const iedata: IEData = {
            test: {
                stanza: "test-stanza",
                scope: "test.scope",
                items: [
                    { name: "B_item", detail: "detail B", doc: "doc B" },
                    { name: "A_item", detail: "detail A", doc: "doc A" },
                ],
            },
        };

        dumpCompletion(filePath, iedata);

        const content = fs.readFileSync(filePath, "utf8");
        const parsed = YAML.parse(content);
        expect(parsed["test-stanza"]).toBeDefined();
        expect(parsed["test-stanza"].type).toBe(21); // COMPLETION_TYPE_CONSTANT
        expect(parsed["test-stanza"].items).toHaveLength(2);
        // Items should be sorted by name
        expect(parsed["test-stanza"].items[0].name).toBe("A_item");
        expect(parsed["test-stanza"].items[1].name).toBe("B_item");
    });
});

describe("checkCompletion", () => {
    it("throws on duplicate names across stanzas", () => {
        const doc = YAML.parseDocument(
            "stanza1:\n  type: 21\n  items:\n    - name: DUPE\n      detail: d\n      doc: d\nstanza2:\n  type: 21\n  items:\n    - name: DUPE\n      detail: d\n      doc: d"
        );
        expect(() => checkCompletion(doc)).toThrow("Duplicated completion items");
    });

    it("allows EVALUATE_BUFFER duplicates", () => {
        const doc = YAML.parseDocument(
            "stanza1:\n  type: 21\n  items:\n    - name: EVALUATE_BUFFER\n      detail: d\n      doc: d\nstanza2:\n  type: 21\n  items:\n    - name: EVALUATE_BUFFER\n      detail: d\n      doc: d"
        );
        expect(() => checkCompletion(doc)).not.toThrow();
    });
});

describe("dumpHighlight", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ie-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("writes highlight patterns to YAML file", () => {
        const filePath = path.join(tmpDir, "highlight.yml");
        fs.writeFileSync(filePath, "repository:\n  existing: {}\n", "utf8");

        const iedata: IEData = {
            test: {
                stanza: "test-stanza",
                scope: "test.scope",
                items: [
                    { name: "SHORT", detail: "d", doc: "d" },
                    { name: "LONGER_NAME", detail: "d", doc: "d" },
                ],
            },
        };

        dumpHighlight(filePath, iedata);

        const content = fs.readFileSync(filePath, "utf8");
        const parsed = YAML.parse(content);
        const stanza = parsed.repository["test-stanza"];
        expect(stanza.name).toBe("test.scope");
        expect(stanza.patterns).toBeDefined();
        // Longer names should come first
        expect(stanza.patterns[0].match).toContain("LONGER_NAME");
    });
});

describe("dumpDefinition", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ie-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("writes sorted definition constants to TPP file", () => {
        const items = new Map([
            ["Z_CONST", "0x10"],
            ["A_CONST", "0x0"],
        ]);
        dumpDefinition("EFF_V2_", items, tmpDir);

        const outputPath = path.join(tmpDir, "effv2", "iesdp.tpp");
        expect(fs.existsSync(outputPath)).toBe(true);

        const content = fs.readFileSync(outputPath, "utf8");
        const lines = content.trim().split("\n");
        // Should be sorted alphabetically
        expect(lines[0]).toBe("A_CONST = 0x0");
        expect(lines[1]).toBe("Z_CONST = 0x10");
    });
});
