import * as fs from "fs";
import * as path from "path";
import { Position } from "vscode-languageserver-textdocument";
import { Hover } from "vscode-languageserver/node";
import { conlog, find_files, is_directory } from "./common";
import { ProjectTraSettings } from "./settings";

export interface HoverEx extends Hover {
    source: string;
}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}
export interface HoverData extends Map<string, HoverMap | HoverMapEx> {}
export interface HoverDataEx extends Map<string, HoverMapEx> {}

interface TraEntries extends Map<string, string> {}
interface TraFiles extends Map<string, TraEntries> {}

export const data_static: HoverData = new Map();
export const data_dynamic: HoverDataEx = new Map();
export const data_self: HoverDataEx = new Map();
export const data_tra: TraFiles = new Map();

const hover_languages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function load_static() {
    for (const lang_id of hover_languages) {
        try {
            const file_path = path.join(__dirname, `hover.${lang_id}.json`);
            const json_data = JSON.parse(fs.readFileSync(file_path, "utf-8"));
            const hover_data: Map<string, Hover> = new Map(Object.entries(json_data));
            data_static.set(lang_id, hover_data);
        } catch (e) {
            conlog(e);
        }
    }
}

function onlyDigits(value: string) {
    return /^\d+$/.test(value);
}

/** get word under cursor, for which we want to find a hover */
export function symbol_at_position(text: string, position: Position) {
    const lines = text.split(/\r?\n/g);
    const str = lines[position.line];
    const pos = position.character;

    // Search for the word's beginning and end.
    let left = str.slice(0, pos + 1).search(/\w+$/),
        right = str.slice(pos).search(/\W/);

    let result: string;
    // The last word in the string is a special case.
    if (right < 0) {
        result = str.slice(left);
    } else {
        // Return the word, using the located bounds to extract it from the string.
        result = str.slice(left, right + pos);
    }

    // if a proper symbol, return
    if (!onlyDigits(result)) {
        return result;
    }

    // and if pure numeric, check if it's a tra reference
    if (onlyDigits(result)) {
        left = str.slice(0, pos + 1).search(/\S+$/);
        right = str.slice(pos).search(/\W/);
        if (right < 0) {
            result = str.slice(left);
        } else {
            result = str.slice(left, right + pos);
        }
    }

    return result;
}

/** Loads all tra files in a directory to a map of maps of strings */
export function load_translation(traSettings: ProjectTraSettings) {
    const tra_dir = traSettings.directory;
    if (!is_directory(tra_dir)) {
        conlog(`${tra_dir} is not a directory, aborting tra load`);
        return;
    }
    const tra_files = find_files(tra_dir, "tra");
    for (const tf of tra_files) {
        const lines = load_tra_file(path.join(tra_dir, tf), "tra");
        const tra_key = tf.slice(0, -4);
        data_tra.set(tra_key, lines);
    }
    // hardly in any project there will be both tra and msg files
    const msg_files = find_files(tra_dir, "msg");
    for (const tf of msg_files) {
        const lines = load_tra_file(path.join(tra_dir, tf), "msg");
        const tra_key = tf.slice(0, -4);
        data_tra.set(tra_key, lines);
    }
}

export function reload_tra_file(tra_dir: string, tra_path: string) {
    const lines = load_tra_file(path.join(tra_dir, tra_path), "tra");
    const tra_key = tra_path.slice(0, -4);
    data_tra.set(tra_key, lines);
    conlog(`reloaded ${tra_dir} / ${tra_path}`);
}

/** Loads a .tra file and return a map of num > string */
function load_tra_file(fpath: string, tra_type: "tra" | "msg") {
    const text = fs.readFileSync(fpath, "utf8");
    let regex: RegExp;
    if (tra_type == "tra") {
        regex = /@(\d+)\s*=\s*~([^~]*)~/gm;
    } else {
        regex = /{(\d+)}\s*{\w*}\s*{([^}]*)}/gm;
    }
    const lines: TraEntries = new Map();
    let match = regex.exec(text);
    while (match != null) {
        if (match.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        const num = match[1];
        const str = match[2];
        lines.set(num, str);
        match = regex.exec(text);
    }
    return lines;
}

function get_tra_file_key(fpath: string, full_text: string, settings: ProjectTraSettings) {
    const first_line = full_text.split(/\r?\n/g)[0];
    const regex = /^\/\*\* mls.tra: ([\w-]+)\.tra \*\//gm;
    const match = regex.exec(first_line);
    if (match) {
        return match[1];
    }
    if (settings.auto_tra) {
        return path.parse(fpath).name;
    }
}

export function get_tra_for(
    id: string,
    full_text: string,
    settings: ProjectTraSettings,
    fpath: string,
    tra_type: "tra" | "msg" = "tra"
) {
    const file_key = get_tra_file_key(fpath, full_text, settings);
    const tra_file = data_tra.get(file_key);
    let result: Hover;

    if (!tra_file) {
        result = {
            contents: {
                kind: "plaintext",
                value: "Error: file " + `${file_key}.${tra_type}` + " not found.",
            },
        };
        return result;
    }

    // remove @ from tra key start, leave for msg
    if (tra_type != "msg") {
        id = id.substring(1);
    }

    const tra = tra_file.get(id);
    if (!tra) {
        result = {
            contents: {
                kind: "plaintext",
                value: "Error: entry " + `${id}` + " not found in " + `${file_key}.${tra_type}.`,
            },
        };
        return result;
    }

    result = {
        contents: { kind: "markdown", value: "```weidu-tra-string\n" + `${tra}` + "\n```" },
    };
    return result;
}

export function get_msg_for(
    id: string,
    full_text: string,
    settings: ProjectTraSettings,
    fpath: string
) {
    const regex = /(Reply|NOption|GOption|BOption|mstr|display_mstr|floater)\((\d+)/;
    const match = regex.exec(id);
    if (match) {
        const result = get_tra_for(match[2], full_text, settings, fpath, "msg");
        return result;
    }
}
