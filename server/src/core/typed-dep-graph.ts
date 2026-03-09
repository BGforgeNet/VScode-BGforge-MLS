/**
 * Type-safe wrapper around dependency-graph's DepGraph.
 *
 * DepGraph uses plain `string` keys and returns `string[]` from all query
 * methods. This wrapper re-exposes the same API with a branded key type K
 * (e.g., NormalizedUri), providing compile-time enforcement that only
 * properly-typed keys enter or leave the graph.
 *
 * The underlying DepGraph stores and returns our K values (which are
 * strings at runtime), so the delegation is zero-cost.
 */

import { DepGraph } from "dependency-graph";

export class TypedDepGraph<K extends string> {
    // DepGraph accepts K values because K extends string.
    // It returns string[], but since we only insert K values,
    // the returned strings are always K at runtime.
    // We use a typed private accessor (typedArray) to bridge
    // the gap in a single place rather than scattering casts.
    private inner = new DepGraph<void>({ circular: true });

    hasNode(node: K): boolean {
        return this.inner.hasNode(node);
    }

    addNode(node: K): void {
        this.inner.addNode(node);
    }

    removeNode(node: K): void {
        this.inner.removeNode(node);
    }

    addDependency(from: K, to: K): void {
        this.inner.addDependency(from, to);
    }

    removeDependency(from: K, to: K): void {
        this.inner.removeDependency(from, to);
    }

    directDependenciesOf(node: K): K[] {
        return this.typedArray(this.inner.directDependenciesOf(node));
    }

    directDependantsOf(node: K): K[] {
        return this.typedArray(this.inner.directDependantsOf(node));
    }

    dependenciesOf(node: K): K[] {
        return this.typedArray(this.inner.dependenciesOf(node));
    }

    dependantsOf(node: K): K[] {
        return this.typedArray(this.inner.dependantsOf(node));
    }

    overallOrder(): K[] {
        return this.typedArray(this.inner.overallOrder());
    }

    /**
     * Bridge DepGraph's string[] returns to K[].
     * Safe because we only insert K values into the graph via the typed
     * addNode/addDependency methods, so all returned strings are K at runtime.
     * This is the single adaptation point between the untyped library and
     * our branded type system -- no casts appear in consuming code.
     */
    private typedArray(arr: string[]): K[] {
        // Library boundary: DepGraph returns string[] but only stores values we inserted as K.
        return arr as K[];
    }
}
