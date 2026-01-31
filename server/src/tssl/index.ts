/**
 * TSSL transpiler - TypeScript to Fallout SSL.
 * Transpiles TypeScript files with .tssl extension to Fallout SSL scripts.
 * Entry point: compile() bundles and converts a .tssl file to .ssl output.
 */

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

const uriToPath = (uri: string) => uri.startsWith('file://') ? fileURLToPath(uri) : uri;

/** Marker to identify start of user code in esbuild output */
const TSSL_CODE_MARKER = "/* __TSSL_CODE_START__ */";

/**
 * Standard Fallout script procedures called by the engine.
 * These must be preserved from tree-shaking.
 */
const ENGINE_PROCEDURES = [
    'barter_init_p_proc',
    'barter_p_proc',
    'combat_p_proc',
    'create_p_proc',
    'critter_p_proc',
    'damage_p_proc',
    'description_p_proc',
    'destroy_p_proc',
    'drop_p_proc',
    'look_at_p_proc',
    'map_enter_p_proc',
    'map_exit_p_proc',
    'map_update_p_proc',
    'pickup_p_proc',
    'spatial_p_proc',
    'start',
    'talk_p_proc',
    'timed_event_p_proc',
    'use_ad_on_p_proc',
    'use_disad_on_p_proc',
    'use_obj_on_p_proc',
    'use_p_proc',
    'use_skill_on_p_proc',
];

/**
 * Convert TSSL to SSL.
 * @param uri VSCode document URI or file path
 * @param text Source text content
 * @returns Path to generated SSL file
 */
export async function compile(uri: string, text: string): Promise<string> {
    const filePath = uriToPath(uri);
    const parsed = path.parse(filePath);
    if (parsed.ext.toLowerCase() != EXT_TSSL) {
        throw new Error(`${uri} is not a .tssl file`);
    }

    // Initialize the TypeScript project (reused across extraction functions)
    const project = new Project();

    // Extract includes, constants, and let vars from the original source
    const { constants, letVars } = extractTopLevelVars(project, text);
    const mainFileData: MainFileData = {
        constants,
        letVars,
        includes: extractIncludes(text),
    };

    // Create context for this compilation
    const ctx: TsslContext = {
        inlineFunctions: new Map(),
        definedFunctions: new Set(),
        functionJsDocs: new Map(),
        doStatementCounter: 0,
    };

    // Extract JSDoc from main source file before bundling (esbuild strips them)
    const mainSource = project.addSourceFileAtPath(filePath);
    extractJsDocs(mainSource, ctx);
    conlog(`Extracted JSDoc for ${ctx.functionJsDocs.size} functions from main file`);

    const bundleResult = await bundle(filePath, text);

    // Strip ESM module boilerplate from esbuild output
    const bundledCode = cleanupEsbuildOutput(bundleResult.code, TSSL_CODE_MARKER, mainFileData.constants);

    // Create source file in memory from cleaned bundled code
    const sourceFile = project.createSourceFile("bundled.ts", bundledCode, { overwrite: true });

    // Extract inline functions from files that were actually bundled
    ctx.inlineFunctions = extractInlineFunctionsFromFiles(project, bundleResult.inputFiles);
    conlog(`Found ${ctx.inlineFunctions.size} inline functions`);

    // Save to SSL file, same directory
    const sslPath = path.join(parsed.dir, `${parsed.name}.ssl`);
    exportSSL(sourceFile, sslPath, parsed.base, mainFileData, ctx);

    return sslPath;
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

/**
 * Bundle functions with esbuild, returning bundled code and input files.
 * @param filePath Original file path (for resolving imports)
 * @param text Source text
 * @returns Bundled code and list of input files from metafile
 */
async function bundle(filePath: string, text: string): Promise<BundleResult> {
    const preserveFunctions = extractPreserveFunctions(text);

    // Prepend marker and append fake usage to preserve functions from tree-shaking
    const preserveCode = `\n// Preserve functions\nif ((globalThis as any).__preserve__) { console.log(${preserveFunctions.join(', ')}); }`;
    const sourceWithMarker = TSSL_CODE_MARKER + "\n" + text + preserveCode;

    await ensureEsbuild();
    const result = await esbuild.build({
        stdin: {
            contents: sourceWithMarker,
            resolveDir: path.dirname(filePath),
            sourcefile: path.basename(filePath).replace('.tssl', '.ts'),
            loader: 'ts',
        },
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
            // Mark .d.ts imports as external - they're engine builtins
            {
                name: 'external-declarations',
                setup(build: esbuild.PluginBuild) {
                    build.onResolve({ filter: /\.d(\.ts)?$/ }, (args: esbuild.OnResolveArgs) => ({
                        path: args.path,
                        external: true
                    }));
                }
            },
            noSideEffectsPlugin(),
        ]
    });

    // write: false guarantees outputFiles is defined
    if (result.outputFiles.length === 0) {
        throw new Error('esbuild produced no output');
    }
    conlog(`Bundling complete!`);
    // Extract input files from metafile (only .ts files, not .d.ts)
    // metafile: true guarantees result.metafile is defined
    const inputFiles = Object.keys(result.metafile.inputs).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));
    const outputFile = result.outputFiles[0];
    if (outputFile === undefined) {
        throw new Error('esbuild produced no output');
    }
    return { code: outputFile.text, inputFiles };
}
