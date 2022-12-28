"use strict";

import * as path from "path";
import { CompletionItem, Hover } from "vscode-languageserver/node";
import { connection } from "./server";
export const diag_src = "BGforge MLS";

export function fname(uri: string) {
    return path.basename(uri);
}

export async function conlog(item: any) {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    switch (typeof item) {
        case "number":
            connection.console.log(item.toString());
            break;
        case "boolean":
            connection.console.log(item.toString());
            break;
        case "undefined":
            connection.console.log(item);
            break;
        case "string":
            connection.console.log(item);
            break;
        default:
            if (item.size && item.size > 0 && JSON.stringify(item) == "{}") {
                connection.console.log(JSON.stringify([...item]));
            } else {
                connection.console.log(JSON.stringify(item));
            }
            break;
    }
}

// get word under cursor
export function get_word_at(str: string, pos: number) {
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

/** Save item source for defines */
export interface CompletionItemEx extends CompletionItem {
    source: string;
}

export interface HoverEx extends Hover {
    source: string;
}

export interface DynamicData {
    completion: Array<CompletionItemEx>;
    hover: Map<string, HoverEx>;
}

// single language
export interface CompletionList extends Array<CompletionItem> {}
export interface CompletionListEx extends Array<CompletionItemEx> {}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}
// all languages
export interface CompletionData extends Map<string, CompletionList | CompletionListEx> {}
export interface CompletionDataEx extends Map<string, CompletionListEx> {}
export interface HoverData extends Map<string, HoverMap | HoverMapEx> {}
export interface HoverDataEx extends Map<string, HoverMapEx> {}
