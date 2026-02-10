/**
 * Enum transformation for TSSL and TBAF/TD transpilers.
 *
 * Transforms TypeScript enum declarations into flat const declarations before
 * esbuild bundling. This avoids esbuild's IIFE conversion of enums, which
 * neither transpiler can handle.
 *
 * EnumName.Member -> EnumName_Member (prefixed naming)
 */

import * as fs from "fs";
import * as esbuild from "esbuild-wasm";
import { Project, SyntaxKind, type EnumDeclaration, type SourceFile } from "ts-morph";

/** Result of transforming enums in source text */
export interface EnumTransformResult {
    /** Transformed source code (unchanged if no enums found) */
    readonly code: string;
    /** Set of enum names found and transformed */
    readonly enumNames: ReadonlySet<string>;
}

/**
 * Transform enum declarations into flat const declarations.
 *
 * For each enum:
 * 1. Generates `const EnumName_Member = value;` for each member
 * 2. Generates `const EnumName = { Member: value, ... } as const;` (compat object)
 * 3. Replaces `EnumName.Member` property accesses with `EnumName_Member`
 *
 * @param sourceText TypeScript source text
 * @returns Transformed code and set of enum names
 */
export function transformEnums(sourceText: string): EnumTransformResult {
    // Fast path: no enums in source
    if (!sourceText.includes("enum ")) {
        return { code: sourceText, enumNames: new Set() };
    }

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("enum-transform.ts", sourceText);

    const enumDecls = sourceFile.getEnums();

    // Fast path: enum keyword found in text but no actual enum declarations
    if (enumDecls.length === 0) {
        return { code: sourceText, enumNames: new Set() };
    }

    // Collect enum info before modifying AST
    const enumInfos = collectEnumInfo(enumDecls);

    // Replace enum declarations with flat consts (in reverse to preserve positions)
    replaceEnumDeclarations(enumDecls, enumInfos);

    // After replaceEnumDeclarations, individual enum nodes are stale but the
    // sourceFile itself remains valid. getDescendantsOfKind re-walks the current tree.
    replaceEnumPropertyAccesses(sourceFile, enumInfos);

    const enumNames = new Set(enumInfos.map(e => e.name));
    return { code: sourceFile.getFullText(), enumNames };
}

/** Collected info about a single enum */
interface EnumInfo {
    readonly name: string;
    readonly isExported: boolean;
    readonly members: ReadonlyArray<{ readonly name: string; readonly value: string }>;
}

/**
 * Collect enum names, members, and values before modifying the AST.
 * Skips `declare enum` declarations.
 */
function collectEnumInfo(enumDecls: readonly EnumDeclaration[]): readonly EnumInfo[] {
    const infos: EnumInfo[] = [];

    for (const enumDecl of enumDecls) {
        // Skip declare enum (ambient declarations)
        if (enumDecl.hasDeclareKeyword()) {
            continue;
        }

        const name = enumDecl.getName();
        const isExported = enumDecl.isExported();
        const members: Array<{ name: string; value: string }> = [];

        for (const member of enumDecl.getMembers()) {
            const memberName = member.getName();
            const value = member.getValue();

            if (value === undefined) {
                // Should not happen with ts-morph's auto-increment, but handle gracefully
                members.push({ name: memberName, value: "0" });
            } else if (typeof value === "string") {
                members.push({ name: memberName, value: JSON.stringify(value) });
            } else {
                members.push({ name: memberName, value: String(value) });
            }
        }

        infos.push({ name, isExported, members });
    }

    return infos;
}

/**
 * Replace each enum declaration with flat const declarations and a compat object.
 * Processes in reverse order to preserve source positions.
 */
function replaceEnumDeclarations(
    enumDecls: readonly EnumDeclaration[],
    enumInfos: readonly EnumInfo[],
): void {
    // Build a map from enum name to info for lookup
    const infoByName = new Map(enumInfos.map(e => [e.name, e]));

    // Process in reverse to preserve positions
    for (let i = enumDecls.length - 1; i >= 0; i--) {
        const enumDecl = enumDecls[i]!;
        const info = infoByName.get(enumDecl.getName());

        if (!info) {
            // This is a declare enum - skip
            continue;
        }

        const exportPrefix = info.isExported ? "export " : "";
        const lines: string[] = [];

        // Flat const per member
        for (const member of info.members) {
            lines.push(`${exportPrefix}const ${info.name}_${member.name} = ${member.value};`);
        }

        // Compat object for cross-file imports
        if (info.members.length > 0) {
            const entries = info.members.map(m => `${m.name}: ${m.value}`).join(", ");
            lines.push(`${exportPrefix}const ${info.name} = { ${entries} } as const;`);
        } else {
            lines.push(`${exportPrefix}const ${info.name} = {} as const;`);
        }

        enumDecl.replaceWithText(lines.join("\n"));
    }
}

/**
 * Replace all `EnumName.Member` property accesses with `EnumName_Member`.
 * Only matches direct Identifier.property patterns (not nested like Obj.Enum.Member).
 */
