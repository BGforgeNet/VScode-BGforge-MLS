/**
 * Tests for shared/feature-data.ts - generic data containers and reload utilities.
 */

import { describe, expect, it } from "vitest";
import {
    createEmptyListData,
    createEmptyMapData,
    reloadList,
    reloadMap,
    getListItems,
    lookupMapItem,
    type UriItem,
    type ListData,
    type MapData,
} from "../../src/shared/feature-data";

interface TestItem extends UriItem {
    uri: string;
    label: string;
}

describe("shared/feature-data", () => {
    describe("createEmptyListData()", () => {
        it("should create an empty list data container", () => {
            const data = createEmptyListData<TestItem>();

            expect(data.self).toBeInstanceOf(Map);
            expect(data.self.size).toBe(0);
            expect(data.headers).toEqual([]);
            expect(data.static).toEqual([]);
            expect(data.extHeaders).toBeUndefined();
        });
    });

    describe("createEmptyMapData()", () => {
        it("should create an empty map data container", () => {
            const data = createEmptyMapData<TestItem>();

            expect(data.self).toBeInstanceOf(Map);
            expect(data.self.size).toBe(0);
            expect(data.headers).toBeInstanceOf(Map);
            expect(data.headers.size).toBe(0);
            expect(data.static).toBeInstanceOf(Map);
            expect(data.static.size).toBe(0);
            expect(data.extHeaders).toBeUndefined();
        });
    });

    describe("reloadList()", () => {
        const getKey = (item: TestItem) => item.label;

        it("should add items from a new file", () => {
            const existing: TestItem[] = [];
            const incoming: TestItem[] = [
                { uri: "file:///new.txt", label: "item1" },
            ];
            const staticKeys = new Map<string, unknown>();

            const result = reloadList(existing, incoming, "file:///new.txt", staticKeys, getKey);

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("item1");
        });

        it("should replace items from the same URI", () => {
            const existing: TestItem[] = [
                { uri: "file:///test.txt", label: "old" },
            ];
            const incoming: TestItem[] = [
                { uri: "file:///test.txt", label: "new" },
            ];
            const staticKeys = new Map<string, unknown>();

            const result = reloadList(existing, incoming, "file:///test.txt", staticKeys, getKey);

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("new");
        });

        it("should preserve items from other URIs", () => {
            const existing: TestItem[] = [
                { uri: "file:///other.txt", label: "keep" },
                { uri: "file:///test.txt", label: "remove" },
            ];
            const incoming: TestItem[] = [
                { uri: "file:///test.txt", label: "new" },
            ];
            const staticKeys = new Map<string, unknown>();

            const result = reloadList(existing, incoming, "file:///test.txt", staticKeys, getKey);

            expect(result).toHaveLength(2);
            expect(result.find(i => i.label === "keep")).toBeDefined();
            expect(result.find(i => i.label === "new")).toBeDefined();
            expect(result.find(i => i.label === "remove")).toBeUndefined();
        });

        it("should filter out items that exist in static", () => {
            const existing: TestItem[] = [];
            const incoming: TestItem[] = [
                { uri: "file:///test.txt", label: "static_item" },
                { uri: "file:///test.txt", label: "new_item" },
            ];
            const staticKeys = new Map<string, unknown>([["static_item", {}]]);

            const result = reloadList(existing, incoming, "file:///test.txt", staticKeys, getKey);

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("new_item");
        });

        it("should work with Set for staticKeys", () => {
            const existing: TestItem[] = [];
            const incoming: TestItem[] = [
                { uri: "file:///test.txt", label: "static_item" },
                { uri: "file:///test.txt", label: "new_item" },
            ];
            const staticKeys = new Set(["static_item"]);

            const result = reloadList(existing, incoming, "file:///test.txt", staticKeys, getKey);

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("new_item");
        });
    });

    describe("reloadMap()", () => {
        it("should add items from a new file", () => {
            const existing = new Map<string, TestItem>();
            const incoming = new Map<string, TestItem>([
                ["sym1", { uri: "file:///new.txt", label: "sym1" }],
            ]);
            const staticKeys = new Map<string, unknown>();

            const result = reloadMap(existing, incoming, "file:///new.txt", staticKeys);

            expect(result.size).toBe(1);
            expect(result.get("sym1")?.label).toBe("sym1");
        });

        it("should replace items from the same URI", () => {
            const existing = new Map<string, TestItem>([
                ["sym1", { uri: "file:///test.txt", label: "old" }],
            ]);
            const incoming = new Map<string, TestItem>([
                ["sym1", { uri: "file:///test.txt", label: "new" }],
            ]);
            const staticKeys = new Map<string, unknown>();

            const result = reloadMap(existing, incoming, "file:///test.txt", staticKeys);

            expect(result.size).toBe(1);
            expect(result.get("sym1")?.label).toBe("new");
        });

        it("should preserve items from other URIs", () => {
            const existing = new Map<string, TestItem>([
                ["keep", { uri: "file:///other.txt", label: "keep" }],
                ["remove", { uri: "file:///test.txt", label: "remove" }],
            ]);
            const incoming = new Map<string, TestItem>([
                ["new", { uri: "file:///test.txt", label: "new" }],
            ]);
            const staticKeys = new Map<string, unknown>();

            const result = reloadMap(existing, incoming, "file:///test.txt", staticKeys);

            expect(result.size).toBe(2);
            expect(result.has("keep")).toBe(true);
            expect(result.has("new")).toBe(true);
            expect(result.has("remove")).toBe(false);
        });

        it("should filter out items that exist in static", () => {
            const existing = new Map<string, TestItem>();
            const incoming = new Map<string, TestItem>([
                ["static_item", { uri: "file:///test.txt", label: "static_item" }],
                ["new_item", { uri: "file:///test.txt", label: "new_item" }],
            ]);
            const staticKeys = new Map<string, unknown>([["static_item", {}]]);

            const result = reloadMap(existing, incoming, "file:///test.txt", staticKeys);

            expect(result.size).toBe(1);
            expect(result.has("new_item")).toBe(true);
            expect(result.has("static_item")).toBe(false);
        });
    });

    describe("getListItems()", () => {
        it("should return all items combined", () => {
            const data: ListData<TestItem> = {
                self: new Map([
                    ["file:///test.txt", [{ uri: "file:///test.txt", label: "self" }]],
                ]),
                headers: [{ uri: "file:///header.h", label: "header" }],
                static: [{ uri: "", label: "static" }],
            };

            const result = getListItems(data, "file:///test.txt");

            expect(result).toHaveLength(3);
            expect(result.map(i => i.label)).toContain("self");
            expect(result.map(i => i.label)).toContain("header");
            expect(result.map(i => i.label)).toContain("static");
        });

        it("should include extHeaders if present", () => {
            const data: ListData<TestItem> = {
                self: new Map(),
                headers: [],
                extHeaders: [{ uri: "file:///ext.h", label: "external" }],
                static: [],
            };

            const result = getListItems(data, "file:///test.txt");

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe("external");
        });

        it("should return empty array for missing self URI", () => {
            const data: ListData<TestItem> = {
                self: new Map(),
                headers: [],
                static: [],
            };

            const result = getListItems(data, "file:///nonexistent.txt");

            expect(result).toHaveLength(0);
        });

        it("should prioritize self items first in result order", () => {
            const data: ListData<TestItem> = {
                self: new Map([
                    ["file:///test.txt", [{ uri: "file:///test.txt", label: "self" }]],
                ]),
                headers: [{ uri: "file:///header.h", label: "header" }],
                static: [{ uri: "", label: "static" }],
            };

            const result = getListItems(data, "file:///test.txt");

            expect(result[0].label).toBe("self");
        });
    });

    describe("lookupMapItem()", () => {
        it("should find item in self first", () => {
            const selfMap = new Map<string, TestItem>([
                ["sym", { uri: "file:///test.txt", label: "from_self" }],
            ]);
            const data: MapData<TestItem> = {
                self: new Map([["file:///test.txt", selfMap]]),
                headers: new Map([["sym", { uri: "file:///h.h", label: "from_header" }]]),
                static: new Map([["sym", { uri: "", label: "from_static" }]]),
            };

            const result = lookupMapItem(data, "file:///test.txt", "sym");

            expect(result?.label).toBe("from_self");
        });

        it("should fall back to static if not in self", () => {
            const data: MapData<TestItem> = {
                self: new Map(),
                headers: new Map([["sym", { uri: "file:///h.h", label: "from_header" }]]),
                static: new Map([["sym", { uri: "", label: "from_static" }]]),
            };

            const result = lookupMapItem(data, "file:///test.txt", "sym");

            expect(result?.label).toBe("from_static");
        });

        it("should fall back to headers if not in self or static", () => {
            const data: MapData<TestItem> = {
                self: new Map(),
                headers: new Map([["sym", { uri: "file:///h.h", label: "from_header" }]]),
                static: new Map(),
            };

            const result = lookupMapItem(data, "file:///test.txt", "sym");

            expect(result?.label).toBe("from_header");
        });

        it("should fall back to extHeaders if not found elsewhere", () => {
            const data: MapData<TestItem> = {
                self: new Map(),
                headers: new Map(),
                extHeaders: new Map([["sym", { uri: "file:///ext.h", label: "from_ext" }]]),
                static: new Map(),
            };

            const result = lookupMapItem(data, "file:///test.txt", "sym");

            expect(result?.label).toBe("from_ext");
        });

        it("should return undefined if symbol not found", () => {
            const data: MapData<TestItem> = {
                self: new Map(),
                headers: new Map(),
                static: new Map(),
            };

            const result = lookupMapItem(data, "file:///test.txt", "nonexistent");

            expect(result).toBeUndefined();
        });

        it("should check self map for the correct URI", () => {
            const selfMap1 = new Map<string, TestItem>([
                ["sym", { uri: "file:///file1.txt", label: "file1" }],
            ]);
            const selfMap2 = new Map<string, TestItem>([
                ["sym", { uri: "file:///file2.txt", label: "file2" }],
            ]);
            const data: MapData<TestItem> = {
                self: new Map([
                    ["file:///file1.txt", selfMap1],
                    ["file:///file2.txt", selfMap2],
                ]),
                headers: new Map(),
                static: new Map(),
            };

            const result = lookupMapItem(data, "file:///file2.txt", "sym");

            expect(result?.label).toBe("file2");
        });
    });
});
