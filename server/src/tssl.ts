import * as fs from "fs";
import * as path from "path";
import {
    Project,
    SourceFile,
    SyntaxKind,
    Node
} from 'ts-morph';
import * as esbuild from 'esbuild-wasm';
import { fileURLToPath } from "url";
import { ensureEsbuild, cleanupEsbuildOutput } from "./esbuild-utils";

// Use console.log directly for CLI compatibility (conlog depends on LSP connection)
const conlog = console.log;

export const EXT_TSSL = ".tssl";
const uriToPath = (uri: string) => uri.startsWith('file://') ? fileURLToPath(uri) : uri;

/** Marker to identify start of user code in esbuild output */
const TSSL_CODE_MARKER = "/* __TSSL_CODE_START__ */";

// Inline function metadata: maps function name to its expansion
interface InlineFunc {
    targetFunc: string;  // Function being called, e.g., "sfall_func2" or "reg_anim_func"
    args: InlineArg[];   // Arguments in order, either param references or constants
    params: string[];    // Ordered parameter names from function signature
}

interface InlineArg {
    type: 'param' | 'constant';
    value: string;  // param name or constant value
}

/**
 * Context object passed through transpilation functions.
 * Replaces module-level globals for cleaner data flow.
 */
interface TsslContext {
    inlineFunctions: Map<string, InlineFunc>;
    definedFunctions: Set<string>;
    functionJsDocs: Map<string, string>;
    doStatementCounter: number;
}

/**
 * JavaScript built-ins that are not available in SSL runtime.
 * Usage of these will cause transpilation to fail.
 */
const FORBIDDEN_GLOBALS = new Set([
    'Object',
    'Array',
    'JSON',
    'Math',
    'Date',
    'Promise',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Symbol',
    'Reflect',
    'Proxy',
]);

/**
 * Data extracted from the main source file before bundling.
 * Grouped to reduce parameter count in function signatures.
 */
interface MainFileData {
    constants: Map<string, string>;
    letVars: Set<string>;
    includes: string[];
}


/**
 * How many lines to look backwards when searching for esbuild source comments.
 * esbuild inserts comments like "// node_modules/folib/sfall.ts" before bundled code.
 */
const SOURCE_COMMENT_LOOKBACK = 10;

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
    const bundledCode = cleanupEsbuildOutput(bundleResult.code, TSSL_CODE_MARKER);

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
        includes.push(match[1]);
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
                        // Convert operators to SSL syntax (| → bwor, etc.)
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
 * Extract function names that should be preserved from tree-shaking.
 * Includes engine procedures and any function passed to register_hook_proc.
 */
function extractPreserveFunctions(text: string): string[] {
    const preserve = [...ENGINE_PROCEDURES];
    // Extract functions passed to register_hook_proc or register_hook_proc_spec
    const hookRegex = /register_hook_proc(?:_spec)?\s*\([^,]+,\s*(\w+)\s*\)/g;
    let match;
    while ((match = hookRegex.exec(text)) !== null) {
        preserve.push(match[1]);
    }
    return preserve;
}

/**
 * Extract functions marked with @inline JSDoc tag from bundled source files.
 * Uses the list of input files from esbuild's metafile.
 * @param project ts-morph Project instance to reuse
 * @param inputFiles List of input file paths from esbuild metafile
 */
function extractInlineFunctionsFromFiles(project: Project, inputFiles: string[]): Map<string, InlineFunc> {
    const result = new Map<string, InlineFunc>();

    for (const filePath of inputFiles) {
        if (!fs.existsSync(filePath)) continue;
        const source = project.addSourceFileAtPath(filePath);
        extractInlineFunctionsFromSource(source, result);
    }

    return result;
}

