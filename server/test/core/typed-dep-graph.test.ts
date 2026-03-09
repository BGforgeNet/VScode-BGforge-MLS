/**
 * Unit tests for core/typed-dep-graph.ts -- type-safe wrapper around dependency-graph.
 */

import { describe, expect, it } from "vitest";
import { TypedDepGraph } from "../../src/core/typed-dep-graph";
import type { NormalizedUri } from "../../src/core/normalized-uri";

// Helper to create branded URIs for testing without normalizeUri round-trip
function uri(s: string): NormalizedUri {
    return s as NormalizedUri;
}

describe("core/typed-dep-graph", () => {
    it("adds and checks nodes", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");

        expect(graph.hasNode(a)).toBe(false);
        graph.addNode(a);
        expect(graph.hasNode(a)).toBe(true);
    });

    it("removes nodes", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");

        graph.addNode(a);
        graph.removeNode(a);
        expect(graph.hasNode(a)).toBe(false);
    });

    it("tracks direct dependencies", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");
        const b = uri("file:///b.h");

        graph.addNode(a);
        graph.addNode(b);
        graph.addDependency(a, b);

        expect(graph.directDependenciesOf(a)).toEqual([b]);
        expect(graph.directDependantsOf(b)).toEqual([a]);
    });

    it("removes dependencies", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");
        const b = uri("file:///b.h");

        graph.addNode(a);
        graph.addNode(b);
        graph.addDependency(a, b);
        graph.removeDependency(a, b);

        expect(graph.directDependenciesOf(a)).toEqual([]);
    });

    it("computes transitive dependants", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");
        const b = uri("file:///b.h");
        const c = uri("file:///c.h");

        graph.addNode(a);
        graph.addNode(b);
        graph.addNode(c);
        graph.addDependency(a, b);
        graph.addDependency(b, c);

        // a depends on b, b depends on c => a and b are dependants of c
        expect(graph.dependantsOf(c)).toEqual(expect.arrayContaining([a, b]));
    });

    it("computes transitive dependencies", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");
        const b = uri("file:///b.h");
        const c = uri("file:///c.h");

        graph.addNode(a);
        graph.addNode(b);
        graph.addNode(c);
        graph.addDependency(a, b);
        graph.addDependency(b, c);

        expect(graph.dependenciesOf(a)).toEqual(expect.arrayContaining([b, c]));
    });

    it("returns overall order", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");
        const b = uri("file:///b.h");

        graph.addNode(a);
        graph.addNode(b);
        graph.addDependency(a, b);

        const order = graph.overallOrder();
        expect(order).toHaveLength(2);
        // b should come before a (dependency before dependant)
        expect(order.indexOf(b)).toBeLessThan(order.indexOf(a));
    });

    it("supports circular dependencies", () => {
        const graph = new TypedDepGraph<NormalizedUri>();
        const a = uri("file:///a.ssl");
        const b = uri("file:///b.h");

        graph.addNode(a);
        graph.addNode(b);
        graph.addDependency(a, b);
        graph.addDependency(b, a);

        // Should not throw
        expect(graph.dependantsOf(a)).toContain(b);
        expect(graph.dependantsOf(b)).toContain(a);
    });
});
