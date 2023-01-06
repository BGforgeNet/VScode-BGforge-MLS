import { Range } from "vscode-languageserver-textdocument";
import { conlog } from "./common";
import { ProjectTraSettings } from "./settings";
import * as translation from "./translation";
// const hints = new Map<string, []>();

function getHintString(traEntries: translation.TraEntries, traFileKey: string, lineKey: string) {
    let value: string;
    if (!traEntries) {
        value = `/* Error: no such file ${traFileKey} */`
    } else {
        value = traEntries.get(lineKey);
        if (!value) {
            value = `/* Error: no such string ${traFileKey}:${lineKey} */`
        }
    }
    return `/* ${value} */`;
}

export function preloadHints(text: string, traType: "msg" | "tra", traSettings: ProjectTraSettings, filePath: string, langId: string) {
    const hints = [];
    const traFileKey = translation.getTraFileKey(filePath, text, traSettings,langId);
    const traEntries = translation.getTraEntries(traFileKey);
    conlog("preparing hints");
    const lines = text.split("\n");
    let regex: RegExp;
    if (traType == "msg") {
        regex =
            /(Reply|NOption|GOption|BOption|mstr|display_mstr|floater|NLowOption|BLowOption|GLowOption)\((\d+)/g;
    } else {
        regex = /@(\d+)/g;
    }
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const matches = l.matchAll(regex);
        for (const m of matches) {
            const char_end = m.index + m[0].length;
            const pos = { line: i, character: char_end };
            const value = getHintString(traEntries, traFileKey, m[2]);
            const hint = { position: pos, label: value,  kind: 2, paddingLeft: true, paddingRight: true };
            hints.push(hint);
        }
    }
    return hints;
}

export function getHints(range: Range, text: string, traSettings: ProjectTraSettings, filePath: string, langId: string) {
    const hints = preloadHints(text, "msg", traSettings, filePath, langId);
    const line1 = range.start.line;
    const line2 = range.end.line;
    conlog(`lines length is $lines.length}`);
    return hints;
}