function extractInlineFunctionsFromSource(source: SourceFile, result: Map<string, InlineFunc>) {
    for (const stmt of source.getStatements()) {
        if (stmt.getKind() !== SyntaxKind.FunctionDeclaration) continue;

        const func = stmt.asKind(SyntaxKind.FunctionDeclaration);
        if (!func) continue;

        // Check for @inline JSDoc tag
        const jsDocs = func.getJsDocs();
        const hasInlineTag = jsDocs.some(doc => doc.getText().includes('@inline'));
        if (!hasInlineTag) continue;

        const funcName = func.getName();
        if (!funcName) continue;

        // Extract the call from the body
        const body = func.getBody();
        if (!body) continue;

        // Get parameter names to identify which args are params vs constants
        const paramNames = new Set(func.getParameters().map(p => p.getName()));
        const params = func.getParameters().map(p => p.getName());

        let targetFunc: string | undefined;
        let inlineArgs: InlineArg[] = [];

        // Helper to extract call info
        const extractCallInfo = (call: Node) => {
            const callExpr = call.asKindOrThrow(SyntaxKind.CallExpression);
            targetFunc = callExpr.getExpression().getText();
            const args = callExpr.getArguments();

            for (const arg of args) {
                const argText = arg.getText();
                if (paramNames.has(argText)) {
                    inlineArgs.push({ type: 'param', value: argText });
                } else {
                    // Convert operators to SSL syntax (| → bwor, etc.)
                    inlineArgs.push({ type: 'constant', value: convertOperatorsAST(arg) });
                }
            }
        };

        // Look for return statement first
        const returnStmt = body.getFirstDescendantByKind(SyntaxKind.ReturnStatement);
        if (returnStmt) {
            let returnExpr = returnStmt.getExpression();
            // Unwrap AsExpression (e.g., `sfall_func2(...) as ObjectPtr`)
            if (returnExpr?.getKind() === SyntaxKind.AsExpression) {
                returnExpr = returnExpr.asKindOrThrow(SyntaxKind.AsExpression).getExpression();
            }
            if (returnExpr?.getKind() === SyntaxKind.CallExpression) {
                extractCallInfo(returnExpr);
            }
        } else {
            // Check for expression statement (void functions)
            const exprStmt = body.getFirstDescendantByKind(SyntaxKind.ExpressionStatement);
            if (exprStmt) {
                const expr = exprStmt.getExpression();
                if (expr.getKind() === SyntaxKind.CallExpression) {
                    extractCallInfo(expr);
                }
            }
        }

        if (!targetFunc) continue;

        result.set(funcName, { targetFunc, args: inlineArgs, params });
    }
}

/**
 * Generate #define macros from inline functions that are actually used.
 * @param inlineFuncs Map of function names to InlineFunc metadata
 * @param usedFuncs Set of function names that are actually called in the code
 * @returns Array of #define statements
 */
function generateInlineMacros(inlineFuncs: Map<string, InlineFunc>, usedFuncs: Set<string>): string[] {
    const macros: string[] = [];
    for (const [funcName, inline] of inlineFuncs) {
        if (!usedFuncs.has(funcName)) continue;
        const paramList = inline.params.length > 0 ? `(${inline.params.join(', ')})` : '';
        const argList = inline.args.map(a => a.value).join(', ');
        macros.push(`#define ${funcName}${paramList} ${inline.targetFunc}(${argList})`);
    }
    return macros;
}

/**
 * Find all inline functions that are actually used in the source file.
 */
function findUsedInlineFunctions(source: SourceFile, inlineFuncs: Map<string, InlineFunc>): Set<string> {
    const used = new Set<string>();

    function visit(node: Node) {
        if (node.getKind() === SyntaxKind.CallExpression) {
            const call = node.asKindOrThrow(SyntaxKind.CallExpression);
            const fnName = call.getExpression().getText();
            if (inlineFuncs.has(fnName)) {
                used.add(fnName);
            }
        }
        node.forEachChild(visit);
    }

    source.forEachChild(visit);
    return used;
}

/**
 * Extract JSDoc comments from a single source file for all functions.
 * This must be done before bundling since esbuild strips JSDoc.
 */
function extractJsDocs(sourceFile: SourceFile, ctx: TsslContext): void {
    sourceFile.getFunctions().forEach(func => {
        const name = func.getName();
        if (!name) return;

        const jsDocs = func.getJsDocs();
        if (jsDocs.length > 0) {
            // Keep the original JSDoc format - SSL supports it
            const jsDocText = jsDocs.map(doc => doc.getText()).join('\n');
            if (jsDocText) {
                ctx.functionJsDocs.set(name, jsDocText);
            }
        }
    });
}

interface BundleResult {
    code: string;
    inputFiles: string[];
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
        // Mark .d.ts imports as external - they're engine builtins
        plugins: [{
            name: 'external-declarations',
            setup(build) {
                build.onResolve({ filter: /\.d(\.ts)?$/ }, args => ({
                    path: args.path,
                    external: true
                }));
            }
        }]
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
        conlog(`Bundling complete!`);
        // Extract input files from metafile (only .ts files, not .d.ts)
        const inputFiles = result.metafile
            ? Object.keys(result.metafile.inputs).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
            : [];
        return { code: result.outputFiles[0].text, inputFiles };
    }
    throw new Error('esbuild produced no output');
}

interface SourceSection {
    source: string;
    defines: string[];
    variables: string[];
    declarations: string[];
    procedures: string[];
}

/**
 * Export typescript code as SSL
 * @param sourceFile ts-morph source file
 * @param sslPath output SSL path
 * @param sourceName tssl source name, to put into comment
 * @param mainFileData Data extracted from main file (constants, letVars, includes)
 * @param ctx Transpilation context
 */
