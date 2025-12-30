/**
 * Shared esbuild utilities for TSSL and TBAF transpilers.
 */

import * as esbuild from "esbuild-wasm";
import { Project, SyntaxKind } from "ts-morph";

let esbuildInitialized = false;

/**
 * Initialize esbuild (singleton, safe to call multiple times).
 */
export async function ensureEsbuild(): Promise<void> {
    if (esbuildInitialized) return;
    await esbuild.initialize({});
    esbuildInitialized = true;
}

/**
 * Clean up esbuild output by stripping marker prefix and fixing import aliases.
 *
 * esbuild renames identifiers when there are name collisions (e.g., See → See2).
 * This function:
 * 1. Strips everything before the marker (runtime helpers like __defProp, __name)
 * 2. Builds alias map from import statements
 * 3. Detects collision patterns (name2 → name22)
 * 4. Renames identifiers back to originals
 * 5. Removes import declarations
 *
 * @param code Bundled code from esbuild
 * @param marker Marker string to find start of user code
 * @returns Cleaned code
 */
export function cleanupEsbuildOutput(code: string, marker: string): string {
    // Strip everything before marker
    const markerIndex = code.indexOf(marker);
    if (markerIndex !== -1) {
        code = code.substring(markerIndex + marker.length).trimStart();
    }

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("esbuild-output.ts", code);

    // Build alias map from import statements
    // import { See as See2 } → See2 should become See
    const aliasMap = new Map<string, string>();
    for (const importDecl of sourceFile.getImportDeclarations()) {
        for (const named of importDecl.getNamedImports()) {
            const alias = named.getAliasNode();
            if (alias) {
                aliasMap.set(alias.getText(), named.getName());
            }
        }
    }

    // Detect esbuild's collision avoidance: if we have alias X→Y, and there's
    // an identifier X2 (X + digit), it was the original that got renamed.
    // e.g., import { See as See2 } causes bundled See2 to become See22
    // In this case: rename See22→See2, and DON'T rename See2→See
    const allIdentifiers = new Set<string>();
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach(id => {
        allIdentifiers.add(id.getText());
    });
    for (const [alias] of [...aliasMap]) {
        for (const id of allIdentifiers) {
            if (id.startsWith(alias) && id !== alias && /^\d+$/.test(id.slice(alias.length))) {
                if (!aliasMap.has(id)) {
                    aliasMap.set(id, alias);
                    aliasMap.delete(alias);
                }
            }
        }
    }

    // Rename identifiers using AST (automatically skips strings)
    // Sort by length (longest first) to avoid partial replacements
    const sortedAliases = [...aliasMap.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [alias, original] of sortedAliases) {
        sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
            .filter(id => id.getText() === alias)
            .forEach(id => id.replaceWithText(original));
    }

    // Remove import declarations
    sourceFile.getImportDeclarations().forEach(decl => decl.remove());

    return sourceFile.getFullText();
}

/**
 * Create an esbuild plugin that marks matching imports as external.
 *
 * @param patterns Array of regex patterns to match import paths
 * @param name Plugin name for debugging
 * @returns esbuild plugin
 */
export function externalModulesPlugin(patterns: RegExp[], name = "external-modules"): esbuild.Plugin {
    return {
        name,
        setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
                for (const pattern of patterns) {
                    if (pattern.test(args.path)) {
                        return { path: args.path, external: true };
                    }
                }
                return null;
            });
        },
    };
}
