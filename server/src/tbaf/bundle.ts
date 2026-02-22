/**
 * TBAF Bundler
 *
 * Uses esbuild for in-memory bundling.
 * Handles enum transformation before bundling to avoid esbuild's IIFE conversion.
 *
 * Externalization strategy (same as TSSL bundler):
 * - Only `.d.ts` imports are externalized (engine builtins/declarations).
 * - Bare imports (e.g., "ielib") are bundled so enum values get resolved at
 *   transpile time.
 *
 * IMPORTANT: External libraries (ielib, folib) must use NAMED re-exports, not
 * `export * from`. esbuild cannot statically enumerate exports from externalized
 * `.d.ts` modules behind `export *`, falling back to runtime `__reExport` helpers
 * that break downstream transpilers. Named re-exports let esbuild resolve each
 * binding statically. See folib's index.ts for the correct pattern.
 */

import * as esbuild from "esbuild-wasm";
import * as path from "path";
import * as fs from "fs";
import { ensureEsbuild, cleanupEsbuildOutput, noSideEffectsPlugin } from "../esbuild-utils";
import {
    transformEnums,
    expandEnumPropertyAccess,
    enumTransformPlugin,
    collectDeclareEnums,
    resolveDtsPath,
} from "../enum-transform";

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

    // Resolve symlinks so esbuild's absWorkingDir and sourcefile agree on real paths.
    // Without this, esbuild resolves absWorkingDir through symlinks but keeps sourcefile
    // as-is, producing deeply nested ../../../ relative paths in error messages.
    const realPath = fs.realpathSync(filePath);
    const resolveDir = path.dirname(realPath);

    // Pre-transform: convert enums to flat consts before esbuild sees them
    const { code: enumTransformed, enumNames } = transformEnums(sourceText);

    // Accumulate enum names from imported files during bundling.
    // Mutated via closure in the enum-transform plugin (see enumTransformPlugin docs).
    const allEnumNames = new Set(enumNames);

    // Accumulate externalized enum names from .d.ts files.
    // These are `declare enum` that esbuild drops — their property accesses
    // need prefix stripping (ClassID.ANKHEG → ANKHEG) in post-processing.
    const externalEnumNames = new Set<string>();

    // Prepend marker so we can strip esbuild runtime helpers later
    const sourceWithMarker = TBAF_CODE_MARKER + "\n" + enumTransformed;

    const result = await esbuild.build({
        stdin: {
            contents: sourceWithMarker,
            resolveDir,
            sourcefile: realPath,
            loader: "ts",
        },
        // Use the file's directory as working dir so error paths are relative to it,
        // not to process.cwd() (which in VSCode is the extension install directory).
        absWorkingDir: resolveDir,
        bundle: true,
        write: false,
        format: "esm",
        platform: "neutral",
        target: "esnext",
        minify: false,
        plugins: [
            // Mark .d.ts imports as external — they're engine builtins/declarations.
            // Bare imports (e.g., "ielib") are NOT externalized so esbuild can
            // bundle them, allowing enum values to be resolved at transpile time.
            // Also collects `declare enum` names from externalized files for
            // prefix stripping in post-processing (ClassID.ANKHEG → ANKHEG).
            {
                name: "external-declarations",
                setup(build) {
                    build.onResolve({ filter: /\.d(\.ts)?$/ }, (args) => {
                        // Read the .d.ts file to extract declare enum names.
                        // Resolve the path since import specifiers may omit .ts
                        // (e.g., './class.ids.d' → 'class.ids.d.ts' on disk).
                        const resolved = resolveDtsPath(path.resolve(args.resolveDir, args.path));
                        collectDeclareEnums(resolved, externalEnumNames);
                        return { path: args.path, external: true };
                    });
                },
            },
            // Resolve and load .tbaf imports as TypeScript, transforming enums.
            // No custom namespace — keeps resolution simple so noSideEffectsPlugin's
            // build.resolve() can use esbuild's default resolver for all imports.
            {
                name: "tbaf-resolver",
                setup(build) {
                    build.onResolve({ filter: /\.tbaf$/ }, (args) => ({
                        path: path.resolve(args.resolveDir, args.path),
                    }));

                    build.onLoad({ filter: /\.tbaf$/ }, (args) => {
                        const source = fs.readFileSync(args.path, "utf-8");
                        if (source.includes("enum ")) {
                            const { code, enumNames: importedEnums } = transformEnums(source);
                            for (const name of importedEnums) {
                                allEnumNames.add(name);
                            }
                            return { contents: code, loader: "ts" };
                        }
                        return { contents: source, loader: "ts" };
                    });
                },
            },
            // Transform enums in imported .ts files
            enumTransformPlugin(allEnumNames, /\.ts$/),
            // Resolve extensionless relative imports that esbuild can't handle.
            // esbuild only appends single extensions (.ts, .tsx, etc.) but not
            // compound extensions like .d.ts. Packages like ielib use extensionless
            // imports (e.g., "./actions") that resolve to .d.ts declaration files.
            // This plugin tries .d.ts and externalizes those (they're type-only),
            // and also tries .ts / index.ts for regular source files.
            {
                name: "ts-extension-resolver",
                setup(build) {
                    build.onResolve({ filter: /^\./ }, (args) => {
                        if (path.extname(args.path)) return null;
                        const base = path.resolve(args.resolveDir, args.path);
                        // .d.ts — declaration file, externalize it
                        if (fs.existsSync(base + ".d.ts")) {
                            collectDeclareEnums(base + ".d.ts", externalEnumNames);
                            return { path: args.path + ".d.ts", external: true };
                        }
                        // .ts — regular source, bundle it
                        if (fs.existsSync(base + ".ts")) return { path: base + ".ts" };
                        // index.ts — directory import
                        const indexTs = path.join(base, "index.ts");
                        if (fs.existsSync(indexTs)) return { path: indexTs };
                        return null;
                    });
                },
            },
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
    // and strip prefixes from externalized enum property accesses
    return expandEnumPropertyAccess(cleaned, allEnumNames, externalEnumNames);
}
