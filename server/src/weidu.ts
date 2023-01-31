import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import { CompletionItemKind, MarkupKind } from "vscode-languageserver/node";
import {
    conlog,
    findFiles,
    ParseItemList,
    ParseResult,
    RegExpMatchArrayWithIndices,
    sendParseResult,
    tmpDir,
    uriToPath,
} from "./common";
import * as completion from "./completion";
import * as definition from "./definition";
import * as hover from "./hover";
import * as jsdoc from "./jsdoc";
import { HeaderData as LanguageHeaderData } from "./language";
import * as pool from "./pool";
import { connection } from "./server";
import { WeiDUsettings } from "./settings";

const valid_extensions = new Map([
    [".tp2", "tp2"],
    [".tph", "tpa"],
    [".tpa", "tpa"],
    [".tpp", "tpp"],
    [".d", "d"],
    [".baf", "baf"],
]);

interface WeiduHeaderData {
    defines: Defines;
    definitions: definition.Definitions;
}

interface Define {
    name: string;
    context: "action" | "patch";
    dtype: "function" | "macro";
    jsdoc?: jsdoc.JSdoc;
}
interface Defines extends Array<Define> {}

/** `text` looks like this
 *
 * `[ua.tp2]  ERROR at line 30 column 1-63` */
function parseWeiduOutput(text: string) {
    const errorsRegex = /\[(\S+)\]\s+(?:PARSE\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match = errorsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                columnStart: parseInt(match[3]) - 1, // weidu uses 1-index, while vscode 0 index?
                columnEnd: parseInt(match[4]),
                message: text,
            });
            match = errorsRegex.exec(text);
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
        let match = errorsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            errors.push({
                file: match[1],
                line: parseInt(match[3]),
                columnStart: parseInt(match[4]) - 1,
                columnEnd: match[0].length,
                message: text,
            });
            match = errorsRegex.exec(text);
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

export function compile(uri: string, settings: WeiDUsettings, interactive = false, text: string) {
    /** preprocessed file */
    const tmpFile = path.join(tmpDir, "tmp.txt");
    /** not preprocessed (template) */
    const tmpFileGcc = path.join(tmpDir, "tmp-gcc.txt");
    const gamePath = settings.gamePath;
    const weiduPath = settings.path;
    const filePath = uriToPath(uri);
    const cwdTo = tmpDir;
    const baseName = path.parse(filePath).base;
    let ext = path.parse(filePath).ext;
    ext = ext.toLowerCase();
    let tpl = false;
    let realName = baseName; // filename without .tpl
    if (ext == ".tpl") {
        tpl = true;
        realName = baseName.substring(0, baseName.length - 4);
        ext = path.parse(realName).ext;
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
    let preprocessFailed = false;
    if (tpl == true) {
        conlog(`preprocessing ${baseName}...`);

        fs.writeFileSync(tmpFileGcc, text);
        const gccArgs = [
            "-E",
            "-x",
            "c",
            "-P",
            "-Wundef",
            "-Werror",
            "-Wfatal-errors",
            "-o",
            `${tmpFile}`,
            `${tmpFileGcc}`,
        ];
        const result = cp.spawnSync("gcc", gccArgs, { cwd: cwdTo });
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
            preprocessFailed = true;
        } else {
            if (interactive) {
                connection.window.showInformationMessage(`Succesfully preprocessed ${baseName}.`);
            }
        }
    }
    if (preprocessFailed) {
        return 1;
    }

    // parse
    conlog(`parsing ${realName}...`);
    fs.writeFileSync(tmpFile, text);
    const weiduCmd = `${weiduPath} ${weiduArgs} ${weiduType} ${tmpFile} `;
    cp.exec(weiduCmd, { cwd: cwdTo }, (err, stdout: string, stderr: string) => {
        conlog("stdout: " + stdout);
        const parseResult = parseWeiduOutput(stdout); // dupe, yes
        conlog(parseResult);
        if (stderr) {
            conlog("Parse stderr: " + stderr);
        }
        if (
            (err && err.code != 0) ||
            parseResult.errors.length > 0 || // weidu doesn't always return non-zero on parse failure?
            parseResult.warnings.length > 0
        ) {
            if (err) {
                conlog("Parse  error: " + err.message);
            }
            conlog(parseResult);
            if (interactive) {
                connection.window.showErrorMessage(`Failed to parse ${realName}!`);
            }
            if (tpl == false) {
                sendDiagnostics(uri, stdout);
            }
        } else {
            if (interactive) {
                connection.window.showInformationMessage(`Succesfully parsed ${realName}.`);
            }
        }
    });
}

export async function loadHeaders(headersDirectory: string) {
    let completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();
    const headerFiles = findFiles(headersDirectory, "tph");

    const { results, errors } = await pool.processHeaders(
        headerFiles,
        headersDirectory,
        loadFileData
    );

    if (errors.length > 0) {
        conlog(errors);
    }

    results.map((x) => {
        completions = completions.concat(x.completion);

        for (const [key, value] of x.hover) {
            hovers.set(key, value);
        }
        for (const [key, value] of x.definition) {
            definitions.set(key, value);
        }
    });

    const result: LanguageHeaderData = {
        completion: completions,
        hover: hovers,
        definition: definitions,
    };
    return result;
}

