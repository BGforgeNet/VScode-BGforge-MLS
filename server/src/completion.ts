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

export const staticData: CompletionData = new Map();
export const dynamicData: CompletionDataEx = new Map();
export const selfData: CompletionDataEx = new Map();

export const languages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function loadStatic() {
    for (const langId of languages) {
        try {
            const filePath = path.join(__dirname, `completion.${langId}.json`);
            const completionList = JSON.parse(readFileSync(filePath, "utf-8"));
            staticData.set(langId, completionList);
        } catch (e) {
            conlog(e);
        }
    }
}
