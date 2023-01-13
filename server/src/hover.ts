import * as fs from "fs";
import * as path from "path";
import { Hover } from "vscode-languageserver/node";
import { conlog } from "./common";

/** source is path, relative to workspace root, or absolute if not in workspace */
export interface HoverEx extends Hover {
    source: string;
    uri: string
}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}
export interface HoverData extends Map<string, HoverMap | HoverMapEx> {}
export interface HoverDataEx extends Map<string, HoverMapEx> {}

/** uri => [item list] */
export interface SelfMap extends Map<string, HoverMap> {}
export interface Data {
    self: SelfMap;
    headers: HoverMapEx;
    extHeaders?: HoverMapEx;
    static: HoverMap;
}

export const staticData: HoverData = new Map();
export const dynamicData: HoverDataEx = new Map();
export const selfData: HoverDataEx = new Map();

const languages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function loadStatic(langId: string): HoverMap {
    try {
        const filePath = path.join(__dirname, `hover.${langId}.json`);
        const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const hover: HoverMap = new Map(Object.entries(jsonData));
        return hover;
    } catch (e) {
        conlog(e);
    }
}