function findSymbols(text: string) {
    const defineList: Defines = [];
    const defineRegex =
        /((\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\/)\r?\n)?(DEFINE_ACTION_FUNCTION|DEFINE_ACTION_MACRO|DEFINE_PATCH_FUNCTION|DEFINE_PATCH_MACRO)\s+(\w+)/gm;

    const matches = text.matchAll(defineRegex);
    for (const m of matches) {
        const name = m[6];
        let context: "action" | "patch";
        let dtype: "function" | "macro";
        if (m[5].startsWith("DEFINE_ACTION")) {
            context = "action";
        } else {
            context = "patch";
        }
        if (m[5].endsWith("FUNCTION")) {
            dtype = "function";
        } else {
            dtype = "macro";
        }

        const item: Define = { name: name, context: context, dtype: dtype };

        // check for docstring
        if (m[2]) {
            const jsd = jsdoc.parse(m[2]);
            item.jsdoc = jsd;
        }

        defineList.push(item);
    }
    const definitions = findDefinitions(text);
    const result: WeiduHeaderData = { defines: defineList, definitions: definitions };
    return result;
}

function jsdocToMD(jsd: jsdoc.JSdoc) {
    let md = "\n---\n";
    if (jsd.desc) {
        md += `\n${jsd.desc}`;
    }
    if (jsd.args.length > 0) {
        // types from IElib https://ielib.bgforge.net/types/
        const intVars = jsd.args.filter((item) => {
            switch (item.type) {
                case "bool":
                case "int":
                    return true;
                default:
                    return false;
            }
        });
        const strVars = jsd.args.filter((item) => {
            switch (item.type) {
                case "ids":
                case "resref":
                case "filename":
                case "string":
                    return true;
                default:
                    return false;
            }
        });
        if (intVars.length > 0) {
            md += "\n\n|INT_VAR|Name|Default|Description|\n|:-|:-|:-:|:-|";
            for (const arg of intVars) {
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
        if (strVars.length > 0) {
            if (intVars.length == 0) {
                md += "\n\n|STR_VAR|Name|Default|Description|\n|:-|:-|:-:|:-|";
            } else {
                md += "\n|**STR_VAR**||||";
            }
            for (const arg of strVars) {
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
    }
    if (jsd.ret) {
        md += `\n\n Returns \`${jsd.ret.type}\``;
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

/**
 * @param uri
 * @param text
 * @param filePath cosmetic only, relative path
 * @returns
 */
export function loadFileData(uri: string, text: string, filePath: string) {
    const symbols = findSymbols(text);
    const functions = loadFunctions(uri, symbols.defines, filePath);
    const definitions = definition.load(uri, symbols.definitions);
    const result: LanguageHeaderData = {
        hover: functions.hovers,
        completion: functions.completions,
        definition: definitions,
    };
    return result;
}

function loadFunctions(uri: string, symbols: Defines, filePath: string) {
    const langId = "weidu-tp2-tooltip";
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();

    for (const symbol of symbols) {
        let markdownValue = [
            "```" + `${langId}`,
            `${symbol.context} ${symbol.dtype} ${symbol.name}`,
            "```",
            "\n```bgforge-mls-comment\n",
            `${filePath}`,
            "```",
        ].join("\n");

        if (symbol.jsdoc) {
            const jsdmd = jsdocToMD(symbol.jsdoc);
            markdownValue += jsdmd;
        }

        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };
        const completionItem: completion.CompletionItemEx = {
            label: symbol.name,
            documentation: markdownContents,
            source: filePath,
            kind: CompletionItemKind.Function,
            labelDetails: { description: filePath },
            uri: uri,
        };
        if (symbol.jsdoc?.deprecated) {
            const COMPLETION_TAG_deprecated = 1;
            completionItem.tags = [COMPLETION_TAG_deprecated];
        }
        completions.push(completionItem);
        const hoverItem = { contents: markdownContents, source: filePath, uri: uri };
        hovers.set(symbol.name, hoverItem);
    }
    return { completions: completions, hovers: hovers };
}

function findDefinitions(text: string) {
    const definitions = [];
    const lines = text.split("\n");
    const defineRegex =
        /^(DEFINE_ACTION_FUNCTION|DEFINE_ACTION_MACRO|DEFINE_PATCH_FUNCTION|DEFINE_PATCH_MACRO)\s+(\w+)/d;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const match = defineRegex.exec(l);
        if (match) {
            const name = match[2];
            const index = (match as RegExpMatchArrayWithIndices).indices[2];
            const item: definition.Definition = {
                name: name,
                line: i,
                start: index[0],
                end: index[1],
            };
            definitions.push(item);
        }
    }
    return definitions;
}
