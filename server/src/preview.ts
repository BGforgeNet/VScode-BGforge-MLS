import * as fs from "fs";
import * as path from "path";
import { stripLiteralRegex } from "strip-literal";
import { conlog, isDirectory, tmpDir } from "./common";
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

export function preview(text: string, langId: string, previewSrcDir: string) {
    text = stripLiteralRegex(text);
    let willPreview = false;
    if (langId == "fallout-ssl") {
        const data: Data | undefined = fallout.getPreviewData(text);
        if (data) {
            conlog(data);
            const dataString = JSON.stringify(data);
            // dataString = "export const elements = " + dataString;
            const previewDir = path.join(tmpDir, "preview");

            const dataFile = path.join(previewDir, "data.json");
            if (!isDirectory(previewDir)) {
                fs.mkdirSync(previewDir);
            }
            fs.writeFileSync(dataFile, dataString);

            for (const fileName of ["index.css", "index.js", "index.html"]) {
                const dstPath = path.join(previewDir, fileName);
                const srcPath = path.join(previewSrcDir, fileName);
                if (!fs.existsSync(dstPath)) {
                    fs.copyFileSync(srcPath, dstPath);
                } else {
                    const srcSize = fs.statSync(srcPath).size;
                    const dstSize = fs.statSync(dstPath).size;
                    if (srcSize != dstSize) {
                        fs.copyFileSync(srcPath, dstPath);
                    }
                }
            }

            willPreview = true;
        }
    }
    return willPreview;
}
