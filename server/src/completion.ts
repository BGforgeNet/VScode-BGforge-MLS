import { readFileSync } from "fs";
import path = require("path");
import { CompletionItem } from "vscode-languageserver/node";
import { conlog } from "./common";

/** Save item source for defines */
export interface CompletionItemEx extends CompletionItem {
    source: string;
}
export interface CompletionList extends Array<CompletionItem> {}
export interface CompletionListEx extends Array<CompletionItemEx> {}

export interface CompletionData extends Map<string, CompletionList | CompletionListEx> {}
export interface CompletionDataEx extends Map<string, CompletionListEx> {}

export const static_completion: CompletionData = new Map();
export const dynamic_completion: CompletionDataEx = new Map();
export const self_completion: CompletionDataEx = new Map();
export const completion_languages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function load_static_completion() {
    for (const lang_id of completion_languages) {
        try {
            const file_path = path.join(__dirname, `completion.${lang_id}.json`);
            const completion_list = JSON.parse(readFileSync(file_path, "utf-8"));
            static_completion.set(lang_id, completion_list);
        } catch (e) {
            conlog(e);
        }
    }
}
