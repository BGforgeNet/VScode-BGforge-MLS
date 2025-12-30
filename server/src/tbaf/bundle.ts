/**
 * TBAF Bundler
 *
 * Uses esbuild for in-memory bundling (replaces Rollup).
 */

import * as esbuild from "esbuild-wasm";
import * as path from "path";
import * as fs from "fs";
import { Project, SyntaxKind } from "ts-morph";

let esbuildInitialized = false;

/** Marker to identify start of user code in esbuild output */
const TBAF_CODE_MARKER = "/* __TBAF_CODE_START__ */";

/**
 * Initialize esbuild (must be called once before bundling).
 */
async function ensureEsbuild() {
    if (!esbuildInitialized) {
        await esbuild.initialize({});
        esbuildInitialized = true;
    }
}

/**
 * Bundle a TBAF file and its imports into a single TypeScript string.
 *
 * @param filePath Absolute path to the .tbaf file
 * @param sourceText Content of the .tbaf file
 * @returns Bundled TypeScript code
 */
export async function bundle(filePath: string, sourceText: string): Promise<string> {
    await ensureEsbuild();

    const resolveDir = path.dirname(filePath);

    // Prepend marker so we can strip esbuild runtime helpers later
    const sourceWithMarker = TBAF_CODE_MARKER + "\n" + sourceText;

    // Create a virtual entry point
    const result = await esbuild.build({
        stdin: {
            contents: sourceWithMarker,
            resolveDir,
            sourcefile: filePath,
            loader: "ts",
        },
        bundle: true,
        write: false,
        format: "esm",
        platform: "neutral",
        target: "esnext",
        // Don't minify - we need readable output for transformation
        minify: false,
        plugins: [
            // Mark node_modules as external
            {
                name: "external-node-modules",
                setup(build) {
                    build.onResolve({ filter: /.*/ }, (args) => {
                        // External if it's in node_modules or is a bare import (no ./ or ../)
                        if (args.path.includes("node_modules")) {
                            return { path: args.path, external: true };
                        }
                        // Bare imports (not starting with . or /) are likely from node_modules
                        if (!args.path.startsWith(".") && !args.path.startsWith("/") && !args.path.endsWith(".tbaf") && !args.path.endsWith(".ts")) {
                            return { path: args.path, external: true };
                        }
                        return null; // Let other resolvers handle it
                    });
                },
            },
            // Plugin to resolve .tbaf files as TypeScript
            {
                name: "tbaf-resolver",
                setup(build) {
                    // Resolve .tbaf imports
                    build.onResolve({ filter: /\.tbaf$/ }, (args) => {
                        const resolved = path.resolve(args.resolveDir, args.path);
                        return { path: resolved, namespace: "tbaf" };
                    });

                    // Load .tbaf files as TypeScript
                    build.onLoad({ filter: /.*/, namespace: "tbaf" }, (args) => {
                        const contents = fs.readFileSync(args.path, "utf-8");
                        return { contents, loader: "ts" };
                    });

                    // Also handle .ts imports that might exist
                    build.onResolve({ filter: /\.ts$/ }, (args) => {
                        const resolved = path.resolve(args.resolveDir, args.path);
                        if (fs.existsSync(resolved)) {
                            return { path: resolved };
                        }
                        return null;
                    });
                },
            },
        ],
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
        let output = result.outputFiles[0].text;

        // Strip everything before our marker (esbuild runtime helpers like __defProp, __name)
        const markerIndex = output.indexOf(TBAF_CODE_MARKER);
        if (markerIndex !== -1) {
            output = output.substring(markerIndex + TBAF_CODE_MARKER.length).trimStart();
        }

        // Clean up esbuild's import aliasing and name collision renaming
        output = cleanupEsbuildOutput(output);

        return output;
    }

    throw new Error("esbuild produced no output");
}

/**
 * Clean up esbuild output by handling import aliases and collision renaming.
 * esbuild renames identifiers when there are name collisions (e.g., See → See2).
 */
function cleanupEsbuildOutput(bundledCode: string): string {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("esbuild-output.ts", bundledCode);

    // Build alias map from import statements
    // import { See as See2 } → See2 should become See
    const aliasMap = new Map<string, string>();
    for (const importDecl of sourceFile.getImportDeclarations()) {
        for (const named of importDecl.getNamedImports()) {
            const alias = named.getAliasNode();
            if (alias) {
                // import { original as alias } → alias should become original
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
        // Look for alias + digits pattern in identifiers
        for (const id of allIdentifiers) {
            if (id.startsWith(alias) && id !== alias && /^\d+$/.test(id.slice(alias.length))) {
                if (!aliasMap.has(id)) {
                    // Add mapping for the collision-renamed identifier
                    aliasMap.set(id, alias);
                    // Remove the original alias mapping - 'alias' is the real function name
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
