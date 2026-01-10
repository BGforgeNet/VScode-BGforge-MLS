/**
 * Fallout SSL header parsing utilities.
 * Handles regex-based parsing of .h files for procedures, macros, and definitions.
 */

import { CompletionItemKind } from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver/node";
import {
    conlog,
    findFiles,
    RegExpMatchArrayWithIndices,
} from "../common";
import * as completion from "../shared/completion";
import * as definition from "../shared/definition";
import * as hover from "../shared/hover";
import * as jsdoc from "../shared/jsdoc";
import { HeaderData as LanguageHeaderData } from "../data-loader";
import * as pool from "../shared/pool";
import { LANG_FALLOUT_SSL_TOOLTIP } from "../core/languages";
import { jsdocToDetail, jsdocToMarkdown } from "../shared/jsdoc-utils";
import * as signature from "../shared/signature";
import { MacroData, buildMacroCompletion, buildMacroHover, buildSignatureFromJSDoc, isConstantMacro, parseMacroParams } from "./macro-utils";

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

const tooltipLangId = LANG_FALLOUT_SSL_TOOLTIP;

/**
 * @param headersDirectory
 * @param external
 * @param staticHover - Used to skip dupes from headers, such as sfall macros, which are imported statically.
 * @returns
 */
export async function loadHeaders(
    headersDirectory: string,
    external = false,
    staticHover: hover.HoverMap = new Map(),
) {
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();
    const signatures: signature.SigMap = new Map();
    const headerFiles = findFiles(headersDirectory, "h");

    const { results, errors } = await pool.processHeaders(
        headerFiles,
        headersDirectory,
        loadFileData,
        external,
    );

    if (errors.length > 0) {
        conlog(errors);
    }

    results.map((x) => {
        for (const item of x.completion) {
            if (!staticHover.has(item.label)) {
                completions.push(item);
            }
        }

        for (const [key, value] of x.hover) {
            if (!staticHover.has(key)) {
                hovers.set(key, value);
            }
        }

        for (const [key, value] of x.definition) {
            if (!staticHover.has(key)) {
                definitions.set(key, value);
            }
        }

        if (x.signature !== undefined) {
            for (const [key, value] of x.signature) {
                if (!staticHover.has(key)) {
                    signatures.set(key, value);
                }
            }
        }
    });

    const result: LanguageHeaderData = {
        completion: completions,
        hover: hovers,
        definition: definitions,
        signature: signatures,
    };
    return result;
}

function loadProcedures(uri: string, headerData: FalloutHeaderData, filePath: string) {
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    for (const proc of headerData.procedures) {
        let markdownValue = [
            "```" + `${tooltipLangId}`,
            `${proc.detail}`,
            "```",
            "\n```bgforge-mls-comment\n",
            `${filePath}`,
            "```",
        ].join("\n");
        if (proc.jsdoc) {
            markdownValue += jsdocToMarkdown(proc.jsdoc, "fallout");
        }
        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };
        const completionItem: completion.CompletionItemEx = {
            label: proc.label,
            documentation: markdownContents,
            source: filePath,
            uri: uri,
            kind: CompletionItemKind.Function,
            labelDetails: { description: filePath },
        };
        if (proc.jsdoc?.deprecated !== undefined) {
            const COMPLETION_TAG_deprecated = 1;
            completionItem.tags = [COMPLETION_TAG_deprecated];
        }
        completions.push(completionItem);
        const hoverItem = { contents: markdownContents, source: filePath, uri: uri };
        hovers.set(proc.label, hoverItem);
    }
    return { completion: completions, hover: hovers };
}

function loadMacros(uri: string, headerData: FalloutHeaderData, filePath: string) {
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();

    for (const macro of headerData.macros) {
        // Convert old Macro interface to MacroData for shared builders
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

        // Use shared builders
        const item = buildMacroCompletion(macroData, uri, filePath);
        // Add source field (specific to header completions)
        (item as completion.CompletionItemEx).source = filePath;
        (item as completion.CompletionItemEx).uri = uri;
        completions.push(item as completion.CompletionItemEx);

        const hoverContents = buildMacroHover(macroData, filePath);
        hovers.set(macro.label, { contents: hoverContents, source: filePath, uri });
    }

    return { completion: completions, hover: hovers };
}

/**
 *
 * @param uri
 * @param text
 * @param filePath cosmetic only, relative or absolute path
 * @returns
 */
export function loadFileData(uri: string, text: string, filePath: string) {
    const symbols = findSymbols(text);
    const procs = loadProcedures(uri, symbols, filePath);
    const macros = loadMacros(uri, symbols, filePath);
    const completions = [...procs.completion, ...macros.completion];
    const hovers = new Map([...procs.hover, ...macros.hover]);
    const definitions = definition.load(uri, symbols.definitions);
    const signatures = getSignatures(symbols, uri);
    const result: LanguageHeaderData = {
        hover: hovers,
        completion: completions,
        definition: definitions,
        signature: signatures,
    };
    return result;
}

function getSignatures(symbols: FalloutHeaderData, uri: string) {
    const signatures: signature.SigMap = new Map();

    // Use shared function for both macros and procedures
    for (const macro of symbols.macros) {
        if (macro.jsdoc && macro.jsdoc.args.length > 0) {
            signatures.set(macro.label, buildSignatureFromJSDoc(macro.label, macro.jsdoc, uri));
        }
    }

    for (const procedure of symbols.procedures) {
        if (procedure.jsdoc && procedure.jsdoc.args.length > 0) {
            signatures.set(procedure.label, buildSignatureFromJSDoc(procedure.label, procedure.jsdoc, uri));
        }
    }

    return signatures;
}

function findSymbols(text: string) {
    // defines
    const defineList: Macros = [];
    const defineRegex =
        /((\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]+(.+)/gm;
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
            defineList.push(item);
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
            procDetail = `procedure ${procName}()`;
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
