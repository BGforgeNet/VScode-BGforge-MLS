/**
 * Unit tests for core/include-graph.ts -- generic include graph data structure.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { IncludeGraph } from "../../src/core/include-graph";

describe("core/include-graph", () => {
    let graph: IncludeGraph;

    beforeEach(() => {
        graph = new IncludeGraph();
    });

    describe("updateFile / getIncludes / getIncludedBy", () => {
        it("records direct include edges", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h"]);

            expect(graph.getIncludes("file:///a.ssl")).toEqual(["file:///b.h"]);
            expect(graph.getIncludedBy("file:///b.h")).toEqual(["file:///a.ssl"]);
        });

        it("handles multiple includes from one file", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h", "file:///c.h"]);

            expect(graph.getIncludes("file:///a.ssl")).toHaveLength(2);
            expect(graph.getIncludes("file:///a.ssl")).toContain("file:///b.h");
            expect(graph.getIncludes("file:///a.ssl")).toContain("file:///c.h");
        });

        it("diffs edges on re-update (adds new, removes stale)", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h", "file:///c.h"]);
            graph.updateFile("file:///a.ssl", ["file:///c.h", "file:///d.h"]);

            const includes = graph.getIncludes("file:///a.ssl");
            expect(includes).toContain("file:///c.h");
            expect(includes).toContain("file:///d.h");
            expect(includes).not.toContain("file:///b.h");
        });
    });

    describe("getTransitiveDependants", () => {
        it("returns all files that transitively include a file", () => {
            // A includes B, B includes C => dependants of C are [B, A]
            graph.updateFile("file:///a.ssl", ["file:///b.h"]);
            graph.updateFile("file:///b.h", ["file:///c.h"]);

            const dependants = graph.getTransitiveDependants("file:///c.h");
            expect(dependants).toContain("file:///b.h");
            expect(dependants).toContain("file:///a.ssl");
        });

        it("returns empty for a file with no dependants", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h"]);

            expect(graph.getTransitiveDependants("file:///a.ssl")).toEqual([]);
        });

        it("returns empty for unknown file", () => {
            expect(graph.getTransitiveDependants("file:///unknown.h")).toEqual([]);
        });
    });

    describe("getTransitiveDependencies", () => {
        it("returns all files transitively included", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h"]);
            graph.updateFile("file:///b.h", ["file:///c.h"]);

            const deps = graph.getTransitiveDependencies("file:///a.ssl");
            expect(deps).toContain("file:///b.h");
            expect(deps).toContain("file:///c.h");
        });
    });

    describe("circular includes", () => {
        it("handles circular deps without infinite loop", () => {
            graph.updateFile("file:///a.h", ["file:///b.h"]);
            graph.updateFile("file:///b.h", ["file:///a.h"]);

            const dependants = graph.getTransitiveDependants("file:///a.h");
            expect(dependants).toContain("file:///b.h");

            const deps = graph.getTransitiveDependencies("file:///a.h");
            expect(deps).toContain("file:///b.h");
        });
    });

    describe("removeFile", () => {
        it("removes node and all edges", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h"]);
            graph.removeFile("file:///b.h");

            expect(graph.hasFile("file:///b.h")).toBe(false);
            expect(graph.getIncludes("file:///a.ssl")).toEqual([]);
        });

        it("does nothing for unknown file", () => {
            expect(() => graph.removeFile("file:///unknown")).not.toThrow();
        });
    });

    describe("clear", () => {
        it("resets the entire graph", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h"]);
            graph.clear();

            expect(graph.hasFile("file:///a.ssl")).toBe(false);
            expect(graph.getAllFiles()).toEqual([]);
        });
    });

    describe("hasFile / getAllFiles", () => {
        it("tracks all registered files", () => {
            graph.updateFile("file:///a.ssl", ["file:///b.h"]);

            expect(graph.hasFile("file:///a.ssl")).toBe(true);
            expect(graph.hasFile("file:///b.h")).toBe(true);
            expect(graph.hasFile("file:///c.h")).toBe(false);

            const all = graph.getAllFiles();
            expect(all).toContain("file:///a.ssl");
            expect(all).toContain("file:///b.h");
        });
    });

    describe("empty graph queries", () => {
        it("returns empty arrays for all queries", () => {
            expect(graph.getIncludes("file:///x")).toEqual([]);
            expect(graph.getIncludedBy("file:///x")).toEqual([]);
            expect(graph.getTransitiveDependants("file:///x")).toEqual([]);
            expect(graph.getTransitiveDependencies("file:///x")).toEqual([]);
            expect(graph.getAllFiles()).toEqual([]);
        });
    });
});
