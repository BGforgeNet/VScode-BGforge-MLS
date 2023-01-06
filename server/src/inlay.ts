import { InlayHint } from "vscode-languageserver";
import { Range } from "vscode-languageserver-textdocument";
import { conlog } from "./common";
import { ProjectTraSettings } from "./settings";
import * as translation from "./translation";

export interface HintData extends Map<string, Array<InlayHint>> {}

const hintData: HintData = new Map();

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

export function preloadHints(
    text: string,
    traSettings: ProjectTraSettings,
    relPath: string,
    langId: string
) {
    const hints = [];
    const traFileKey = translation.getTraFileKey(relPath, text, traSettings, langId);
    const traEntries = translation.getTraEntries(traFileKey);
    const traExt = translation.getTraExt(langId);
    conlog("preparing hints");
    const lines = text.split("\n");
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
            const pos = { line: i, character: char_end };
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
    hintData.set(relPath, hints);
}

/**
 * Returns all hints in range from a pregenerated map
 * @param relPath 
 * @param range 
 * @returns array of hints
 */
export function getHints(relPath: string, range: Range) {
    let hints = hintData.get(relPath);
    if (!hints) {
        return;
    }
    const line1 = range.start.line;
    const line2 = range.end.line;
    hints = hints.filter((hint) => {
        if (hint.position.line < line1 || hint.position.line > line2) {
            return false;
        }
        return true;
    });
    return hints;
}