function exportSSL(sourceFile: SourceFile, sslPath: string, sourceName: string, mainFileData: MainFileData, ctx: TsslContext): void {
    conlog(`Starting conversion of: ${sourceName}`);

    const header = `/* Do not edit. This file is generated from ${sourceName}. Make your changes there and regenerate this file. */\n\n`;
    const { sections } = processInput(sourceFile, mainFileData, ctx);
    let output = header;

    // Includes first to avoid redefinition warnings
    if (mainFileData.includes.length > 0) {
        for (const inc of mainFileData.includes) {
            output += `#include "${inc}"\n`;
        }
        output += '\n';
    }

    // Output main file constants (these may have been inlined/removed by bundler)
    if (mainFileData.constants.size > 0) {
        for (const [name, value] of mainFileData.constants) {
            output += `#define ${name} ${value}\n`;
        }
        output += '\n';
    }

    // Separate bundled vs main sections
    // Main file has sourceName (e.g., "foo.tssl" -> "foo.ts" in esbuild source comments)
    const mainFileMarker = sourceName.replace('.tssl', '.ts');
    const mainSections = sections.filter(s => s.source.includes(mainFileMarker));
    const bundledSections = sections.filter(s => !s.source.includes(mainFileMarker));

    // Collect all defines, declarations, variables, procedures
    const allDefines: string[] = [];
    const allDeclarations: string[] = [];
    const bundledVariables: string[] = [];
    const bundledProcedures: string[] = [];
    const mainVariables: string[] = [];
    const mainProcedures: string[] = [];

    for (const s of bundledSections) {
        allDefines.push(...s.defines);
        allDeclarations.push(...s.declarations);
        bundledVariables.push(...s.variables);
        bundledProcedures.push(...s.procedures);
    }
    for (const s of mainSections) {
        allDefines.push(...s.defines);
        allDeclarations.push(...s.declarations);
        mainVariables.push(...s.variables);
        mainProcedures.push(...s.procedures);
    }

    // Add inline function macros to defines (only for functions actually used)
    const usedInlineFuncs = findUsedInlineFunctions(sourceFile, ctx.inlineFunctions);
    const inlineMacros = generateInlineMacros(ctx.inlineFunctions, usedInlineFuncs);
    allDefines.push(...inlineMacros);

    // Output in order: defines, declarations, bundled code, main code
    if (allDefines.length > 0) output += allDefines.join('\n') + '\n\n';
    if (allDeclarations.length > 0) output += allDeclarations.join('\n') + '\n';
    if (bundledVariables.length > 0 || bundledProcedures.length > 0) {
        output += '\n/* ===== bundled ===== */\n';
        if (bundledVariables.length > 0) output += bundledVariables.join('\n') + '\n';
        if (bundledProcedures.length > 0) output += bundledProcedures.join('\n') + '\n';
        output += '/* ===== end bundled ===== */\n';
    }
    if (mainVariables.length > 0 || mainProcedures.length > 0) {
        output += '\n/* ===== main body ===== */\n';
        if (mainVariables.length > 0) output += mainVariables.join('\n') + '\n';
        if (mainProcedures.length > 0) output += mainProcedures.join('\n') + '\n';
        output += '/* ===== end main body ===== */\n';
    }

    // Replace sfall_typeof with typeof (TS keyword conflict workaround)
    output = output.replace(/\bsfall_typeof\b/g, 'typeof');

    // Write the content to the specified file
    fs.writeFileSync(sslPath, output, 'utf-8');
    conlog(`Content saved to ${sslPath}`);
}

/**
 * iterate over top level statements and print them
 * @param source ts-morph source file
 * @param mainFileData Data extracted from main file (constants, letVars, includes)
 * @param ctx Transpilation context
 * @returns sections grouped by source file
 */
