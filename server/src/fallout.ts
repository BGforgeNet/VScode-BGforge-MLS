import { CompletionItemKind } from "vscode-languageserver";
import {
    conlog,
    ParseItemList,
    ParseResult,
    sendParseResult as sendParseResult,
    findFiles,
    uriToPath,
    RegExpMatchArrayWithIndices,
    pathToUri,
} from "./common";
import { connection, documents } from "./server";
import * as path from "path";
import { MarkupKind } from "vscode-languageserver/node";
import * as cp from "child_process";
import { SSLsettings } from "./settings";
import * as completion from "./completion";
import * as definition from "./definition";
import * as hover from "./hover";
import * as fs from "fs";
import * as jsdoc from "./jsdoc";
import { HeaderData as LanguageHeaderData } from "./language";
import PromisePool from "@supercharge/promise-pool";

interface FalloutHeaderData {
    macros: DefineList;
    procedures: ProcList;
    definitions: definition.DefinitionList;
}

interface ProcListItem {
    label: string;
    detail: string;
    jsdoc?: jsdoc.JSdoc;
}
interface ProcList extends Array<ProcListItem> {}
interface DefineListItem {
    label: string;
    detail: string;
    constant: boolean;
    multiline: boolean;
    firstline: string;
    jsdoc?: jsdoc.JSdoc;
}
interface DefineList extends Array<DefineListItem> {}

const tooltipLangId = "fallout-ssl-tooltip";
const sslExt = ".ssl";

export async function loadHeaders(headersDirectory: string, external = false) {
    let completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();
    const headerFiles = findFiles(headersDirectory, "h");

    const { results, errors } = await PromisePool.withConcurrency(4)
        .for(headerFiles)
        .process(async (relPath) => {
            const absPath = path.join(headersDirectory, relPath);
            const text = fs.readFileSync(absPath, "utf8");
            const uri = pathToUri(absPath);
            let pathString: string;
            if (external) {
                pathString = absPath;
            } else {
                pathString = relPath;
            }
            return loadFileData(uri, text, pathString);
        });

    if (errors.length > 0) {
        conlog(errors);
    }

    results.map((x) => {
        completions = completions.concat(x.completion);

        for (const [key, value] of x.hover) {
            hovers.set(key, value);
        }

        if (x.definition) {
            for (const [key, value] of x.definition) {
                definitions.set(key, value);
            }
        }
    });

    const result: LanguageHeaderData = {
        completion: completions,
        hover: hovers,
        definition: definitions,
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
        const completionItem = {
            label: proc.label,
            documentation: markdownContents,
            source: filePath,
            uri: uri,
            kind: CompletionItemKind.Function,
            labelDetails: { description: filePath },
        };
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
        let completionKind;
        if (macro.constant) {
            completionKind = CompletionItemKind.Constant;
        } else {
            // there's no good icon for macros, using something distinct from function
            completionKind = CompletionItemKind.Field;
        }
        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };
        const completionItem = {
            label: macro.label,
            documentation: markdownContents,
            source: filePath,
            uri: uri,
            kind: completionKind,
            labelDetails: { description: filePath },
        };

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
    const result: LanguageHeaderData = {
        hover: hovers,
        completion: completions,
        definition: definitions,
    };
    return result;
}

function findSymbols(text: string) {
    // defines
    const defineList: DefineList = [];
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

        const item: DefineListItem = {
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
    const procList: ProcList = [];
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
            const item: definition.DefinitionItem = {
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
                const item: definition.DefinitionItem = {
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
    return md;
}

function jsdocToDetail(label: string, jsd: jsdoc.JSdoc) {
    const type = jsd.ret ? jsd.ret.type : "void";
    const args = jsd.args.map(({ type, name }) => `${type} ${name}`);
    const argsString = args.join(", ");
    const detail = `${type} ${label}(${argsString})`;
    return detail;
}

/** `text` looks like this
 *
 * `[Error] <Semantic> <my_script.ssl>:26:25: Unknown identifier qq.`
 * Numbers mean line:column
 */
function parseCompileOutput(text: string, uri: string) {
    const textDocument = documents.get(uri);
    if (!textDocument) {
        return { errors: [], warnings: [] };
    }
    const errorsRegex = /\[Error\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const warningsRegex = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match = errorsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            let col: string;
            if (match[3] == "") {
                col = "1";
            } else {
                col = match[3];
            }
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                columnStart: 0,
                columnEnd: parseInt(col) - 1,
                message: match[4],
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
            warnings.push({
                file: match[1],
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

function sendDiagnostics(uri: string, outputText: string) {
    const parseResult = parseCompileOutput(outputText, uri);
    sendParseResult(uri, parseResult);
}

export function compile(uri: string, sslSettings: SSLsettings, interactive = false) {
    const filepath = uriToPath(uri);
    const cwdTo = path.dirname(filepath);
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

    cp.exec(
        compileCmd + " " + baseName + " -o " + dstPath,
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
            sendDiagnostics(uri, stdout);
        }
    );
}
