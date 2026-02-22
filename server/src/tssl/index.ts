/**
 * TSSL transpiler - TypeScript to Fallout SSL.
 * Transpiles TypeScript files with .tssl extension to Fallout SSL scripts.
 * Entry points:
 *   compile() - LSP: bundles, converts, writes .ssl file to disk
 *   transpile() - CLI: bundles, converts, returns SSL string without writing
 * Handles enum transformation before bundling to avoid esbuild's IIFE conversion.
 */

import * as fs from "fs";
import * as path from "path";
import {
    Project,
    SyntaxKind
} from 'ts-morph';
import * as esbuild from 'esbuild-wasm';
import { fileURLToPath } from "url";
import { EXT_TSSL } from "../core/languages";
import { ensureEsbuild, cleanupEsbuildOutput, noSideEffectsPlugin } from "../esbuild-utils";
import { conlog, type TsslContext, type MainFileData, type BundleResult } from './types';
import { convertOperatorsAST } from './convert-operators';
import { extractInlineFunctionsFromFiles, extractJsDocs } from './inline-functions';
import { exportSSL } from './export-ssl';
import { ENGINE_PROCEDURES } from './engine-procedures';
import {
    transformEnums,
    expandEnumPropertyAccess,
    enumTransformPlugin,
    collectDeclareEnums,
    resolveDtsPath,
} from "../enum-transform";
import { extractTraTag } from "../transpiler-utils";

const uriToPath = (uri: string) => uri.startsWith('file://') ? fileURLToPath(uri) : uri;

/** Marker to identify start of user code in esbuild output */
const TSSL_CODE_MARKER = "/* __TSSL_CODE_START__ */";

/**
 * Core transpilation pipeline: TSSL source text to SSL output string.
 * Shared by compile() (LSP, writes to disk) and transpile() (CLI, returns string).
 * @param filePath Absolute file path to the .tssl file
 * @param text Source text content
 * @returns Generated SSL output string
 */
async function transpileCore(filePath: string, text: string): Promise<string> {
    const parsed = path.parse(filePath);
    if (parsed.ext.toLowerCase() !== EXT_TSSL) {
        throw new Error(`${filePath} is not a .tssl file`);
    }

    // Extract @tra tag before bundling (esbuild strips comments)
    const traTag = extractTraTag(text);

    // Pre-transform: convert enums to flat consts before any processing
    const { code: enumTransformedText, enumNames } = transformEnums(text);

    // Initialize the TypeScript project (reused across extraction functions)
    const project = new Project();

    // Extract includes, constants, and let vars from the enum-transformed source
    const { constants, letVars } = extractTopLevelVars(project, enumTransformedText);
    const mainFileData: MainFileData = {
        constants,
        letVars,
        // Extract includes from original text (enums don't affect includes)
        includes: extractIncludes(text),
    };

    // Create context for this compilation (enumNames populated after bundling)
    const ctx: TsslContext = {
        inlineFunctions: new Map(),
        definedFunctions: new Set(),
        functionJsDocs: new Map(),
        doStatementCounter: 0,
        enumNames: new Set(),
    };

    // Extract JSDoc from main source file before bundling (esbuild strips them)
    const mainSource = project.addSourceFileAtPath(filePath);
    extractJsDocs(mainSource, ctx);
    conlog(`Extracted JSDoc for ${ctx.functionJsDocs.size} functions from main file`);

    const bundleResult = await bundle(filePath, enumTransformedText, enumNames);

    // All enum names (main file + imported files) for inline function expansion
    ctx.enumNames = bundleResult.allEnumNames;

    // Strip ESM module boilerplate from esbuild output
    const cleanedCode = cleanupEsbuildOutput(bundleResult.code, TSSL_CODE_MARKER, mainFileData.constants);

    // Post-expand: expand any remaining cross-file enum compat objects
    // and strip prefixes from externalized enum property accesses
    const bundledCode = expandEnumPropertyAccess(
        cleanedCode, bundleResult.allEnumNames, bundleResult.externalEnumNames,
    );

    // Create source file in memory from cleaned bundled code
    const sourceFile = project.createSourceFile("bundled.ts", bundledCode, { overwrite: true });

    // Extract inline functions from files that were actually bundled
    ctx.inlineFunctions = extractInlineFunctionsFromFiles(project, bundleResult.inputFiles);
    conlog(`Found ${ctx.inlineFunctions.size} inline functions`);

    return exportSSL(sourceFile, parsed.base, mainFileData, ctx, traTag);
}

