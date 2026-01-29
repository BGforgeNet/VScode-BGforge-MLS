/**
 * Tests for IESDP item type processing functions.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getItemTypes, getItemTypesIsense, saveItemTypesIelib } from "../src/ie/item-types.js";
import type { ItemType } from "../src/ie/types.js";

describe("getItemTypes", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ie-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("loads and processes item types from YAML", () => {
        const yamlContent = [
            "- type: Sword\n  code: 1",
            "- type: Unknown\n  code: 0",
            "- type: Shield\n  code: 2\n  id: SHIELD_TYPE",
        ].join("\n");
        fs.writeFileSync(path.join(tmpDir, "item_types.yml"), yamlContent, "utf8");

        const result = getItemTypes(tmpDir);
        // 'unknown' items are skipped
        expect(result).toHaveLength(2);
        expect(result[0]!.id).toBe("ITEM_TYPE_sword");
        expect(result[0]!.value).toBe(1);
        expect(result[1]!.id).toBe("ITEM_TYPE_SHIELD_TYPE");
        expect(result[1]!.value).toBe(2);
    });
});

describe("saveItemTypesIelib", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ie-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("writes TPP file with correct format", () => {
        const itypes: ItemType[] = [
            { id: "ITEM_TYPE_sword", desc: "Sword", value: 1 },
            { id: "ITEM_TYPE_shield", desc: "Shield", value: 2 },
        ];
        saveItemTypesIelib(tmpDir, itypes);

        const content = fs.readFileSync(path.join(tmpDir, "item_types.tpp"), "utf8");
        expect(content).toContain("ITEM_TYPE_sword = 1");
        expect(content).toContain("ITEM_TYPE_shield = 2");
    });
});

describe("getItemTypesIsense", () => {
    it("formats item types for completion", () => {
        const itypes: ItemType[] = [
            { id: "ITEM_TYPE_sword", desc: "Sword", value: 1 },
        ];
        const result = getItemTypesIsense(itypes);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            name: "ITEM_TYPE_sword",
            detail: "int ITEM_TYPE_sword = 1",
            doc: "Sword",
        });
    });
});
