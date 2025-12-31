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
 * 4. Uses original constants to restore esbuild-renamed identifiers
 * 5. Renames identifiers back to originals
 * 6. Removes import declarations
 *
 * @param code Bundled code from esbuild
 * @param marker Marker string to find start of user code
 * @param originalConstants Original constant names and values from source file (for restoring renamed vars)
 * @returns Cleaned code
 */
export function cleanupEsbuildOutput(code: string, marker: string, originalConstants?: Map<string, string>): string {
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

    // Detect and fix esbuild's variable renaming due to name collisions.
    //
    // Problem: When TSSL defines a constant that also exists in folib imports,
    // esbuild renames the local constant by appending a single digit to avoid collision.
    // Example: `const DIK_F4 = 62` in TSSL + `DIK_F4` exported from folib
    //          → esbuild outputs `var DIK_F42 = 62` (appended '2')
    //
    // Solution: Use the original constants extracted from the TSSL source file
    // (passed via originalConstants parameter) to identify and reverse these renames.
    //
    // Algorithm:
    // 1. Build map of all var declarations in bundled code: name → value
    // 2. For each var ending in a digit, strip the last char to get candidate original name
    // 3. If originalConstants has that name with the SAME value, it's a rename → restore it
    //
    // Why this is robust:
    // - Requires BOTH name pattern match AND exact value equality
    // - Not just regex pattern matching - uses actual constant values from source
    // - False positive scenario: original has `FOO=5` and `FOO2=5` (same value)
    //   This is rare and would require user to define two constants with same value
    //   where one name is the other plus a digit - unlikely in practice
    if (originalConstants && originalConstants.size > 0) {
        // Build map of var declarations in bundled code: name → initializer text
        const varDecls = new Map<string, string>();
        for (const stmt of sourceFile.getStatements()) {
            if (stmt.getKind() === SyntaxKind.VariableStatement) {
                const varStmt = stmt.asKind(SyntaxKind.VariableStatement);
                if (!varStmt) continue;
                for (const decl of varStmt.getDeclarationList().getDeclarations()) {
                    const name = decl.getName();
                    const init = decl.getInitializer();
                    if (init) {
                        varDecls.set(name, init.getText());
                    }
                }
            }
        }

        // Find renamed vars by matching against original constants
        for (const [bundledName, bundledValue] of varDecls) {
            // Only check names ending in digit (esbuild's rename pattern)
            // Uses simple regex /\d$/ - just checks last char is 0-9
            if (!/\d$/.test(bundledName)) continue;

            // Strip last character (the digit esbuild added)
            // Using slice, not regex - simple and predictable
            const baseName = bundledName.slice(0, -1);

            // Match requires BOTH conditions:
            // 1. baseName exists in original constants
            // 2. Value is exactly the same (string comparison of initializer text)
            // This prevents false positives from unrelated vars that happen to end in digits
            if (originalConstants.get(baseName) === bundledValue && !aliasMap.has(bundledName)) {
                aliasMap.set(bundledName, baseName);
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
 * Create an esbuild plugin that marks all modules as side-effect-free.
 * Enables aggressive tree-shaking for transpilers with no JS runtime.
 * https://github.com/evanw/esbuild/issues/1895
 */
export function noSideEffectsPlugin(): esbuild.Plugin {
    return {
        name: "no-side-effects",
        setup(build) {
            build.onResolve({ filter: /.*/ }, async args => {
                if (args.kind === 'entry-point') return null;
                // Use pluginData to prevent infinite recursion
                if (args.pluginData?.fromNoSideEffectsPlugin) return null;
                const result = await build.resolve(args.path, {
                    resolveDir: args.resolveDir,
                    kind: args.kind,
                    pluginData: { fromNoSideEffectsPlugin: true },
                });
                if (result.errors.length > 0) return result;
                return { ...result, sideEffects: false };
            });
        },
    };
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