function processInput(source: SourceFile, mainFileData: MainFileData, ctx: TsslContext): { sections: SourceSection[] } {
    const sections: SourceSection[] = [];
    let currentSection: SourceSection | null = null;

    // Build a set of defined function names
    ctx.definedFunctions.clear();
    for (const stmt of source.getStatements()) {
        if (stmt.getKind() === SyntaxKind.FunctionDeclaration) {
            const func = stmt.asKind(SyntaxKind.FunctionDeclaration);
            const name = func?.getName();
            if (name) {
                ctx.definedFunctions.add(name);
            }
        }
    }

    function getOrCreateSection(sourcePath: string): SourceSection {
        if (!currentSection || currentSection.source !== sourcePath) {
            currentSection = { source: sourcePath, defines: [], variables: [], declarations: [], procedures: [] };
            sections.push(currentSection);
        }
        return currentSection;
    }

    // Track current source from esbuild comments
    let currentSource = "unknown";
    const sourceText = source.getFullText();
    const lines = sourceText.split('\n');

    function updateSourceFromLine(stmtStart: number): void {
        const stmtLine = source.getLineAndColumnAtPos(stmtStart).line;
        // Look backwards from statement to find source comment (stmtLine is 1-based, lines is 0-based)
        // lines[stmtLine - 2] is the line immediately before the statement
        for (let i = stmtLine - 2; i >= 0 && i >= stmtLine - SOURCE_COMMENT_LOOKBACK; i--) {
            const line = lines[i]?.trim();
            if (line?.startsWith('// ') && (line.includes('/') || line.includes('.ts'))) {
                currentSource = line.substring(3);
                break;
            }
        }
    }

    for (const stmt of source.getStatements()) {
        updateSourceFromLine(stmt.getStart());
        const section = getOrCreateSection(currentSource);

        if (stmt.getKind() === SyntaxKind.VariableStatement) {
            const varStmt = stmt.asKind(SyntaxKind.VariableStatement);
            if (!varStmt) continue;
            const declList = varStmt.getDeclarationList();
            const keywordKind = declList.getFirstChild()?.getKind();

            for (const decl of declList.getDeclarations()) {
                const name = decl.getName();
                const init = decl.getInitializer();
                const initText = init ? convertOperatorsAST(init, ctx) : '';

                // const → #define
                // var (was const after esbuild) → #define, unless it's a main file let
                // let → variable
                // Skip entirely if this was a main file const (already output as #define)
                const isMainFileLetVar = mainFileData.letVars.has(name);
                const isMainFileConst = mainFileData.constants.has(name);
                if (isMainFileConst) {
                    // Skip - already output as #define from mainFileConstants
                } else if (keywordKind === SyntaxKind.ConstKeyword ||
                    (keywordKind === SyntaxKind.VarKeyword && !isMainFileLetVar)) {
                    section.defines.push(`#define ${name} ${initText}`);
                } else if (keywordKind === SyntaxKind.LetKeyword || keywordKind === SyntaxKind.VarKeyword) {
                    section.variables.push(`variable ${name}${initText ? ` = ${initText}` : ''};`);
                }
            }
        } else if (stmt.getKind() === SyntaxKind.FunctionDeclaration) {
            const func = stmt.asKind(SyntaxKind.FunctionDeclaration);
            if (!func) continue;
            const name = func.getName();

            // Skip inline functions - they are expanded at call sites, not emitted as procedures
            if (name && ctx.inlineFunctions.has(name)) continue;

            const paramsWithDefaults = func.getParameters().map(p => {
                const paramName = p.getName();
                const init = p.getInitializer();
                if (init) {
                    return `variable ${paramName} = ${convertOperatorsAST(init, ctx)}`;
                }
                return `variable ${paramName}`;
            }).join(", ");
            const params = func.getParameters().map(p => `variable ${p.getName()}`).join(", ");
            const body = func.getBody() ? processFunctionBody(func.getBody()!, "    ", ctx) : "";

            section.declarations.push(`procedure ${name}(${paramsWithDefaults});`);

            // Include JSDoc as SSL comment if available
            const jsDoc = name ? ctx.functionJsDocs.get(name) : undefined;
            const procCode = `procedure ${name}(${params}) begin\n${body ? body + '\n' : ''}end`;
            section.procedures.push(jsDoc ? `${jsDoc}\n${procCode}` : procCode);
        }
    }
    return { sections };
}

// ============================================================================
// Statement Handlers - each handles one TypeScript statement type
// ============================================================================

function handleIfStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const ifStmt = stmt.asKindOrThrow(SyntaxKind.IfStatement);
    const cond = convertOperatorsAST(ifStmt.getExpression(), ctx);
    const thenStmt = ifStmt.getThenStatement();
    let result = `${indent}if (${cond}) then begin\n`;
    result += processFunctionBody(thenStmt, indent + "    ", ctx);
    result += `\n${indent}end`;
    const elseStmt = ifStmt.getElseStatement();
    if (elseStmt) {
        result += ` else begin\n`;
        result += processFunctionBody(elseStmt, indent + "    ", ctx);
        result += `\n${indent}end`;
    }
    return result + `\n`;
}

function handleVariableStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const varStmt = stmt.asKind(SyntaxKind.VariableStatement);
    if (varStmt) {
        const declList = varStmt.getDeclarationList();
        const keywordNode = declList.getFirstChild();
        const keywordKind = keywordNode ? keywordNode.getKind() : undefined;
        if (keywordKind === SyntaxKind.LetKeyword || keywordKind === SyntaxKind.ConstKeyword) {
            const converted = convertVarOrConstToVariable(stmt, ctx).trim();
            return `${indent}${converted}\n`;
        }
    }
    return `${indent}${stmt.getText().trim()}\n`;
}

function handleExpressionStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const exprStmt = stmt.asKindOrThrow(SyntaxKind.ExpressionStatement);
    const expr = exprStmt.getExpression();
    if (expr.getKind() === SyntaxKind.CallExpression) {
        return `${indent}${processCallExpression(expr, ctx)};\n`;
    }
    const converted = convertOperatorsAST(expr, ctx);
    return `${indent}${converted};\n`;
}

function handleReturnStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const ret = stmt.asKindOrThrow(SyntaxKind.ReturnStatement);
    const expr = ret.getExpression();
    return `${indent}return${expr ? ' ' + convertOperatorsAST(expr, ctx) : ''};\n`;
}

function handleForStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const forStmt = stmt.asKindOrThrow(SyntaxKind.ForStatement);
    const init = forStmt.getInitializer();
    const cond = forStmt.getCondition();
    const incr = forStmt.getIncrementor();
    const body = forStmt.getStatement();

    let initStr = "";
    if (init) {
        if (init.getKind() === SyntaxKind.VariableDeclarationList) {
            const declList = init.asKindOrThrow(SyntaxKind.VariableDeclarationList);
            const decls = declList.getDeclarations();
            if (decls.length > 0) {
                const decl = decls[0];
                const name = decl.getName();
                const initializer = decl.getInitializer();
                initStr = `variable ${name} = ${initializer ? convertOperatorsAST(initializer, ctx) : '0'}`;
            }
        } else {
            initStr = convertOperatorsAST(init, ctx);
        }
    }

    const condStr = cond ? convertOperatorsAST(cond, ctx) : "true";
    const incrStr = incr ? convertOperatorsAST(incr, ctx) : "";

    let result = `${indent}for (${initStr}; ${condStr}; ${incrStr}) begin\n`;
    result += processFunctionBody(body, indent + "    ", ctx);
    return result + `\n${indent}end\n`;
}

function handleWhileStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const whileStmt = stmt.asKindOrThrow(SyntaxKind.WhileStatement);
    const cond = convertOperatorsAST(whileStmt.getExpression(), ctx);
    const body = whileStmt.getStatement();

    let result = `${indent}while (${cond}) do begin\n`;
    result += processFunctionBody(body, indent + "    ", ctx);
    return result + `\n${indent}end\n`;
}

function handleForEachStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const forStmt = stmt.getKind() === SyntaxKind.ForInStatement
        ? stmt.asKindOrThrow(SyntaxKind.ForInStatement)
        : stmt.asKindOrThrow(SyntaxKind.ForOfStatement);
    const init = forStmt.getInitializer();
    const expr = forStmt.getExpression();
    const body = forStmt.getStatement();

    let varPart = "";
    if (init.getKind() === SyntaxKind.VariableDeclarationList) {
        const declList = init.asKindOrThrow(SyntaxKind.VariableDeclarationList);
        const decls = declList.getDeclarations();
        if (decls.length > 0) {
            const decl = decls[0];
            const nameNode = decl.getNameNode();
            // Check for array destructuring: const [k, v] -> variable k: v
            if (nameNode.getKind() === SyntaxKind.ArrayBindingPattern) {
                const binding = nameNode.asKindOrThrow(SyntaxKind.ArrayBindingPattern);
                const elements = binding.getElements();
                if (elements.length === 2) {
                    const key = elements[0].asKind(SyntaxKind.BindingElement)?.getName() ?? elements[0].getText();
                    const val = elements[1].asKind(SyntaxKind.BindingElement)?.getName() ?? elements[1].getText();
                    varPart = `variable ${key}: ${val}`;
                } else {
                    throw new Error(`foreach destructuring must have exactly 2 elements, got ${elements.length}`);
                }
            } else {
                varPart = `variable ${decl.getName()}`;
            }
        }
    } else {
        varPart = init.getText();
    }

    let result = `${indent}foreach (${varPart} in ${convertOperatorsAST(expr, ctx)}) begin\n`;
    result += processFunctionBody(body, indent + "    ", ctx);
    return result + `\n${indent}end\n`;
}

function handleSwitchStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const switchStmt = stmt.asKindOrThrow(SyntaxKind.SwitchStatement);
    const expr = switchStmt.getExpression();
    const clauses = switchStmt.getCaseBlock().getClauses();
    const caseIndent = indent + "    ";
    const bodyIndent = indent + "        ";

    let result = `${indent}switch (${convertOperatorsAST(expr, ctx)}) begin\n`;
    for (const clause of clauses) {
        if (clause.getKind() === SyntaxKind.CaseClause) {
            const caseClause = clause.asKindOrThrow(SyntaxKind.CaseClause);
            const caseExpr = caseClause.getExpression();
            const statements = caseClause.getStatements();
            const filteredStmts = statements.filter(s => s.getKind() !== SyntaxKind.BreakStatement);
            result += `${caseIndent}case ${convertOperatorsAST(caseExpr, ctx)}:\n`;
            for (const s of filteredStmts) {
                result += processFunctionBody(s, bodyIndent, ctx) + "\n";
            }
        } else if (clause.getKind() === SyntaxKind.DefaultClause) {
            const defaultClause = clause.asKindOrThrow(SyntaxKind.DefaultClause);
            const statements = defaultClause.getStatements();
            const filteredStmts = statements.filter(s => s.getKind() !== SyntaxKind.BreakStatement);
            result += `${caseIndent}default:\n`;
            for (const s of filteredStmts) {
                result += processFunctionBody(s, bodyIndent, ctx) + "\n";
            }
        }
    }
    return result + `${indent}end\n`;
}

function handleDoStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const doStmt = stmt.asKindOrThrow(SyntaxKind.DoStatement);
    const cond = convertOperatorsAST(doStmt.getExpression(), ctx);
    const body = doStmt.getStatement();

    const varName = `__tssl_do_${ctx.doStatementCounter++}`;
    let result = `${indent}variable ${varName} = 1;\n`;
    result += `${indent}while (${varName} or (${cond})) do begin\n`;
    result += `${indent}    ${varName} = 0;\n`;
    result += processFunctionBody(body, indent + "    ", ctx);
    return result + `\n${indent}end\n`;
}

