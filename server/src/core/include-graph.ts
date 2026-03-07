/**
 * Generic, language-agnostic include graph.
 * Wraps `dependency-graph` to track file include relationships.
 * Pure data structure -- no I/O, no parsing.
 *
 * Used by rename (getTransitiveDependants) and potentially by
 * find-all-references, call hierarchy, diagnostics in the future.
 */

import { DepGraph } from "dependency-graph";

export class IncludeGraph {
    private graph = new DepGraph<void>({ circular: true });

    /**
     * Set the resolved include edges for a file.
     * Replaces any previously recorded edges for this URI.
     */
    updateFile(uri: string, resolvedIncludes: readonly string[]): void {
        // Ensure the node exists
        if (!this.graph.hasNode(uri)) {
            this.graph.addNode(uri);
        }

        // Diff: remove stale edges, add new ones
        const oldDeps = new Set(this.safeDirectDeps(uri));
        const newDeps = new Set(resolvedIncludes);

        for (const dep of oldDeps) {
            if (!newDeps.has(dep)) {
                this.graph.removeDependency(uri, dep);
            }
        }

        for (const dep of newDeps) {
            if (!this.graph.hasNode(dep)) {
                this.graph.addNode(dep);
            }
            if (!oldDeps.has(dep)) {
                this.graph.addDependency(uri, dep);
            }
        }
    }

    /** Remove a file and all edges to/from it. */
    removeFile(uri: string): void {
        if (this.graph.hasNode(uri)) {
            this.graph.removeNode(uri);
        }
    }

    /** Clear the entire graph. */
    clear(): void {
        this.graph = new DepGraph<void>({ circular: true });
    }

    /** Direct includes of a file ("A includes B" -> getIncludes(A) contains B). */
    getIncludes(uri: string): readonly string[] {
        return this.safeDirectDeps(uri);
    }

    /** Direct reverse deps ("B is included by A" -> getIncludedBy(B) contains A). */
    getIncludedBy(uri: string): readonly string[] {
        if (!this.graph.hasNode(uri)) {
            return [];
        }
        return this.graph.directDependantsOf(uri);
    }

    /**
     * All files that transitively include this file.
     * This is the core query for workspace-wide rename:
     * given a definition file, find every file that (transitively) includes it.
     */
    getTransitiveDependants(uri: string): readonly string[] {
        if (!this.graph.hasNode(uri)) {
            return [];
        }
        return this.graph.dependantsOf(uri);
    }

    /** All files this file transitively includes. */
    getTransitiveDependencies(uri: string): readonly string[] {
        if (!this.graph.hasNode(uri)) {
            return [];
        }
        return this.graph.dependenciesOf(uri);
    }

    hasFile(uri: string): boolean {
        return this.graph.hasNode(uri);
    }

    getAllFiles(): readonly string[] {
        return this.graph.overallOrder();
    }

    private safeDirectDeps(uri: string): string[] {
        if (!this.graph.hasNode(uri)) {
            return [];
        }
        return this.graph.directDependenciesOf(uri);
    }
}
