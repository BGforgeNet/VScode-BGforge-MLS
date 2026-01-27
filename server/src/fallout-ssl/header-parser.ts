/**
 * Fallout SSL header parsing utilities.
 * Handles regex-based parsing of .h files for procedures, macros, and definitions.
 *
 * Main API: parseHeaderToSymbols() - Returns IndexedSymbol[] for unified storage.
 */

import { CompletionItemKind, type Location } from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver/node";
import { type RegExpMatchArrayWithIndices } from "../common";
import { computeDisplayPath } from "../core/location-utils";
import type { CallableSymbol, ConstantSymbol, IndexedSymbol } from "../core/symbol";
import { ScopeLevel, SourceType, SymbolKind } from "../core/symbol";
import * as definition from "../shared/definition";
import * as jsdoc from "../shared/jsdoc";
import { jsdocToDetail } from "../shared/jsdoc-utils";
import { type MacroData, buildMacroCompletion, buildMacroTooltip, buildSignatureFromJSDoc, isConstantMacro, parseMacroParams } from "./macro-utils";
import { buildTooltipBase } from "./utils";

// =============================================================================
// Types
// =============================================================================

interface FalloutHeaderData {
    macros: Macros;
    procedures: Procedures;
    definitions: definition.Definitions;
}

interface Procedure {
    label: string;
    detail: string;
    jsdoc?: jsdoc.JSdoc;
}
interface Procedures extends Array<Procedure> { }
interface Macro {
    label: string;
    detail: string;
    constant: boolean;
    multiline: boolean;
    firstline: string;
    jsdoc?: jsdoc.JSdoc;
}
interface Macros extends Array<Macro> { }

