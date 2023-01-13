import { InlayHint } from "vscode-languageserver";
import { Range } from "vscode-languageserver-textdocument";
import { TraEntries, TraExt } from "./translation";

function getHintString(traEntries: TraEntries, traFileKey: string, lineKey: string) {
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
    traFileKey: string,
    traEntries: TraEntries,
    traExt: TraExt,
    text: string,
    range: Range
) {
    const hints: InlayHint[] = [];
    if (!traFileKey) {
        return hints;
    }

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
            let lineKey: string;
            if (traExt == "msg") {
                lineKey = m[2];
            } else {
                lineKey = m[1];
            }
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
