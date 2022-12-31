import { readFileSync } from "fs";
import path = require("path");
import { Hover } from "vscode-languageserver/node";
import { conlog } from "./common";

export interface HoverEx extends Hover {
    source: string;
}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}
export interface HoverData extends Map<string, HoverMap | HoverMapEx> {}
export interface HoverDataEx extends Map<string, HoverMapEx> {}

export const static_hover: HoverData = new Map();
export const dynamic_hover: HoverDataEx = new Map();
export const self_hover: HoverDataEx = new Map();

const hover_languages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function load_static_hover() {
    for (const lang_id of hover_languages) {
        try {
            const file_path = path.join(__dirname, `hover.${lang_id}.json`);
            const json_data = JSON.parse(readFileSync(file_path, "utf-8"));
            const hover_data: Map<string, Hover> = new Map(Object.entries(json_data));
            static_hover.set(lang_id, hover_data);
        } catch (e) {
            conlog(e);
        }
    }
}
