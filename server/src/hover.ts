import * as fs from "fs";
import * as path from "path";
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

export const staticData: HoverData = new Map();
export const dynamicData: HoverDataEx = new Map();
export const selfData: HoverDataEx = new Map();

const hoverLanguages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function loadStatic() {
    for (const langId of hoverLanguages) {
        try {
            const filePath = path.join(__dirname, `hover.${langId}.json`);
            const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            const hoverData: Map<string, Hover> = new Map(Object.entries(jsonData));
            staticData.set(langId, hoverData);
        } catch (e) {
            conlog(e);
        }
    }
}

function onlyDigits(value: string) {
    return /^\d+$/.test(value);
}

/** get word under cursor, for which we want to find a hover */
export function symbolAtPosition(text: string, position: Position) {
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
