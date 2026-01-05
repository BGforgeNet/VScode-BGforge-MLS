/**
 * Inlay hint generation for translation references.
 * Shows translated string previews inline for @123 or NOption(123) style references.
 */

import { InlayHint } from "vscode-languageserver";
import { Range } from "vscode-languageserver-textdocument";
import { TraEntries, TraExt } from "./translation";

interface HintValue {
    label: string;
    tooltip?: string;
}

function getHintString(traEntries: TraEntries, traFileKey: string, lineKey: string): HintValue {
    const traEntry = traEntries.get(lineKey);
    if (traEntry === undefined) {
        return { label: `/* Error: no such string ${traFileKey}:${lineKey} */`, tooltip: "" };
    }
    return {
        label: traEntry.inlay,
        tooltip: traEntry.inlayTooltip ?? "",
    };
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
            /(Reply|NOption|GOption|BOption|mstr|display_mstr|floater|NLowOption|BLowOption|GLowOption|GMessage|NMessage|BMessage|CompOption)\((\d+)/g;
    } else {
        regex = /@(\d+)/g;
    }

    lines.forEach((l, i) => {
        const matches = l.matchAll(regex);
        for (const m of matches) {
            if (!m.index) {
                continue;
            }
            const char_end = m.index + m[0].length;
            let lineKey: string | undefined;
            if (traExt == "msg") {
                lineKey = m[2];
            } else {
                lineKey = m[1];
            }
            if (!lineKey) continue;
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
    });
    return hints;
}
