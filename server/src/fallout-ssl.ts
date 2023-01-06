import { CompletionItemKind } from "vscode-languageserver";
import {
    conlog,
    ParseItemList,
    ParseResult,
    sendParseResult as sendParseResult,
    isSubpath,
    isDirectory,
    findFiles,
    getFullPath,
} from "./common";
import { connection, documents } from "./server";
import * as path from "path";
import { DynamicData } from "./common";
import { MarkupKind } from "vscode-languageserver/node";
import * as cp from "child_process";
import { SSLsettings } from "./settings";
import * as completion from "./completion";
import { HoverEx, HoverMap, HoverMapEx } from "./hover";
import * as hover from "./hover";
import * as fs from "fs";
import * as jsdoc from "./jsdoc";

interface HeaderDataList {
    macros: DefineList;
    procedures: ProcList;
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

const langId = "fallout-ssl";
const sslExt = ".ssl";

export async function loadData(headersDirectory: string) {
    const completionList: Array<completion.CompletionItemEx> = [];
    const hoverMap = new Map<string, HoverEx>();
    const headersList = findFiles(headersDirectory, "h");

    for (const headerPath of headersList) {
        const text = fs.readFileSync(path.join(headersDirectory, headerPath), "utf8");
        const headerData = findSymbols(text);
        loadMacros(headerPath, headerData, completionList, hoverMap);
        loadProcedures(headerPath, headerData, completionList, hoverMap);
    }
    const result: DynamicData = { completion: completionList, hover: hoverMap };
    return result;
}

function loadProcedures(
    path: string,
    headerData: HeaderDataList,
    completionList: completion.CompletionList,
    hoverMap: HoverMap
) {
    for (const proc of headerData.procedures) {
        let markdownValue = [
            "```" + `${langId}`,
            `${proc.detail}`,
            "```",
            "\n```bgforge-mls-comment\n",
            `${path}`,
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
            source: path,
            kind: CompletionItemKind.Function,
            labelDetails: { description: path },
        };
        completionList.push(completionItem);
        const hoverItem = { contents: markdownContents, source: path };
        hoverMap.set(proc.label, hoverItem);
    }
}

function loadMacros(
    path: string,
    headerData: HeaderDataList,
    completionList: completion.CompletionList,
    hoverMap: HoverMap
) {
    for (const macro of headerData.macros) {
        let markdownValue: string;
        let detail = macro.detail;
        // for a constant, show just value
        if (macro.constant) {
            detail = macro.firstline;
        }

        markdownValue = [
            "```" + `${langId}`,
            `${detail}`,
            "```",
            "\n```bgforge-mls-comment\n",
            `${path}`,
            "```",
        ].join("\n");
        // for single line ones, show full line too
        if (!macro.multiline && !macro.constant) {
            markdownValue += ["\n```" + `${langId}`, `${macro.firstline}`, "```"].join("\n");
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
            source: path,
            kind: completionKind,
            labelDetails: { description: path },
        };

        completionList.push(completionItem);

        const hover_item = { contents: markdownContents, source: path };
        hoverMap.set(macro.label, hover_item);
    }
}

export function reloadData(
    path: string,
    text: string,
    completion: completion.CompletionListEx | undefined,
    hover: HoverMapEx | undefined
) {
    const symbols = findSymbols(text);
    if (completion == undefined) {
        completion = [];
    }
    const newCompletion = completion.filter((item) => item.source != path);
    if (hover == undefined) {
        hover = new Map();
    }
    const newHover = new Map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Array.from(hover).filter(([key, value]) => {
            if (value.source != path) {
                return true;
            }
            return false;
        })
    );

    loadMacros(path, symbols, newCompletion, newHover);
    loadProcedures(path, symbols, newCompletion, newHover);
    const result: DynamicData = { completion: newCompletion, hover: newHover };
    conlog("reload data");
    return result;
}

