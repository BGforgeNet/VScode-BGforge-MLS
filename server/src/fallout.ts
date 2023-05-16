import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import { CompletionItemKind, ParameterInformation } from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver/node";
import {
    conlog,
    findFiles,
    ParseItemList,
    ParseResult,
    pathToUri,
    RegExpMatchArrayWithIndices,
    sendParseResult,
    uriToPath,
} from "./common";
import * as completion from "./completion";
import * as definition from "./definition";
import * as hover from "./hover";
import * as jsdoc from "./jsdoc";
import { HeaderData as LanguageHeaderData } from "./language";
import * as pool from "./pool";
import { Edge, Node } from "./preview";
import { connection, documents } from "./server";
import { SSLsettings } from "./settings";
import * as signature from "./signature";
import * as os from "os";

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
interface Procedures extends Array<Procedure> {}
interface Macro {
    label: string;
    detail: string;
    constant: boolean;
    multiline: boolean;
    firstline: string;
    jsdoc?: jsdoc.JSdoc;
}
interface Macros extends Array<Macro> {}

const tooltipLangId = "fallout-ssl-tooltip";
const sslExt = ".ssl";

/**
 * @param headersDirectory
 * @param external
 * @param staticHover - Used to skip dupes from headers, such as sfall macros, which are imported statically.
 * @returns
 */