/**
 * Convert TSSL to SSL, writing the output to disk.
 * Used by the LSP compile handler.
 * @param uri VSCode document URI or file path
 * @param text Source text content
 * @returns Path to generated SSL file
 */
export async function compile(uri: string, text: string): Promise<string> {
    const filePath = uriToPath(uri);
    const output = await transpileCore(filePath, text);

    const parsed = path.parse(filePath);
    const sslPath = path.join(parsed.dir, `${parsed.name}.ssl`);
    fs.writeFileSync(sslPath, output, 'utf-8');
    conlog(`Content saved to ${sslPath}`);

    return sslPath;
}

/**
 * Transpile TSSL to SSL, returning the output string without writing to disk.
 * Used by the CLI where the caller controls file I/O.
 * @param filePath Absolute file path to the .tssl file
 * @param text Source text content
 * @returns Generated SSL output string
 */
export async function transpile(filePath: string, text: string): Promise<string> {
    return transpileCore(filePath, text);
}

/**
 * Extract #include directives from magic comments.
 * Looks for lines like: // #include "path/to/header.h"
 * @param sourceText The original TypeScript source text
 * @returns Array of include paths
 */
function extractIncludes(sourceText: string): string[] {
    const includes: string[] = [];
    const regex = /^\/\/\s*#include\s+["']([^"']+)["']\s*$/gm;
    let match;
    while ((match = regex.exec(sourceText)) !== null) {
        const inc = match[1];
        if (inc) includes.push(inc);
    }
    return includes;
}

/**
 * Extract top-level constants and let variables from source.
 * Constants become #define, let variables become SSL variable declarations.
 * @param project ts-morph Project instance to reuse
 * @param sourceText The original TypeScript source text
 * @returns Object with constants map and letVars set
 */
function extractTopLevelVars(project: Project, sourceText: string): { constants: Map<string, string>; letVars: Set<string> } {
    const constants = new Map<string, string>();
    const letVars = new Set<string>();
    const tempSourceFile = project.createSourceFile("temp-vars.ts", sourceText, { overwrite: true });

    for (const stmt of tempSourceFile.getStatements()) {
        if (stmt.getKind() === SyntaxKind.VariableStatement) {
            const varStmt = stmt.asKind(SyntaxKind.VariableStatement);
            if (!varStmt) continue;

            const declList = varStmt.getDeclarationList();
            const keywordNode = declList.getFirstChild();
            const keywordKind = keywordNode ? keywordNode.getKind() : undefined;

            if (keywordKind === SyntaxKind.ConstKeyword) {
                for (const decl of declList.getDeclarations()) {
                    const name = decl.getName();
                    const initializer = decl.getInitializer();
                    if (initializer) {
                        // Skip compat objects (enum-generated `as const` objects)
                        // These have object literal initializers and shouldn't become #define
                        if (initializer.isKind(SyntaxKind.AsExpression) || initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
                            continue;
                        }
                        // Convert operators to SSL syntax (| -> bwor, etc.)
                        const value = convertOperatorsAST(initializer);
                        constants.set(name, value);
                    }
                }
            } else if (keywordKind === SyntaxKind.LetKeyword) {
                for (const decl of declList.getDeclarations()) {
                    letVars.add(decl.getName());
                }
            }
        }
    }

    return { constants, letVars };
}

/**
 * Extract function names that should be preserved from tree-shaking.
 * Includes engine procedures and any function passed to register_hook_proc.
 */
function extractPreserveFunctions(text: string): string[] {
    const preserve = [...ENGINE_PROCEDURES];
    // Extract functions passed to register_hook_proc or register_hook_proc_spec
    const hookRegex = /register_hook_proc(?:_spec)?\s*\([^,]+,\s*(\w+)\s*\)/g;
    let match;
    while ((match = hookRegex.exec(text)) !== null) {
        const fn = match[1];
        if (fn) preserve.push(fn);
    }
    return preserve;
}

