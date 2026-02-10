/**
 * TBAF Bundler
 *
 * Uses esbuild for in-memory bundling.
 * Handles enum transformation before bundling to avoid esbuild's IIFE conversion.
 */

import * as esbuild from "esbuild-wasm";
import * as path from "path";
import * as fs from "fs";
import { ensureEsbuild, cleanupEsbuildOutput, noSideEffectsPlugin } from "../esbuild-utils";
import { transformEnums, expandEnumPropertyAccess, enumTransformPlugin } from "../enum-transform";

/** Marker to identify start of user code in esbuild output */
const TBAF_CODE_MARKER = "/* __TBAF_CODE_START__ */";

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

    // Pre-transform: convert enums to flat consts before esbuild sees them
    const { code: enumTransformed, enumNames } = transformEnums(sourceText);

    // Accumulate enum names from imported files during bundling.
    // Mutated via closure in the enum-transform plugin (see enumTransformPlugin docs).
    const allEnumNames = new Set(enumNames);

    // Prepend marker so we can strip esbuild runtime helpers later
    const sourceWithMarker = TBAF_CODE_MARKER + "\n" + enumTransformed;

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
        minify: false,
        plugins: [
            // Mark node_modules as external
            {
                name: "external-node-modules",
                setup(build) {
                    build.onResolve({ filter: /.*/ }, (args) => {
                        if (args.path.includes("node_modules")) {
                            return { path: args.path, external: true };
                        }
                        // Bare imports (not starting with . or /) are likely from node_modules
                        if (!args.path.startsWith(".") && !args.path.startsWith("/") && !args.path.endsWith(".tbaf") && !args.path.endsWith(".ts")) {
                            return { path: args.path, external: true };
                        }
                        return null;
                    });
                },
            },
            // Plugin to resolve .tbaf files as TypeScript and transform enums in imports
            {
                name: "tbaf-resolver",
                setup(build) {
                    build.onResolve({ filter: /\.tbaf$/ }, (args) => {
                        const resolved = path.resolve(args.resolveDir, args.path);
                        return { path: resolved, namespace: "tbaf" };
                    });

                    build.onLoad({ filter: /.*/, namespace: "tbaf" }, (args) => {
                        const source = fs.readFileSync(args.path, "utf-8");
                        // Transform enums in imported .tbaf files
                        if (source.includes("enum ")) {
                            const { code, enumNames: importedEnums } = transformEnums(source);
                            for (const name of importedEnums) {
                                allEnumNames.add(name);
                            }
                            return { contents: code, loader: "ts" };
                        }
                        return { contents: source, loader: "ts" };
                    });

                    build.onResolve({ filter: /\.ts$/ }, (args) => {
                        const resolved = path.resolve(args.resolveDir, args.path);
                        if (fs.existsSync(resolved)) {
                            return { path: resolved };
                        }
                        return null;
                    });
                },
            },
            // Transform enums in imported .ts files
            enumTransformPlugin(allEnumNames, /\.ts$/),
            noSideEffectsPlugin(),
        ],
    });

    // write: false guarantees outputFiles exists, but array might be empty
    const outputFile = result.outputFiles[0];
    if (outputFile === undefined) {
        throw new Error("esbuild produced no output");
    }

    const cleaned = cleanupEsbuildOutput(outputFile.text, TBAF_CODE_MARKER);

    // Post-expand: expand any remaining cross-file enum compat objects
    return expandEnumPropertyAccess(cleaned, allEnumNames);
}