export async function loadHeaders(
    headersDirectory: string,
    external = false,
    staticHover: hover.HoverMap = new Map()
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
        external
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

        if (x.definition) {
            for (const [key, value] of x.definition) {
                if (!staticHover.has(key)) {
                    definitions.set(key, value);
                }
            }
        }

        if (x.signature) {
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
            const jsdmd = jsdocToMD(proc.jsdoc);
            markdownValue += jsdmd;
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
        if (proc.jsdoc?.deprecated) {
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
        let markdownValue: string;
        let detail = macro.detail;
        // for a constant, show just value
        if (macro.constant) {
            detail = macro.firstline;
        }

        markdownValue = [
            "```" + `${tooltipLangId}`,
            `${detail}`,
            "```",
            "\n```bgforge-mls-comment\n",
            `${filePath}`,
            "```",
        ].join("\n");
        // for single line ones, show full line too
        if (!macro.multiline && !macro.constant) {
            markdownValue += ["\n```" + `${tooltipLangId}`, `${macro.firstline}`, "```"].join("\n");
        }

        if (macro.jsdoc) {
            const jsdmd = jsdocToMD(macro.jsdoc);
            markdownValue += jsdmd;
        }

        let completionKind;
        if (macro.constant) {
            completionKind = CompletionItemKind.Constant;
        } else {
            // there's no good icon for macros, using something distinct from function
            completionKind = CompletionItemKind.Field;
        }
        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };
        const completionItem: completion.CompletionItemEx = {
            label: macro.label,
            documentation: markdownContents,
            source: filePath,
            uri: uri,
            kind: completionKind,
            labelDetails: { description: filePath },
        };
        if (macro.jsdoc?.deprecated) {
            const COMPLETION_TAG_deprecated = 1;
            completionItem.tags = [COMPLETION_TAG_deprecated];
        }
        completions.push(completionItem);

        const hoverItem = { contents: markdownContents, source: filePath, uri: uri };
        hovers.set(macro.label, hoverItem);
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

    for (const macro of symbols.macros) {
        if (macro.jsdoc && macro.jsdoc.args.length > 0) {
            const key = macro.label;
            const sig = jsdocToSig(macro.label, macro.jsdoc, uri);
            signatures.set(key, sig);
        }
    }
    // dupe code because of different types
    for (const procedure of symbols.procedures) {
        if (procedure.jsdoc && procedure.jsdoc.args.length > 0) {
            const key = procedure.label;
            const sig = jsdocToSig(procedure.label, procedure.jsdoc, uri);
            signatures.set(key, sig);
        }
    }

    return signatures;
}

function jsdocToSig(label: string, jsd: jsdoc.JSdoc, uri: string) {
    const argNames = jsd.args.map((item) => {
        return item.name;
    });
    const sigLabel = label + "(" + argNames.join(", ") + ")";
    const sig: signature.SigInfoEx = { label: sigLabel, uri: uri };
    if (jsd.desc) {
        sig.documentation = {
            kind: "markdown",
            value: "\n---\n" + jsd.desc,
        };
    }
    const parameters: ParameterInformation[] = [];
    for (const arg of jsd.args) {
        const info: ParameterInformation = { label: arg.name };
        let doc = ["```" + `${tooltipLangId}`, `${arg.type} ${arg.name}`, "```"].join("\n");
        if (arg.description) {
            doc += "\n";
            doc += arg.description;
        }
        info.documentation = { kind: "markdown", value: doc };
        parameters.push(info);
    }
    sig.parameters = parameters;
    return sig;
}

function findSymbols(text: string) {
    // defines
    const defineList: Macros = [];
    const defineRegex =
        /((\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]+(.+)/gm;
    const constantRegex = /^[A-Z][A-Z0-9_]+/;
    let matches = text.matchAll(defineRegex);
    for (const m of matches) {
        const defineName = m[5];
        let defineFirstline = m[7];
        defineFirstline = defineFirstline.trimEnd();

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

        // check if it's looks like a constant
        let constant = false;
        if (!multiline && constantRegex.test(defineName)) {
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
            item.detail = jsdocToDetail(defineName, jsd);
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
        let procDetail = procName;
        if (m[6]) {
            procDetail = `procedure ${procName}(${m[6]})`;
        } else {
            procDetail = `procedure ${procName}()`;
        }

        // if jsdoc found
        if (m[2]) {
            const jsd = jsdoc.parse(m[2]);
            procDetail = jsdocToDetail(procName, jsd);
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
    const definitions = [];
    const lines = text.split("\n");
    const procRegex = /^procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/d;
    const defineRegex = /^#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]+(.+)/d;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        let match = procRegex.exec(l);
        if (match) {
            const name = match[1];
            const index = (match as RegExpMatchArrayWithIndices).indices[1];
            const item: definition.Definition = {
                name: name,
                line: i,
                start: index[0],
                end: index[1],
            };
            definitions.push(item);
        } else {
            match = defineRegex.exec(l);
            if (match) {
                const name = match[1];
                const index = (match as RegExpMatchArrayWithIndices).indices[1];
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
    return definitions;
}

function jsdocToMD(jsd: jsdoc.JSdoc) {
    let md = "\n---\n";
    if (jsd.desc) {
        md += `\n${jsd.desc}`;
    }
    if (jsd.args.length > 0) {
        md += "\n\n|type|name|default|description|\n|:-|:-|:-|:-|";
        for (const arg of jsd.args) {
            md += `\n| \`${arg.type}\` | ${arg.name} |`;
            if (arg.default) {
                md += `${arg.default}`;
            }
            md += "|";
            if (arg.description) {
                md += `${arg.description}`;
            }
            md += "|";
        }
    }
    if (jsd.ret) {
        md += `\n\n**Returns** \`${jsd.ret.type}\``;
    }
    if (jsd.deprecated) {
        if (jsd.deprecated === true) {
            md += "\n\n---\n\nDeprecated.";
        } else {
            md += `\n\n---\n\nDeprecated: ${jsd.deprecated}`;
        }
    }
    return md;
}

function jsdocToDetail(label: string, jsd: jsdoc.JSdoc) {
    const type = jsd.ret ? jsd.ret.type : "void";
    const args = jsd.args.map(({ type, name }) => `${type} ${name}`);
    const argsString = args.join(", ");
    const detail = `${type} ${label}(${argsString})`;
    return detail;
}

/**
 * Wine gives network-mapped looking path to compile.exe
 * @param path looks like this `Z:/Downloads/1/_mls_test.h`, should be this `/home/user/Downloads/1/_mls_test.h`
 * Imperfect, but works.
 */
function fixWinePath(filePath: string) {
    if (os.platform() == "win32") {
        return filePath;
    }
    if (!filePath.startsWith("Z:/")) {
        return filePath;
    }

    const homeDir = os.homedir();
    const relPath = filePath.replace("Z:/", "");
    const realPath = path.join(homeDir, relPath);
    return realPath;
}

/**
 * Parse compile.exe output with regex and return found matches.
 * `text` looks like this
 * `[Error] <1.ssl.tmp>:2:8: Expecting top-level statement`
 * or
 * `[Error] <Semantic> <my_script.ssl>:26:25: Unknown identifier qq.`
 * or (wine)
 * `[Error] <Z:/Downloads/1/_mls_test.h>:1: Illegal parameter "1"`
 *
 * Numbers mean line:column, if column is absent, it means first column.
 */
function parseCompileOutput(text: string, uri: string) {
    const textDocument = documents.get(uri);
    if (!textDocument) {
        return { errors: [], warnings: [] };
    }
    const errorsRegex = /\[Error\]( <Semantic>)? <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const warningsRegex = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    // compile.exe may show errors and warnings for included files, not just current one
    // So we need to get uri's for those
    // They could be relative to the original file path
    const filePath = uriToPath(uri);
    const fileDir = path.dirname(filePath);

    try {
        let match = errorsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            let col: string;
            if (match[4] == "") {
                col = "1";
            } else {
                col = match[4];
            }

            // calculate uri for actual file where the error is found
            const errorFile = fixWinePath(match[2]);
            let errorFilePath: string;
            if (path.isAbsolute(errorFile)) {
                errorFilePath = errorFile;
            } else {
                errorFilePath = path.join(fileDir, errorFile);
            }
            const errorFileUri = pathToUri(errorFilePath);

            errors.push({
                uri: errorFileUri,
                line: parseInt(match[3]),
                columnStart: 0,
                columnEnd: parseInt(col) - 1,
                message: match[5],
            });
            match = errorsRegex.exec(text);
        }

        match = warningsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === warningsRegex.lastIndex) {
                warningsRegex.lastIndex++;
            }
            let col: string;
            if (match[3] == "") {
                col = "0";
            } else {
                col = match[3];
            }
            const line = parseInt(match[2]);
            const column_end = textDocument.offsetAt({ line: line, character: 0 }) - 1;

            // calculate uri for actual file where the warning is found
            const errorFile = fixWinePath(match[1]);
            let errorFilePath: string;
            if (path.isAbsolute(errorFile)) {
                errorFilePath = errorFile;
            } else {
                errorFilePath = path.join(fileDir, errorFile);
            }
            const errorFileUri = pathToUri(errorFilePath);

            warnings.push({
                uri: errorFileUri,
                line: line,
                columnStart: parseInt(col),
                columnEnd: column_end,
                message: match[4],
            });
            match = warningsRegex.exec(text);
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

function sendDiagnostics(uri: string, outputText: string, tmpUri: string) {
    const parseResult = parseCompileOutput(outputText, uri);
    sendParseResult(parseResult, uri, tmpUri);
}

export function compile(uri: string, sslSettings: SSLsettings, interactive = false, text: string) {
    const filepath = uriToPath(uri);
    const cwdTo = path.dirname(filepath);
    // tmp file has to be in the same dir, because includes can be relative or absolute
    const tmpName = ".tmp.ssl";
    const tmpPath = path.join(cwdTo, tmpName);
    const tmpUri = pathToUri(tmpPath);
    const baseName = path.parse(filepath).base;
    const base = path.parse(filepath).name;
    const compileCmd = `${sslSettings.compilePath} ${sslSettings.compileOptions}`;
    const dstPath = path.join(sslSettings.outputDirectory, base + ".int");
    const ext = path.parse(filepath).ext;

    if (ext.toLowerCase() != sslExt) {
        // vscode loses open file if clicked on console or elsewhere
        conlog("Not a Fallout SSL file! Please focus a Fallout SSL file to compile.");
        if (interactive) {
            connection.window.showInformationMessage("Please focus a Fallout SSL file to compile!");
        }
        return;
    }
    conlog(`compiling ${baseName}...`);

    fs.writeFileSync(tmpPath, text);
    conlog(`${compileCmd} "${tmpName}" -o "${dstPath}"`);
    cp.exec(
        `${compileCmd} "${tmpName}" -o "${dstPath}"`,
        { cwd: cwdTo },
        (err, stdout: string, stderr: string) => {
            conlog("stdout: " + stdout);
            if (stderr) {
                conlog("stderr: " + stderr);
            }
            if (err) {
                conlog("error: " + err.message);
                if (interactive) {
                    connection.window.showErrorMessage(`Failed to compile ${baseName}!`);
                }
            } else {
                if (interactive) {
                    connection.window.showInformationMessage(`Succesfully compiled ${baseName}.`);
                }
            }
            sendDiagnostics(uri, stdout, tmpUri);
            // sometimes it gets deleted due to async runs?
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        }
    );
}

export function getPreviewData(text: string) {
    const regex = /^procedure\s+(\w+).*?begin([\S\s]*?)\nend/gm;
    const matches = text.matchAll(regex);
    if (!matches) {
        return;
    }
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const procs = new Map<string, string>();

    for (const match of matches) {
        const name = match[1];
        const body = match[2];
        procs.set(name, body);
    }

    for (const [name, body] of procs) {
        const nodeItem = { data: { id: name } };
        if (!nodes.includes(nodeItem)) {
            nodes.push(nodeItem);
        }
        if (body) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [name2, body2] of procs) {
                const pattern = `\\b(${name2})\\b`;
                const nameRegex = new RegExp(pattern, "g");
                const childMatches = body.matchAll(nameRegex);
                let children: string[] = [];
                for (const cm of childMatches) {
                    children.push(cm[0]);
                }
                // make sure we only have unique edges
                children = [...new Set(children)];
                for (const child of children) {
                    const edgeItem = {
                        data: { id: `${name}-${name2}`, source: name, target: child },
                    };
                    if (!edges.includes(edgeItem)) {
                        edges.push(edgeItem);
                    }
                }
            }
        }
    }
    return { nodes: nodes, edges: edges };
}
