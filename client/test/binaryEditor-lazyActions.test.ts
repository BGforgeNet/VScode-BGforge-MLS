import { describe, expect, it } from "vitest";
import type { BinaryEditorNode } from "../src/editors/binaryEditor-messages";
import { getLoadableGroupIds, shouldRecursivelyLoadTree } from "../src/editors/binaryEditor-lazyActions";

function group(id: string, expandable = true): BinaryEditorNode {
    return {
        id,
        parentId: "root",
        kind: "group",
        name: id,
        expandable,
    };
}

describe("binaryEditor-lazyActions", () => {
    it("loads recursively for expand-all or active search", () => {
        expect(shouldRecursivelyLoadTree(true, "")).toBe(true);
        expect(shouldRecursivelyLoadTree(false, "PID")).toBe(true);
        expect(shouldRecursivelyLoadTree(false, "   ")).toBe(false);
    });

    it("returns only currently loadable groups", () => {
        const nodes = [
            group("g1"),
            group("g2"),
            group("g3", false),
            {
                id: "f1",
                parentId: "root",
                kind: "field" as const,
                name: "Field",
                expandable: false,
            },
        ];

        expect(getLoadableGroupIds(nodes, new Set(["g2"]), new Set(["g3"]))).toEqual(["g1"]);
    });
});
