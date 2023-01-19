import { InlayHint } from "vscode-languageserver";
import { Range } from "vscode-languageserver-textdocument";
import { TraEntries, TraExt } from "./translation";

interface HintValue {
    label: string;
    tooltip?: string;
}

function getHintString(traEntries: TraEntries, traFileKey: string, lineKey: string) {
    let value: string;
    let tooltip = "";
    if (!traEntries) {
        value = `/* Error: no such file ${traFileKey} */`;
    } else {
        const traEntry = traEntries.get(lineKey);
        if (!traEntry) {
            value = `/* Error: no such string ${traFileKey}:${lineKey} */`;
        } else {
            value = traEntry.inlay;
            if (traEntry.inlayTooltip) {
                tooltip = traEntry.inlayTooltip;
            }
        }
    }
    const result: HintValue = { label: value, tooltip: tooltip };
    return result;
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
            if (!m.index) {
                continue;
            }
            const char_end = m.index + m[0].length;
            let lineKey: string;
            if (traExt == "msg") {
                lineKey = m[2];
            } else {
                lineKey = m[1];
            }
            const pos = { line: range.start.line + i, character: char_end };
            const hintValue = getHintString(traEntries, traFileKey, lineKey);
            const hint: InlayHint = {
                position: pos,
                label: hintValue.label,
                tooltip: hintValue.tooltip,
                kind: 2,
                paddingLeft: true,
                paddingRight: true,
            };
            hints.push(hint);
        }
    }
    return hints;
}