function findSymbols(text: string) {
    // defines
    const defineList: Macros = [];
    // JSDoc pattern: matches both single-line /** text */ and multi-line /** \n text \n */
    // Single-line: \/\*\*[^*]*\*+\/  (/** followed by non-* chars, then one or more *, then /)
    // Multi-line: \/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/  (/** + newline + content + */)
    const defineRegex =
        /((\/\*\*[^*]*\*+\/|\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]+(.+)/gm;
    let matches = text.matchAll(defineRegex);
    for (const m of matches) {
        const defineName = m[5];
        const defineFirstlineRaw = m[7];
        if (!defineName || !defineFirstlineRaw) continue;
        const defineFirstline = defineFirstlineRaw.trimEnd();

        // check if it's multiline
        let multiline = false;
        if (defineFirstline.endsWith("\\")) {
            multiline = true;
        }

        // check if it has vars
        let defineDetail = defineName;
        if (m[6]) {
            // function-like macro
            const defineVars = m[6];
            defineDetail = `${defineName}(${defineVars})`;
        }

        // check if it looks like a constant (use shared function)
        let constant = false;
        if (!multiline && isConstantMacro(defineName)) {
            constant = true;
        }

        const item: Macro = {
            label: defineName,
            constant: constant,
            detail: defineDetail,
            multiline: multiline,
            firstline: defineFirstline,
        };
        // if jsdoc found
        if (m[2]) {
            const jsd = jsdoc.parse(m[2]);
            item.jsdoc = jsd;
            item.detail = jsdocToDetail(defineName, jsd, "macro");
        }
        defineList.push(item);
    }

    // procedures
    const procList: Procedures = [];
    // multiline jsdoc regex: (\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)
    // from here https://stackoverflow.com/questions/35905181/regex-for-jsdoc-comments
    // procedure regex: procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin
    const procRegex =
        /((\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/gm;
    matches = text.matchAll(procRegex);
    for (const m of matches) {
        const procName = m[5];
        if (!procName) continue;
        let procDetail = procName;
        if (m[6]) {
            procDetail = `procedure ${procName}(${m[6]})`;
        } else {
            procDetail = `procedure ${procName}`;
        }

        // if jsdoc found
        if (m[2]) {
            const jsd = jsdoc.parse(m[2]);
            // If JSdoc has no arguments specified, but function has them, keep the default detail form
            if (!(m[6] && jsd.args.length == 0)) {
                // else, use detail from JSdoc.
                procDetail = jsdocToDetail(procName, jsd);
            }
            const item = { label: procName, detail: procDetail, jsdoc: jsd };
            procList.push(item);
        } else {
            const item = { label: procName, detail: procDetail };
            procList.push(item);
        }
    }
    const definitions = findDefinitions(text);

    const result: FalloutHeaderData = {
        macros: defineList,
        procedures: procList,
        definitions: definitions,
    };
    return result;
}

function findDefinitions(text: string) {
    const definitions: definition.Definition[] = [];
    const lines = text.split("\n");
    const procRegex = /^procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/d;
    const defineRegex = /^#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]+(.+)/d;
    lines.forEach((l, i) => {
        let match = procRegex.exec(l);
        if (match) {
            const name = match[1];
            const index = (match as RegExpMatchArrayWithIndices).indices[1];
            if (name && index) {
                const item: definition.Definition = {
                    name: name,
                    line: i,
                    start: index[0],
                    end: index[1],
                };
                definitions.push(item);
            }
        } else {
            match = defineRegex.exec(l);
            if (match) {
                const name = match[1];
                const index = (match as RegExpMatchArrayWithIndices).indices[1];
                if (name && index) {
                    const item: definition.Definition = {
                        name: name,
                        line: i,
                        start: index[0],
                        end: index[1],
                    };
                    definitions.push(item);
                }
            }
        }
    });
    return definitions;
}

// =============================================================================
// Unified Symbol API
// =============================================================================

/**
 * Parse a header file and return symbols for the unified index.
 * This is the preferred API - returns IndexedSymbol[] ready for Symbols storage.
 *
 * @param uri File URI
 * @param text File content
 * @param workspaceRoot Workspace root for computing relative displayPath
 */
export function parseHeaderToSymbols(
    uri: string,
    text: string,
    workspaceRoot?: string,
): IndexedSymbol[] {
    const displayPath = computeDisplayPath(uri, workspaceRoot);
    const headerData = findSymbols(text);
    const definitions = findDefinitions(text);
    const defMap = new Map(definitions.map(d => [d.name, d]));

    const result: IndexedSymbol[] = [];

    // Convert procedures to IndexedSymbol
    for (const proc of headerData.procedures) {
        const def = defMap.get(proc.label);
        const location: Location | null = def ? {
            uri,
            range: {
                start: { line: def.line, character: def.start },
                end: { line: def.line, character: def.end },
            },
        } : null;

        const sig = proc.jsdoc && proc.jsdoc.args.length > 0
            ? buildSignatureFromJSDoc(proc.label, proc.jsdoc, uri)
            : undefined;

        const hoverContents = {
            kind: MarkupKind.Markdown,
            value: buildTooltipBase(proc.detail, proc.jsdoc ?? null, displayPath),
        };

        const symbol: CallableSymbol = {
            name: proc.label,
            kind: SymbolKind.Procedure,
            location,
            scope: { level: ScopeLevel.Workspace },
            source: {
                type: SourceType.Workspace,
                uri,
                displayPath,
            },
            completion: {
                label: proc.label,
                kind: CompletionItemKind.Function,
                labelDetails: { description: displayPath },
                documentation: hoverContents,
            },
            hover: { contents: hoverContents },
            signature: sig,
            callable: {},
        };
        result.push(symbol);
    }

    // Convert macros to IndexedSymbol
    for (const macro of headerData.macros) {
        const def = defMap.get(macro.label);
        const location: Location | null = def ? {
            uri,
            range: {
                start: { line: def.line, character: def.start },
                end: { line: def.line, character: def.end },
            },
        } : null;

        const hasParams = !macro.constant && macro.detail.includes("(");
        const params = hasParams ? parseMacroParams(macro.detail.match(/\(([^)]+)\)/)?.[1] || "") : undefined;

        const macroData: MacroData = {
            name: macro.label,
            params,
            hasParams,
            firstline: macro.firstline,
            multiline: macro.multiline,
            jsdoc: macro.jsdoc,
        };

        const hoverContents = {
            kind: MarkupKind.Markdown,
            value: buildMacroTooltip(macroData, displayPath),
        };
        const completionItem = buildMacroCompletion(macroData, uri, displayPath);

        const sig = macro.jsdoc && macro.jsdoc.args.length > 0
            ? buildSignatureFromJSDoc(macro.label, macro.jsdoc, uri)
            : undefined;

        if (hasParams) {
            const symbol: CallableSymbol = {
                name: macro.label,
                kind: SymbolKind.Macro,
                location,
                scope: { level: ScopeLevel.Workspace },
                source: {
                    type: SourceType.Workspace,
                    uri,
                    displayPath,
                },
                completion: completionItem,
                hover: { contents: hoverContents },
                signature: sig,
                callable: { parameters: params?.map(p => ({ name: p })) },
            };
            result.push(symbol);
        } else {
            const symbol: ConstantSymbol = {
                name: macro.label,
                kind: SymbolKind.Constant,
                location,
                scope: { level: ScopeLevel.Workspace },
                source: {
                    type: SourceType.Workspace,
                    uri,
                    displayPath,
                },
                completion: completionItem,
                hover: { contents: hoverContents },
                signature: sig,
                constant: { value: macro.firstline },
            };
            result.push(symbol);
        }
    }

    return result;
}