function replaceEnumPropertyAccesses(
    sourceFile: SourceFile,
    enumInfos: readonly EnumInfo[],
): void {
    // Build lookup: enum name -> set of member names
    const memberLookup = new Map<string, Set<string>>();
    for (const info of enumInfos) {
        memberLookup.set(info.name, new Set(info.members.map(m => m.name)));
    }

    // Find and replace property accesses
    // Process in reverse to preserve positions
    const accesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    for (let i = accesses.length - 1; i >= 0; i--) {
        const access = accesses[i]!;
        const expr = access.getExpression();

        // Only match direct identifier access (not chained like a.b.c)
        if (!expr.isKind(SyntaxKind.Identifier)) {
            continue;
        }

        const objName = expr.getText();
        const propName = access.getName();
        const members = memberLookup.get(objName);

        if (members && members.has(propName)) {
            access.replaceWithText(`${objName}_${propName}`);
        }
    }
}

/**
 * Expand enum compat objects in post-bundled code.
 *
 * After esbuild bundles cross-file imports, enum compat objects appear as
 * variable declarations with object literal initializers.
 *
 * This function:
 * 1. Replaces those var/let/const statements with individual `var EnumName_Member = value;`
 * 2. Replaces remaining `EnumName.Member` property accesses with `EnumName_Member`
 *
 * @param code Post-bundled code from esbuild
 * @param enumNames Set of enum names to look for
 * @returns Expanded code
 */
export function expandEnumPropertyAccess(code: string, enumNames: ReadonlySet<string>): string {
    // Fast path: no enum names to expand
    if (enumNames.size === 0) {
        return code;
    }

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("expand-enum.ts", code);

    // First pass: collect which enum members are actually referenced as EnumName.Member
    const referencedMembers = new Map<string, Set<string>>();
    for (const access of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
        const expr = access.getExpression();
        if (!expr.isKind(SyntaxKind.Identifier)) {
            continue;
        }
        const objName = expr.getText();
        if (!enumNames.has(objName)) {
            continue;
        }
        if (!referencedMembers.has(objName)) {
            referencedMembers.set(objName, new Set());
        }
        referencedMembers.get(objName)!.add(access.getName());
    }

    const expandedInfos: EnumInfo[] = [];

    // Second pass: find compat object declarations and replace with only referenced members
    const stmts = sourceFile.getStatements();
    for (let i = stmts.length - 1; i >= 0; i--) {
        const stmt = stmts[i]!;
        if (!stmt.isKind(SyntaxKind.VariableStatement)) {
            continue;
        }

        const varStmt = stmt.asKind(SyntaxKind.VariableStatement)!;
        const decls = varStmt.getDeclarationList().getDeclarations();

        // Only handle single-declaration statements to avoid destroying sibling vars.
        // esbuild always outputs one var per statement, so this is safe.
        if (decls.length !== 1) {
            continue;
        }

        const decl = decls[0]!;
        const name = decl.getName();
        if (!enumNames.has(name)) {
            continue;
        }

        const init = decl.getInitializer();
        if (!init || !init.isKind(SyntaxKind.ObjectLiteralExpression)) {
            continue;
        }

        const usedMembers = referencedMembers.get(name);

        // No members referenced — remove the compat object entirely
        if (!usedMembers || usedMembers.size === 0) {
            varStmt.remove();
            continue;
        }

        const objLiteral = init.asKind(SyntaxKind.ObjectLiteralExpression)!;
        const members: Array<{ name: string; value: string }> = [];

        for (const prop of objLiteral.getProperties()) {
            if (prop.isKind(SyntaxKind.PropertyAssignment)) {
                const propAssign = prop.asKind(SyntaxKind.PropertyAssignment)!;
                const memberName = propAssign.getName();
                // Only include members that are actually referenced
                if (!usedMembers.has(memberName)) {
                    continue;
                }
                const memberInit = propAssign.getInitializer();
                if (memberInit) {
                    members.push({ name: memberName, value: memberInit.getText() });
                }
            }
        }

        expandedInfos.push({ name, isExported: false, members });

        // Replace var statement with individual declarations for referenced members only
        const lines = members.map(m => `var ${name}_${m.name} = ${m.value};`);
        varStmt.replaceWithText(lines.join("\n"));
    }

    // Replace property accesses for expanded enums
    if (expandedInfos.length > 0) {
        replaceEnumPropertyAccesses(sourceFile, expandedInfos);
    }

    return sourceFile.getFullText();
}

/**
 * Create an esbuild plugin that transforms enums in loaded files.
 * Accumulates discovered enum names into the provided mutable set.
 *
 * @param allEnumNames Mutable set to accumulate enum names into.
 *   Mutated via closure because esbuild's plugin API provides no other way
 *   to communicate data back to the caller.
 * @param filter File filter regex for the onLoad handler
 * @returns esbuild plugin
 */
export function enumTransformPlugin(allEnumNames: Set<string>, filter: RegExp): esbuild.Plugin {
    return {
        name: "enum-transform",
        setup(build: esbuild.PluginBuild) {
            build.onLoad({ filter }, (args: esbuild.OnLoadArgs) => {
                // Skip .d.ts files (type declarations, not user code)
                if (args.path.endsWith(".d.ts")) {
                    return null;
                }
                let source: string;
                try {
                    source = fs.readFileSync(args.path, "utf-8");
                } catch {
                    return null;
                }
                if (!source.includes("enum ")) {
                    return null;
                }
                const { code, enumNames: importedEnums } = transformEnums(source);
                for (const name of importedEnums) {
                    allEnumNames.add(name);
                }
                return { contents: code, loader: "ts" };
            });
        },
    };
}
