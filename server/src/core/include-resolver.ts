/**
 * Resolves raw #include paths to absolute file URIs.
 * Generic -- configurable search paths, no language-specific logic.
 *
 * Resolution order (matching sslc compiler):
 * 1. Relative to the including file's directory
 * 2. Relative to workspace root
 * 3. Relative to each search path in order
 */

import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface ResolveContext {
    /** Absolute file path of the file containing the #include */
    readonly includingFilePath: string;
    /** Workspace root absolute path */
    readonly workspaceRoot?: string;
    /** Additional search directories (e.g., headersDirectory) */
    readonly searchPaths?: readonly string[];
}

/**
 * Strip delimiters from a raw include path.
 * `"file.h"` -> `file.h`, `<file.h>` -> `file.h`
 */
export function stripIncludeDelimiters(raw: string): string {
    const trimmed = raw.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("<") && trimmed.endsWith(">"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

/**
 * Check that a resolved path stays within a given base directory.
 * Prevents path traversal attacks (e.g., `#include "../../../../etc/passwd"`).
 */
export function isWithinBase(resolvedPath: string, base: string): boolean {
    const rel = relative(base, resolvedPath);
    return !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Resolve a raw include path to an absolute file URI.
 * Returns null if the file cannot be found in any search location.
 *
 * Rejects absolute paths and paths that traverse outside the workspace root,
 * search paths, or including file's directory tree.
 */
export function resolveIncludePath(rawPath: string, context: ResolveContext): string | null {
    const cleaned = stripIncludeDelimiters(rawPath);
    if (cleaned === "" || isAbsolute(cleaned)) {
        return null;
    }

    // 1. Relative to the including file's directory
    const fromFileDir = resolve(dirname(context.includingFilePath), cleaned);
    // When a workspace root is set, enforce that resolved paths stay within it.
    // Without a workspace root we can't determine the project boundary, so
    // we allow any relative path (the user controls the include content anyway).
    const withinWorkspace = !context.workspaceRoot || isWithinBase(fromFileDir, context.workspaceRoot);
    if (withinWorkspace && existsSync(fromFileDir)) {
        return pathToFileURL(fromFileDir).toString();
    }

    // 2. Relative to workspace root
    if (context.workspaceRoot) {
        const fromRoot = resolve(context.workspaceRoot, cleaned);
        if (isWithinBase(fromRoot, context.workspaceRoot) && existsSync(fromRoot)) {
            return pathToFileURL(fromRoot).toString();
        }
    }

    // 3. Relative to each search path
    if (context.searchPaths) {
        for (const searchPath of context.searchPaths) {
            if (!searchPath) continue;
            const fromSearch = resolve(searchPath, cleaned);
            if (isWithinBase(fromSearch, searchPath) && existsSync(fromSearch)) {
                return pathToFileURL(fromSearch).toString();
            }
        }
    }

    return null;
}