function handleTryStatement(stmt: Node, indent: string, ctx: TsslContext): string {
    const tryStmt = stmt.asKindOrThrow(SyntaxKind.TryStatement);
    const tryBlock = tryStmt.getTryBlock();
    conlog(`TSSL warning: try-catch not supported in SSL, catch block will be ignored`);
    let result = `${indent}/* TSSL: try-catch not supported in SSL, executing try block only */\n`;
    result += processFunctionBody(tryBlock, indent, ctx);
    return result + `\n`;
}

// ============================================================================
// Main function body processor
// ============================================================================

/**
 * Traverse the function body AST and convert statements to SSL syntax.
 */
function processFunctionBody(bodyNode: Node, indent: string = "", ctx: TsslContext): string {
    let stmts: Node[] = [];
    if (bodyNode.getKind() === SyntaxKind.Block) {
        stmts = bodyNode.asKindOrThrow(SyntaxKind.Block).getStatements();
    } else if (bodyNode.getKind() === SyntaxKind.CaseClause) {
        stmts = bodyNode.asKindOrThrow(SyntaxKind.CaseClause).getStatements();
    } else if (bodyNode.getKind() === SyntaxKind.DefaultClause) {
        stmts = bodyNode.asKindOrThrow(SyntaxKind.DefaultClause).getStatements();
    } else {
        stmts = [bodyNode];
    }

    let result = "";
    for (let i = 0; i < stmts.length; i++) {
        const stmt = stmts[i];
        const prevStmt = i > 0 ? stmts[i - 1] : null;

        // Add blank line between statements if they were on different source lines
        if (prevStmt && result.length > 0) {
            const prevLine = prevStmt.getEndLineNumber();
            const currLine = stmt.getStartLineNumber();
            if (currLine - prevLine > 1) {
                result += '\n';
            }
        }

        switch (stmt.getKind()) {
            case SyntaxKind.IfStatement:
                result += handleIfStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.VariableStatement:
                result += handleVariableStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.ExpressionStatement:
                result += handleExpressionStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.ReturnStatement:
                result += handleReturnStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.ForStatement:
                result += handleForStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.WhileStatement:
                result += handleWhileStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.ForInStatement:
            case SyntaxKind.ForOfStatement:
                result += handleForEachStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.SwitchStatement:
                result += handleSwitchStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.DoStatement:
                result += handleDoStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.TryStatement:
                result += handleTryStatement(stmt, indent, ctx);
                break;
            case SyntaxKind.ContinueStatement:
                result += `${indent}continue;\n`;
                break;
            case SyntaxKind.BreakStatement:
                result += `${indent}break;\n`;
                break;
            default:
                throw new Error(`Unhandled statement type: ${stmt.getKindName()}. Code: ${stmt.getText().substring(0, 100)}`);
                break;
        }
    }
    return result.trimEnd();
}

/**
 * Process a call expression and add 'call' keyword if needed
 * @param callExpr The call expression node
 * @param ctx Transpilation context
 * @returns The processed call expression as a string
 */
function processCallExpression(callExpr: Node, ctx: TsslContext): string {
    // We need to cast to the appropriate type
    const callExpression = callExpr.asKindOrThrow(SyntaxKind.CallExpression);

    // Get the expression being called (usually an identifier)
    const expression = callExpression.getExpression();

    // Get the arguments
    const args = callExpression.getArguments();

    // Get function name
    const fnName = expression.getText();

    // Convert arguments with operator conversion
    const processedArgs = args.map((arg: Node) => convertOperatorsAST(arg, ctx));

    // Check if this is a standalone call expression (not part of an assignment or return)
    const parent = callExpr.getParent();
    const isStandaloneCall = parent && parent.getKind() === SyntaxKind.ExpressionStatement;

    // Only add 'call' keyword if it's a standalone call AND the function is defined in our file (not inline)
    if (isStandaloneCall && ctx.definedFunctions.has(fnName) && !ctx.inlineFunctions.has(fnName)) {
        return `call ${fnName}(${processedArgs.join(', ')})`;
    }

    // For zero-arg inline macros, don't include parentheses
    const inlineFunc = ctx.inlineFunctions.get(fnName);
    if (args.length === 0 && inlineFunc?.params.length === 0) {
        return fnName;
    }

    // For zero-arg external function calls (not defined in this file), don't include parentheses
    // SSL doesn't use parens for zero-arg calls like get_light_level, game_loaded, etc.
    if (args.length === 0 && !ctx.definedFunctions.has(fnName)) {
        return fnName;
    }

    // Otherwise keep as is (either it's an external function or part of an assignment)
    return `${fnName}(${processedArgs.join(', ')})`;
}

