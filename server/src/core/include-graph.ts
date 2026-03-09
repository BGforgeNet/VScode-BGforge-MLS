/**
 * Generic, language-agnostic include graph.
 * Wraps TypedDepGraph to track file include relationships.
 * Pure data structure -- no I/O, no parsing.
 *
 * All URIs are normalized on input via NormalizedUri to prevent
 * encoding mismatches (e.g., %21 vs ! on Windows).
 *
 * Used by rename (getTransitiveDependants) and potentially by
 * find-all-references, call hierarchy, diagnostics in the future.
 */

import { type NormalizedUri, normalizeUri } from "./normalized-uri";
import { TypedDepGraph } from "./typed-dep-graph";

export class IncludeGraph {
    private graph = new TypedDepGraph<NormalizedUri>();

    /**
     * Set the resolved include edges for a file.
     * Replaces any previously recorded edges for this URI.
     * URIs are normalized internally -- callers may pass raw strings.
     */
    updateFile(uri: string, resolvedIncludes: readonly string[]): void {
        const normUri = normalizeUri(uri);
        const normIncludes = resolvedIncludes.map(normalizeUri);

        // Ensure the node exists
        if (!this.graph.hasNode(normUri)) {
            this.graph.addNode(normUri);
        }

        // Diff: remove stale edges, add new ones
        const oldDeps = new Set(this.safeDirectDeps(normUri));
        const newDeps = new Set(normIncludes);

        for (const dep of oldDeps) {
            if (!newDeps.has(dep)) {
                this.graph.removeDependency(normUri, dep);
            }
        }

        for (const dep of newDeps) {
            if (!this.graph.hasNode(dep)) {
                this.graph.addNode(dep);
            }
            if (!oldDeps.has(dep)) {
                this.graph.addDependency(normUri, dep);
            }
        }
    }

    /** Remove a file and all edges to/from it. */
    removeFile(uri: string): void {
        const normUri = normalizeUri(uri);
        if (this.graph.hasNode(normUri)) {
            this.graph.removeNode(normUri);
        }
    }

    /** Clear the entire graph. */
    clear(): void {
        this.graph = new TypedDepGraph<NormalizedUri>();
    }

    /** Direct includes of a file ("A includes B" -> getIncludes(A) contains B). */
    getIncludes(uri: string): readonly NormalizedUri[] {
        return this.safeDirectDeps(normalizeUri(uri));
    }

    /** Direct reverse deps ("B is included by A" -> getIncludedBy(B) contains A). */
    getIncludedBy(uri: string): readonly NormalizedUri[] {
        const normUri = normalizeUri(uri);
        if (!this.graph.hasNode(normUri)) {
            return [];
        }
        return this.graph.directDependantsOf(normUri);
    }

    /**
     * All files that transitively include this file.
     * This is the core query for workspace-wide rename:
     * given a definition file, find every file that (transitively) includes it.
     */
    getTransitiveDependants(uri: string): readonly NormalizedUri[] {
        const normUri = normalizeUri(uri);
        if (!this.graph.hasNode(normUri)) {
            return [];
        }
        return this.graph.dependantsOf(normUri);
    }

    /** All files this file transitively includes. */
    getTransitiveDependencies(uri: string): readonly NormalizedUri[] {
        const normUri = normalizeUri(uri);
        if (!this.graph.hasNode(normUri)) {
            return [];
        }
        return this.graph.dependenciesOf(normUri);
    }

    hasFile(uri: string): boolean {
        return this.graph.hasNode(normalizeUri(uri));
    }

    getAllFiles(): readonly NormalizedUri[] {
        return this.graph.overallOrder();
    }

    private safeDirectDeps(uri: NormalizedUri): NormalizedUri[] {
        if (!this.graph.hasNode(uri)) {
            return [];
        }
        return this.graph.directDependenciesOf(uri);
    }
}
