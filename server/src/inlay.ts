import { InlayHint } from "vscode-languageserver";
import { Range } from "vscode-languageserver-textdocument";
import { ProjectTraSettings } from "./settings";
import * as translation from "./translation";

function getHintString(traEntries: translation.TraEntries, traFileKey: string, lineKey: string) {
    let value: string;
    if (!traEntries) {
        value = `/* Error: no such file ${traFileKey} */`;
    } else {
        const traEntry = traEntries.get(lineKey);
        if (!traEntry) {
            value = `/* Error: no such string ${traFileKey}:${lineKey} */`;
        } else {
            value = traEntry.inlay;
        }
    }
    return value;
}

export function getHints(
    text: string,
    traSettings: ProjectTraSettings,
    relPath: string,
    langId: string,
    range: Range
) {
    const hints = [];
    const traFileKey = translation.getTraFileKey(relPath, text, traSettings, langId);
    const traEntries = translation.getTraEntries(traFileKey);
    const traExt = translation.getTraExt(langId);
    let lines = text.split("\n");
    lines = lines.slice(range.start.line, range.end.line);

    let regex: RegExp;
    if (traExt == "msg") {
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
            const lineKey = m[2]
            const pos = { line: range.start.line + i, character: char_end };
            const value = getHintString(traEntries, traFileKey, lineKey);
            const hint: InlayHint = {
                position: pos,
                label: value,
                kind: 2,
                paddingLeft: true,
                paddingRight: true,
            };
            hints.push(hint);
        }
    }
    return hints;
}
