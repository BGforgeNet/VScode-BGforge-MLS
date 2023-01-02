import {
    conlog,
    DynamicData,
    find_files,
    fullpath,
    ParseItemList,
    ParseResult,
    send_parse_result,
} from "./common";
import { connection } from "./server";
import * as path from "path";
import * as cp from "child_process";
import { WeiDUsettings } from "./settings";
import * as fs from "fs";
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
}
interface DefineList extends Array<DefineItem> {}

/** `text` looks like this
 *
 * `[ua.tp2]  ERROR at line 30 column 1-63` */
function parse_weidu_output(text: string) {
    const errors_pattern = /\[(\S+)\]\s+(?:PARSE\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match: RegExpExecArray;
        while ((match = errors_pattern.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errors_pattern.lastIndex) {
                errors_pattern.lastIndex++;
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

function parse_gcc_output(text: string) {
    const errors_pattern = /((\S+)\.tpl):(\d+):(\d+): error:.*/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match: RegExpExecArray;
        while ((match = errors_pattern.exec(text)) != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errors_pattern.lastIndex) {
                errors_pattern.lastIndex++;
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

function send_diagnostics(uri: string, output_text: string, format = "weidu") {
    let parse_result: ParseResult;
    if (format == "gcc") {
        parse_result = parse_gcc_output(output_text);
    } else {
        parse_result = parse_weidu_output(output_text);
    }
    send_parse_result(uri, parse_result);
}

// export function wcompile(params: any) {
export function compile(uri: string, settings: WeiDUsettings, interactive = false) {
    const game_path = settings.gamePath;
    const weidu_path = settings.path;
    const filepath = fullpath(uri);
    const cwd_to = path.dirname(filepath);
    const base_name = path.parse(filepath).base;
    let ext = path.parse(filepath).ext;
    ext = ext.toLowerCase();
    let tpl = false;
    let real_name = base_name; // filename without .tpl
    if (ext == ".tpl") {
        tpl = true;
        real_name = base_name.substring(0, base_name.length - 4);
        ext = path.parse(real_name).ext;
    }

    let weidu_args = "--no-exit-pause --noautoupdate --debug-assign --parse-check";
    if (game_path == "") {
        // d and baf need game files
        weidu_args = `--nogame ${weidu_args}`;
    } else {
        weidu_args = `--game ${game_path} ${weidu_args}`;
    }

    const weidu_type = valid_extensions.get(ext);
    if (!weidu_type) {
        // vscode loses open file if clicked on console or elsewhere
        conlog(
            "Not a WeiDU file (tp2, tph, tpa, tpp, d, baf, tpl) or template! Focus a WeiDU file to parse."
        );
        if (interactive) {
            connection.window.showInformationMessage("Focus a WeiDU file or template to parse!");
        }

        return;
    }

    if ((weidu_type == "d" || weidu_type == "baf") && game_path == "") {
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
        conlog(`preprocessing ${base_name}...`);
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
            `${base_name}`,
        ];
        const result = cp.spawnSync("gcc", gcc_args, { cwd: cwd_to });
        conlog("stdout: " + result.stdout);
        if (result.stderr) {
            conlog("stderr: " + result.stderr);
        }
        if (result.status != 0) {
            conlog("error: " + result.status);
            if (interactive) {
                connection.window.showErrorMessage(`Failed to preprocess ${base_name}!`);
            }
            send_diagnostics(uri, result.stderr.toString(), "gcc");
            preprocess_failed = true;
        } else {
            if (interactive) {
                connection.window.showInformationMessage(`Succesfully preprocessed ${base_name}.`);
            }
        }
    }
    if (preprocess_failed) {
        return 1;
    }

    // parse
    conlog(`parsing ${real_name}...`);
    const weidu_cmd = `${weidu_path} ${weidu_args} ${weidu_type} ${real_name} `;
    cp.exec(weidu_cmd, { cwd: cwd_to }, (err: cp.ExecException, stdout: string, stderr: string) => {
        conlog("stdout: " + stdout);
        const parse_result = parse_weidu_output(stdout); // dupe, yes
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
                send_diagnostics(uri, stdout);
            }
        } else {
            if (interactive) {
                connection.window.showInformationMessage(`Succesfully parsed ${real_name}.`);
            }
        }
    });
}

export async function load_data(headersDirectory: string) {
    const completion_list: Array<CompletionItemEx> = [];
    const hover_map = new Map<string, HoverEx>();
    const headers_list = find_files(headersDirectory, "tph");

    for (const header_path of headers_list) {
        const text = fs.readFileSync(path.join(headersDirectory, header_path), "utf8");
        const header_data = find_symbols(text);
        load_functions(header_path, header_data, completion_list, hover_map);
    }
    const result: DynamicData = { completion: completion_list, hover: hover_map };
    return result;
}

function find_symbols(text: string) {
    const define_list: DefineList = [];
    const action_regex =
        /^(DEFINE_ACTION_FUNCTION|DEFINE_ACTION_MACRO|DEFINE_PATCH_FUNCTION|DEFINE_PATCH_MACRO)\s+(\w+)/gm;

    let match = action_regex.exec(text);
    while (match != null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (match.index === action_regex.lastIndex) {
            action_regex.lastIndex++;
        }
        const name = match[2];
        let context: "action" | "patch";
        let dtype: "function" | "macro";
        if (match[1].startsWith("DEFINE_ACTION")) {
            context = "action";
        } else {
            context = "patch";
        }
        if (match[1].endsWith("FUNCTION")) {
            dtype = "function";
        } else {
            dtype = "macro";
        }
        define_list.push({ name: name, context: context, dtype: dtype });
        match = action_regex.exec(text);
    }
    return define_list;
}

function load_functions(
    path: string,
    define_list: DefineList,
    completion_list: CompletionList,
    hover_map: HoverMap
) {
    const lang_id = "weidu-tp2-tooltip";

    for (const define of define_list) {
        const markdown_value = [
            "```" + `${lang_id}`,
            `${define.context} ${define.dtype} ${define.name}`,
            "```",
            "\n```bgforge-mls-comment\n",
            `${path}`,
            "```",
        ].join("\n");

        const markdown_contents = { kind: MarkupKind.Markdown, value: markdown_value };
        const completion_item = {
            label: define.name,
            documentation: markdown_contents,
            source: path,
            kind: CompletionItemKind.Function,
        };
        completion_list.push(completion_item);
        const hover_item = { contents: markdown_contents, source: path };
        hover_map.set(define.name, hover_item);
    }
}