/**
 * Converts a let or const VariableStatement node to a 'variable' statement, preserving formatting.
 *
 * @param stmt The ts-morph Node representing the VariableStatement.
 * @param ctx Transpilation context
 * @returns The converted 'variable' statement as a string.
 * @throws Error if the statement is not a let/const variable declaration.
 */
function convertVarOrConstToVariable(stmt: Node, ctx: TsslContext): string {
    const varStmt = stmt.asKind(SyntaxKind.VariableStatement);
    if (!varStmt) throw new Error("Statement is not a VariableStatement");

    const declList = varStmt.getDeclarationList();
    const keywordNode = declList.getFirstChild();
    const keywordKind = keywordNode ? keywordNode.getKind() : undefined;

    if (keywordKind !== SyntaxKind.LetKeyword && keywordKind !== SyntaxKind.ConstKeyword) {
        throw new Error("VariableStatement is not a let/const declaration");
    }

    // Use AST positions to do precise substitution
    let originalText = stmt.getText();
    const stmtStart = stmt.getStart();

    // Collect all replacements with their positions, then apply from end to start
    // to avoid position shifts
    const replacements: { start: number; end: number; text: string }[] = [];

    for (const decl of declList.getDeclarations()) {
        const initializer = decl.getInitializer();
        if (initializer) {
            const converted = convertOperatorsAST(initializer, ctx);
            if (converted !== initializer.getText()) {
                replacements.push({
                    start: initializer.getStart() - stmtStart,
                    end: initializer.getEnd() - stmtStart,
                    text: converted
                });
            }
        }
    }

    // Apply replacements from end to start
    replacements.sort((a, b) => b.start - a.start);
    for (const r of replacements) {
        originalText = originalText.substring(0, r.start) + r.text + originalText.substring(r.end);
    }

    // Get the position of the keyword in the source file
    const keywordPos = keywordNode!.getStart();
    const keywordEnd = keywordNode!.getEnd();
    const keywordRelativePos = keywordPos - stmt.getStart(); // Position within the statement text

    // Replace only the keyword exactly
    const beforeKeyword = originalText.substring(0, keywordRelativePos);
    const afterKeyword = originalText.substring(keywordRelativePos + (keywordEnd - keywordPos));
    let result = beforeKeyword + "variable" + afterKeyword;

    // Add semicolon at the end if needed (only if it doesn't already end with one)
    if (!result.trim().endsWith(';')) {
        const lastNonWhitespacePos = result.trimEnd().length;
        result = result.substring(0, lastNonWhitespacePos) + ";" + result.substring(lastNonWhitespacePos);
    }

    return result;
}

/**
 * Converts operators from TypeScript to SSL syntax using the AST
 * @param node The expression node containing operators to convert
 * @param ctx Optional transpilation context (not available during early extraction phases)
 * @returns The expression with converted operators
 */
