/**
 * TBAF Bundler
 *
 * Uses esbuild for in-memory bundling.
 */

import * as esbuild from "esbuild-wasm";
import * as path from "path";
import * as fs from "fs";
import { ensureEsbuild, cleanupEsbuildOutput } from "../esbuild-utils";

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

    // Prepend marker so we can strip esbuild runtime helpers later
    const sourceWithMarker = TBAF_CODE_MARKER + "\n" + sourceText;

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
            // Plugin to resolve .tbaf files as TypeScript
            {
                name: "tbaf-resolver",
                setup(build) {
                    build.onResolve({ filter: /\.tbaf$/ }, (args) => {
                        const resolved = path.resolve(args.resolveDir, args.path);
                        return { path: resolved, namespace: "tbaf" };
                    });

                    build.onLoad({ filter: /.*/, namespace: "tbaf" }, (args) => {
                        const contents = fs.readFileSync(args.path, "utf-8");
                        return { contents, loader: "ts" };
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
        ],
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
        return cleanupEsbuildOutput(result.outputFiles[0].text, TBAF_CODE_MARKER);
    }

    throw new Error("esbuild produced no output");
}
