import { readFileSync } from "fs";
import path = require("path");
import { Position } from "vscode-languageserver-textdocument";
import { Hover } from "vscode-languageserver/node";
import { conlog } from "./common";

export interface HoverEx extends Hover {
    source: string;
}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}
export interface HoverData extends Map<string, HoverMap | HoverMapEx> {}
export interface HoverDataEx extends Map<string, HoverMapEx> {}

export const data_static: HoverData = new Map();
export const data_dynamic: HoverDataEx = new Map();
export const data_self: HoverDataEx = new Map();

const hover_languages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function load_static() {
    for (const lang_id of hover_languages) {
        try {
            const file_path = path.join(__dirname, `hover.${lang_id}.json`);
            const json_data = JSON.parse(readFileSync(file_path, "utf-8"));
            const hover_data: Map<string, Hover> = new Map(Object.entries(json_data));
            data_static.set(lang_id, hover_data);
        } catch (e) {
            conlog(e);
        }
    }
}

/** get word under cursor, for which we want to find a hover */
export function symbol_at_position(text: string, position: Position) {
    const lines = text.split(/\r?\n/g);
    const str = lines[position.line];
    const pos = position.character;

    // Search for the word's beginning and end.
    const left = str.slice(0, pos + 1).search(/\w+$/),
        right = str.slice(pos).search(/\W/);
    // The last word in the string is a special case.
    if (right < 0) {
        return str.slice(left);
    }
    // Return the word, using the located bounds to extract it from the string.
    return str.slice(left, right + pos);
}