function convertOperatorsAST(node: Node, ctx?: TsslContext): string {
    // Different handling based on node kind
    switch (node.getKind()) {
        case SyntaxKind.BinaryExpression: {
            const binary = node.asKindOrThrow(SyntaxKind.BinaryExpression);
            const operator = binary.getOperatorToken().getText();

            // Handle comma expression (0, expr) - just return the right side
            if (operator === ',') {
                return convertOperatorsAST(binary.getRight(), ctx);
            }

            const left = convertOperatorsAST(binary.getLeft(), ctx);
            const right = convertOperatorsAST(binary.getRight(), ctx);

            // Convert operator
            let sslOperator = operator;
            switch (operator) {
                case '&&': sslOperator = 'and'; break;
                case '||': sslOperator = 'or'; break;
                case '&': sslOperator = 'bwand'; break;
                case '|': sslOperator = 'bwor'; break;
                case '^': sslOperator = 'bxor'; break;
            }

            return `${left} ${sslOperator} ${right}`;
        }

        case SyntaxKind.PrefixUnaryExpression: {
            const prefix = node.asKindOrThrow(SyntaxKind.PrefixUnaryExpression);
            const operand = convertOperatorsAST(prefix.getOperand(), ctx);
            const operator = prefix.getOperatorToken();

            // Convert unary operator
            if (operator === SyntaxKind.ExclamationToken) {
                return `not ${operand}`;
            } else if (operator === SyntaxKind.TildeToken) {
                return `bnot ${operand}`;
            }

            // Other unary operators (++x, --x, -x, +x) remain as-is
            return prefix.getText();
        }

        case SyntaxKind.PostfixUnaryExpression: {
            const postfix = node.asKindOrThrow(SyntaxKind.PostfixUnaryExpression);
            const operand = convertOperatorsAST(postfix.getOperand(), ctx);
            const operator = postfix.getOperatorToken();

            // i++ and i-- work the same in SSL
            if (operator === SyntaxKind.PlusPlusToken) {
                return `${operand}++`;
            } else if (operator === SyntaxKind.MinusMinusToken) {
                return `${operand}--`;
            }

            return postfix.getText();
        }

        case SyntaxKind.ParenthesizedExpression: {
            const parens = node.asKindOrThrow(SyntaxKind.ParenthesizedExpression);
            const expression = convertOperatorsAST(parens.getExpression(), ctx);
            return `(${expression})`;
        }

        // Handle array literals
        case SyntaxKind.ArrayLiteralExpression: {
            const array = node.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
            const elements = array.getElements().map(element => convertOperatorsAST(element, ctx)).join(', ');
            return `[${elements}]`;
        }

        // Handle object literals
        case SyntaxKind.ObjectLiteralExpression: {
            const obj = node.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
            const properties = obj.getProperties().map(prop => {
                if (prop.getKind() === SyntaxKind.PropertyAssignment) {
                    const propAssignment = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
                    const nameNode = propAssignment.getNameNode();
                    const initNode = propAssignment.getInitializer();
                    const initializer = initNode ? convertOperatorsAST(initNode, ctx) : '';
                    // Handle computed property names: [PID_MINIGUN] -> PID_MINIGUN
                    if (nameNode.getKind() === SyntaxKind.ComputedPropertyName) {
                        const computed = nameNode.asKindOrThrow(SyntaxKind.ComputedPropertyName);
                        const expr = computed.getExpression();
                        return `${expr.getText()}: ${initializer}`;
                    }
                    // String literal key - already quoted, use as-is
                    if (nameNode.getKind() === SyntaxKind.StringLiteral) {
                        return `${nameNode.getText()}: ${initializer}`;
                    }
                    // Numeric literal key - no quotes needed
                    if (nameNode.getKind() === SyntaxKind.NumericLiteral) {
                        return `${nameNode.getText()}: ${initializer}`;
                    }
                    // Identifier key - add quotes
                    return `"${propAssignment.getName()}": ${initializer}`;
                }
                return prop.getText();
            }).join(', ');
            return `{${properties}}`;
        }

        // Handle conditional expressions (ternary)
        case SyntaxKind.ConditionalExpression: {
            const conditional = node.asKindOrThrow(SyntaxKind.ConditionalExpression);
            const condition = convertOperatorsAST(conditional.getCondition(), ctx);
            const whenTrue = convertOperatorsAST(conditional.getWhenTrue(), ctx);
            const whenFalse = convertOperatorsAST(conditional.getWhenFalse(), ctx);
            return `(${condition}) ? ${whenTrue} : ${whenFalse}`;
        }

        // Handle property access - strip folib_exports. prefix
        case SyntaxKind.PropertyAccessExpression: {
            const propAccess = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
            const obj = propAccess.getExpression().getText();
            const prop = propAccess.getName();

            // Check for forbidden globals
            if (FORBIDDEN_GLOBALS.has(obj)) {
                throw new Error(`${obj}.${prop} is not available in SSL runtime`);
            }

            // Strip folib_exports. or similar _exports. prefixes
            if (obj.endsWith('_exports')) {
                return prop;
            }
            return `${convertOperatorsAST(propAccess.getExpression(), ctx)}.${prop}`;
        }

        // Handle element access (array indexing) - need to process the index expression
        case SyntaxKind.ElementAccessExpression: {
            const elemAccess = node.asKindOrThrow(SyntaxKind.ElementAccessExpression);
            const obj = convertOperatorsAST(elemAccess.getExpression(), ctx);
            const arg = elemAccess.getArgumentExpression();
            const index = arg ? convertOperatorsAST(arg, ctx) : '';
            return `${obj}[${index}]`;
        }

        // Handle call expressions which might contain operators in arguments
        case SyntaxKind.CallExpression: {
            const call = node.asKindOrThrow(SyntaxKind.CallExpression);
            const callExpr = call.getExpression();
            const fnName = convertOperatorsAST(callExpr, ctx);
            const args = call.getArguments().map(arg => convertOperatorsAST(arg, ctx));

            // For zero-arg inline macros, don't use parentheses (only if ctx available)
            if (ctx) {
                const inlineFunc = ctx.inlineFunctions.get(fnName);
                if (args.length === 0 && inlineFunc?.params.length === 0) {
                    return fnName;
                }

                // In SSL, external functions (declarations) with no args don't use parentheses
                if (args.length === 0 && !ctx.definedFunctions.has(fnName)) {
                    return fnName;
                }
            }

            return `${fnName}(${args.join(', ')})`;
        }

        case SyntaxKind.NumericLiteral: {
            const text = node.getText();
            // Preserve float literals - if it has a decimal point, keep it
            // If it's an integer but was originally written as X.0, esbuild strips the .0
            // We can't recover that, but we can ensure numbers with decimals stay as floats
            if (text.includes('.')) {
                return text;
            }
            // For integers, just return as-is
            return text;
        }

        case SyntaxKind.Identifier: {
            const text = node.getText();
            // FLOAT1 is a special constant that forces float division
            // esbuild strips .0 from float literals, so we use FLOAT1 * a / b
            // to ensure float division in SSL output
            if (text === 'FLOAT1') return '1.0';
            return text;
        }

        default:
            // If no operators to convert, return the original text
            return node.getText();
    }
}
