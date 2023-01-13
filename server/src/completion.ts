import { readFileSync } from "fs";
import path = require("path");
import { CompletionItem } from "vscode-languageserver/node";
import { conlog } from "./common";

/** source is path, relative to workspace root, or absolute if not in workspace */
export interface CompletionItemEx extends CompletionItem {
    uri: string;
    source: string;
}
export interface CompletionList extends Array<CompletionItem> {}
export interface CompletionListEx extends Array<CompletionItemEx> {}

export interface CompletionData extends Map<string, CompletionList | CompletionListEx> {}
export interface CompletionDataEx extends Map<string, CompletionListEx> {}

/** uri => [item list] */
export interface SelfMap extends Map<string, CompletionListEx> {}
export interface Data {
    self: SelfMap;
    headers: CompletionListEx;
    extHeaders?: CompletionListEx;
    static: CompletionList;
}

export const staticData: CompletionData = new Map();
export const dynamicData: CompletionDataEx = new Map();
export const selfData: CompletionDataEx = new Map();

export const languages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function loadStatic(langId: string): CompletionList {
    try {
        const filePath = path.join(__dirname, `completion.${langId}.json`);
        const completion = JSON.parse(readFileSync(filePath, "utf-8"));
        return completion;
    } catch (e) {
        conlog(e);
    }
}
