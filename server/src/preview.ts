import { stripLiteralRegex } from "strip-literal";
import { conlog } from "./common";
import * as fallout from "./fallout";

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
    if (langId == "fallout-ssl") {
        const data = fallout.getPreviewData(text);
        if (data) {
            conlog(data);
            return data;
        }
    }
    return undefined;
}
