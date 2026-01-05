import { stripLiteralRegex } from "strip-literal";
import { conlog } from "./common";
import * as fallout from "./fallout";
import { LANG_FALLOUT_SSL } from "./lang-ids";

export interface Node {
    data: { id: string };
}
export interface Edge {
    data: { id: string; source: string; target: string };
}

export interface Data {
    nodes: Node[];
    edges: Edge[];
}

export function getPreviewData(text: string, langId: string): Data | undefined {
    text = stripLiteralRegex(text);
    if (langId == LANG_FALLOUT_SSL) {
        const data = fallout.getPreviewData(text);
        conlog(data);
        return data;
    }
    return undefined;
}