function findSymbols(text: string) {
    // defines
    const defineList: DefineList = [];
    const defineRegex =
        /((\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?#define[ \t]+(\w+)(?:\(([^)]+)\))?[ \t]+(.+)/gm;
    const constantRegex = /^[A-Z0-9_]+/;
    let match = defineRegex.exec(text);
    while (match != null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (match.index === defineRegex.lastIndex) {
            defineRegex.lastIndex++;
        }

        const defineName = match[5];
        let defineFirstline = match[7];
        defineFirstline = defineFirstline.trimEnd();

        // check if it's multiline
        let multiline = false;
        if (defineFirstline.endsWith("\\")) {
            multiline = true;
        }

        // check if it has vars
        let defineDetail = defineName;
        if (match[6]) {
            // function-like macro
            const defineVars = match[6];
            defineDetail = `${defineName}(${defineVars})`;
        }

        // check if it's looks like a constant
        // a more elaborate analysis could catch more constants
        // this is deliberately simple to encourage better and more consistent code style
        let constant = false;
        if (!multiline && constantRegex.test(defineName)) {
            constant = true;
        }
        // if jsdoc found
        if (match[2]) {
            const jsd = jsdoc.parse(match[2]);
            defineDetail = jsdocToDetail(defineName, jsd);
            const item = {
                label: defineName,
                constant: constant,
                detail: defineDetail,
                multiline: multiline,
                firstline: defineFirstline,
                jsdoc: jsd,
            };
            defineList.push(item);
        } else {
            const item = {
                label: defineName,
                constant: constant,
                detail: defineDetail,
                multiline: multiline,
                firstline: defineFirstline,
            };
            defineList.push(item);
        }
        match = defineRegex.exec(text);
    }

    // procedures
    const procList: ProcList = [];
    // multiline jsdoc regex: (\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)
    // from here https://stackoverflow.com/questions/35905181/regex-for-jsdoc-comments
    // procedure regex: procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin
    const procRegex =
        /((\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?procedure[\s]+(\w+)(?:\(([^)]+)\))?[\s]+begin/gm;
    match = procRegex.exec(text);
    while (match != null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (match.index === procRegex.lastIndex) {
            procRegex.lastIndex++;
        }
        const procName = match[5];
        let procDetail = procName;
        if (match[6]) {
            procDetail = `procedure ${procName}(${match[6]})`;
        } else {
            procDetail = `procedure ${procName}()`;
        }

        // if jsdoc found
        if (match[2]) {
            const jsd = jsdoc.parse(match[2]);
            procDetail = jsdocToDetail(procName, jsd);
            const item = { label: procName, detail: procDetail, jsdoc: jsd };
            procList.push(item);
        } else {
            const item = { label: procName, detail: procDetail };
            procList.push(item);
        }
        match = procRegex.exec(text);
    }

    const result: HeaderDataList = {
        macros: defineList,
        procedures: procList,
    };
    return result;
}

function jsdocToMD(jsd: jsdoc.JSdoc) {
    let md = "\n---\n";
    if (jsd.desc) {
        md += `\n${jsd.desc}`;
    }
    if (jsd.args.length > 0) {
        for (const arg of jsd.args) {
            md += `\n- \`${arg.type}\` ${arg.name}`;
        }
    }
    if (jsd.ret) {
        md += `\n\n Returns \`${jsd.ret.type}\``;
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
    const errorsRegex = /\[Error\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const warningsRegex = /\[Warning\] <(.+)>:([\d]*):([\d]*):? (.*)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match: RegExpExecArray;
        while ((match = errorsRegex.exec(text)) != null) {
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
                column_start: 0,
                column_end: parseInt(col) - 1,
                message: match[4],
            });
        }

        while ((match = warningsRegex.exec(text)) != null) {
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
                column_start: parseInt(col),
                column_end: column_end,
                message: match[4],
            });
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings };
    return result;
}

function sendDiagnostics(uri: string, output_text: string) {
    const parse_result = parseCompileOutput(output_text, uri);
    sendParseResult(uri, parse_result);
}

export function compile(uri: string, ssl_settings: SSLsettings, interactive = false) {
    const filepath = getFullPath(uri);
    const cwdTo = path.dirname(filepath);
    const baseName = path.parse(filepath).base;
    const base = path.parse(filepath).name;
    const compileCmd = `${ssl_settings.compilePath} ${ssl_settings.compileOptions}`;
    const dstPath = path.join(ssl_settings.outputDirectory, base + ".int");
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
        (err: cp.ExecException, stdout: string, stderr: string) => {
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

/** Loads Fallout header data from a directory outside of workspace, if specified in settings.
 * These files are not tracked for changes, and data is static.
 */
export async function load_external_headers(workspace_root: string, headers_dir: string) {
    conlog("loading external headers");

    try {
        if (!isDirectory(headers_dir)) {
            conlog(`${headers_dir} is not a directory, skipping external headers.`);
            return;
        }
    } catch {
        conlog(`lstat ${headers_dir} failed, aborting.`);
        return;
    }
    if (isSubpath(workspace_root, headers_dir)) {
        conlog(`real ${headers_dir} is a subdirectory of workspace ${workspace_root}, aborting.`);
        return;
    }

    conlog(`loading external headers from ${headers_dir}`);
    const falloutHeaderData = await loadData(headers_dir);
    const langId = "fallout-ssl";
    const oldCompletion = completion.staticData.get(langId);
    const oldHover = hover.staticData.get(langId);
    const newCompletion = [...oldCompletion, ...falloutHeaderData.completion];
    const newHover = new Map([...oldHover, ...falloutHeaderData.hover]);

    hover.staticData.set(langId, newHover);
    completion.staticData.set(langId, newCompletion);
    conlog(`loaded external headers from ${headers_dir}`);
}
