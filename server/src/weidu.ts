import {
    conlog,
    DynamicData,
    findFiles,
    getFullPath,
    ParseItemList,
    ParseResult,
    sendParseResult as sendParseResult,
} from "./common";
import { connection } from "./server";
import * as path from "path";
import * as cp from "child_process";
import { WeiDUsettings } from "./settings";
import * as fs from "fs";
import * as jsdoc from "./jsdoc";
import { CompletionItemEx, CompletionList } from "./completion";
import { HoverEx, HoverMap } from "./hover";
import { CompletionItemKind, MarkupKind } from "vscode-languageserver/node";

const valid_extensions = new Map([
    [".tp2", "tp2"],
    [".tph", "tpa"],
    [".tpa", "tpa"],
    [".tpp", "tpp"],
    [".d", "d"],
    [".baf", "baf"],
]);

interface DefineItem {
    name: string;
    context: "action" | "patch";
    dtype: "function" | "macro";
    jsdoc?: jsdoc.JSdoc;
}
interface DefineList extends Array<DefineItem> {}

/** `text` looks like this
 *
 * `[ua.tp2]  ERROR at line 30 column 1-63` */
function parseWeiduOutput(text: string) {
    const errorsRegex = /\[(\S+)\]\s+(?:PARSE\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match: RegExpExecArray;
        while ((match = errorsRegex.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                column_start: parseInt(match[3]) - 1, // weidu uses 1-index, while vscode 0 index?
                column_end: parseInt(match[4]),
                message: text,
            });
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

function parseGccOutput(text: string) {
    const errorsRegex = /((\S+)\.tpl):(\d+):(\d+): error:.*/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match: RegExpExecArray;
        while ((match = errorsRegex.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            errors.push({
                file: match[1],
                line: parseInt(match[3]),
                column_start: parseInt(match[4]) - 1,
                column_end: match[0].length,
                message: text,
            });
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

function sendDiagnostics(uri: string, output_text: string, format = "weidu") {
    let parseResult: ParseResult;
    if (format == "gcc") {
        parseResult = parseGccOutput(output_text);
    } else {
        parseResult = parseWeiduOutput(output_text);
    }
    sendParseResult(uri, parseResult);
}

// export function wcompile(params: any) {
export function compile(uri: string, settings: WeiDUsettings, interactive = false) {
    const gamePath = settings.gamePath;
    const weiduPath = settings.path;
    const filepath = getFullPath(uri);
    const cwdTo = path.dirname(filepath);
    const baseName = path.parse(filepath).base;
    let ext = path.parse(filepath).ext;
    ext = ext.toLowerCase();
    let tpl = false;
    let real_name = baseName; // filename without .tpl
    if (ext == ".tpl") {
        tpl = true;
        real_name = baseName.substring(0, baseName.length - 4);
        ext = path.parse(real_name).ext;
    }

    let weiduArgs = "--no-exit-pause --noautoupdate --debug-assign --parse-check";
    if (gamePath == "") {
        // d and baf need game files
        weiduArgs = `--nogame ${weiduArgs}`;
    } else {
        weiduArgs = `--game ${gamePath} ${weiduArgs}`;
    }

    const weiduType = valid_extensions.get(ext);
    if (!weiduType) {
        // vscode loses open file if clicked on console or elsewhere
        conlog(
            "Not a WeiDU file (tp2, tph, tpa, tpp, d, baf, tpl) or template! Focus a WeiDU file to parse."
        );
        if (interactive) {
            connection.window.showInformationMessage("Focus a WeiDU file or template to parse!");
        }

        return;
    }

    if ((weiduType == "d" || weiduType == "baf") && gamePath == "") {
        conlog("Path to IE game is not specified in settings, can't parse D or BAF!");
        if (interactive) {
            connection.window.showWarningMessage(
                "Path to IE game is not specified in settings, can't parse D or BAF!"
            );
        }
        return;
    }

    // preprocess
    let preprocess_failed = false;
    if (tpl == true) {
        conlog(`preprocessing ${baseName}...`);
        const gcc_args = [
            "-E",
            "-x",
            "c",
            "-P",
            "-Wundef",
            "-Werror",
            "-Wfatal-errors",
            "-o",
            `${real_name}`,
            `${baseName}`,
        ];
        const result = cp.spawnSync("gcc", gcc_args, { cwd: cwdTo });
        conlog("stdout: " + result.stdout);
        if (result.stderr) {
            conlog("stderr: " + result.stderr);
        }
        if (result.status != 0) {
            conlog("error: " + result.status);
            if (interactive) {
                connection.window.showErrorMessage(`Failed to preprocess ${baseName}!`);
            }
            sendDiagnostics(uri, result.stderr.toString(), "gcc");
            preprocess_failed = true;
        } else {
            if (interactive) {
                connection.window.showInformationMessage(`Succesfully preprocessed ${baseName}.`);
            }
        }
    }
    if (preprocess_failed) {
        return 1;
    }

    // parse
    conlog(`parsing ${real_name}...`);
    const weidu_cmd = `${weiduPath} ${weiduArgs} ${weiduType} ${real_name} `;
    cp.exec(weidu_cmd, { cwd: cwdTo }, (err: cp.ExecException, stdout: string, stderr: string) => {
        conlog("stdout: " + stdout);
        const parse_result = parseWeiduOutput(stdout); // dupe, yes
        conlog(parse_result);
        if (stderr) {
            conlog("stderr: " + stderr);
        }
        if (
            (err && err.code != 0) ||
            parse_result.errors.length > 0 || // weidu doesn't always return non-zero on parse failure?
            parse_result.warnings.length > 0
        ) {
            conlog("error: " + err.message);
            conlog(parse_result);
            if (interactive) {
                connection.window.showErrorMessage(`Failed to parse ${real_name}!`);
            }
            if (tpl == false) {
                sendDiagnostics(uri, stdout);
            }
        } else {
            if (interactive) {
                connection.window.showInformationMessage(`Succesfully parsed ${real_name}.`);
            }
        }
    });
}

export async function loadData(headersDirectory: string) {
    const completionList: Array<CompletionItemEx> = [];
    const hoverMap = new Map<string, HoverEx>();
    const headersList = findFiles(headersDirectory, "tph");

    for (const headerPath of headersList) {
        const text = fs.readFileSync(path.join(headersDirectory, headerPath), "utf8");
        const headerData = findSymbols(text);
        loadFunctions(headerPath, headerData, completionList, hoverMap);
    }
    const result: DynamicData = { completion: completionList, hover: hoverMap };
    return result;
}

function findSymbols(text: string) {
    const defineList: DefineList = [];
    const defineRegex =
        /((\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?(DEFINE_ACTION_FUNCTION|DEFINE_ACTION_MACRO|DEFINE_PATCH_FUNCTION|DEFINE_PATCH_MACRO)\s+(\w+)/gm;

    let match = defineRegex.exec(text);
    while (match != null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (match.index === defineRegex.lastIndex) {
            defineRegex.lastIndex++;
        }
        const name = match[6];
        let context: "action" | "patch";
        let dtype: "function" | "macro";
        if (match[5].startsWith("DEFINE_ACTION")) {
            context = "action";
        } else {
            context = "patch";
        }
        if (match[5].endsWith("FUNCTION")) {
            dtype = "function";
        } else {
            dtype = "macro";
        }

        const item: DefineItem = { name: name, context: context, dtype: dtype };

        // check for docstring
        if (match[2]) {
            const jsd = jsdoc.parse(match[2]);
            item.jsdoc = jsd;
        }

        defineList.push(item);
        match = defineRegex.exec(text);
    }
    return defineList;
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

function loadFunctions(
    path: string,
    defineList: DefineList,
    completionList: CompletionList,
    hoverMap: HoverMap
) {
    const langId = "weidu-tp2-tooltip";

    for (const define of defineList) {
        let markdownValue = [
            "```" + `${langId}`,
            `${define.context} ${define.dtype} ${define.name}`,
            "```",
            "\n```bgforge-mls-comment\n",
            `${path}`,
            "```",
        ].join("\n");

        if (define.jsdoc) {
            const jsdmd = jsdocToMD(define.jsdoc);
            markdownValue += jsdmd;
        }

        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };
        const completionItem = {
            label: define.name,
            documentation: markdownContents,
            source: path,
            kind: CompletionItemKind.Function,
        };
        completionList.push(completionItem);
        const hoverItem = { contents: markdownContents, source: path };
        hoverMap.set(define.name, hoverItem);
    }
}