/** Extended bundle result that includes accumulated enum names */
interface TsslBundleResult extends BundleResult {
    readonly allEnumNames: ReadonlySet<string>;
    readonly externalEnumNames: ReadonlySet<string>;
}

/**
 * Bundle functions with esbuild, returning bundled code and input files.
 * Transforms enums in imported files during bundling.
 *
 * @param filePath Original file path (for resolving imports)
 * @param text Source text (already enum-transformed)
 * @param enumNames Enum names from the main file
 * @returns Bundled code, input files, and all accumulated enum names
 */
async function bundle(filePath: string, text: string, enumNames: ReadonlySet<string>): Promise<TsslBundleResult> {
    const preserveFunctions = extractPreserveFunctions(text);

    // Accumulate enum names from imported files during bundling
    const allEnumNames = new Set(enumNames);

    // Accumulate externalized enum names from .d.ts files.
    // These are `declare enum` that esbuild drops — their property accesses
    // need prefix stripping (ClassID.ANKHEG → ANKHEG) in post-processing.
    const externalEnumNames = new Set<string>();

    // Prepend marker and append fake usage to preserve functions from tree-shaking
    const preserveCode = `\n// Preserve functions\nif ((globalThis as any).__preserve__) { console.log(${preserveFunctions.join(', ')}); }`;
    const sourceWithMarker = TSSL_CODE_MARKER + "\n" + text + preserveCode;

    await ensureEsbuild();
    // Resolve symlinks so esbuild's absWorkingDir and sourcefile agree on real paths.
    const realPath = fs.realpathSync(filePath);
    const resolveDir = path.dirname(realPath);
    const result = await esbuild.build({
        stdin: {
            contents: sourceWithMarker,
            resolveDir,
            sourcefile: path.basename(filePath).replace('.tssl', '.ts'),
            loader: 'ts',
        },
        // Use the file's directory as working dir so error paths are relative to it,
        // not to process.cwd() (which in VSCode is the extension install directory).
        absWorkingDir: resolveDir,
        bundle: true,
        write: false,  // Return output in memory
        metafile: true,  // Get list of input files
        format: 'esm',
        treeShaking: true,
        minify: false,
        keepNames: false,
        target: 'es2022',
        platform: 'neutral',
        plugins: [
            // Mark .d.ts imports as external — they're engine builtins.
            // Also collects `declare enum` names from externalized files for
            // prefix stripping in post-processing (ClassID.ANKHEG → ANKHEG).
            {
                name: 'external-declarations',
                setup(build: esbuild.PluginBuild) {
                    build.onResolve({ filter: /\.d(\.ts)?$/ }, (args: esbuild.OnResolveArgs) => {
                        const resolved = resolveDtsPath(path.resolve(args.resolveDir, args.path));
                        collectDeclareEnums(resolved, externalEnumNames);
                        return { path: args.path, external: true };
                    });
                }
            },
            // Transform enums in imported .ts/.tssl files
            enumTransformPlugin(allEnumNames, /\.(ts|tssl)$/),
            noSideEffectsPlugin(),
        ]
    });

    // write: false guarantees outputFiles is defined
    if (result.outputFiles.length === 0) {
        throw new Error('esbuild produced no output');
    }
    conlog(`Bundling complete!`);
    // Extract input files from metafile (only .ts files, not .d.ts).
    // metafile: true guarantees result.metafile is defined.
    // Metafile paths are relative to absWorkingDir — resolve to absolute so
    // extractInlineFunctionsFromFiles can find them regardless of process.cwd().
    const inputFiles = Object.keys(result.metafile.inputs)
        .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .map(f => path.resolve(resolveDir, f));
    const outputFile = result.outputFiles[0];
    if (outputFile === undefined) {
        throw new Error('esbuild produced no output');
    }
    return { code: outputFile.text, inputFiles, allEnumNames, externalEnumNames };
}
