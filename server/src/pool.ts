import PromisePool from "@supercharge/promise-pool";
import * as fs from "fs";
import * as path from "path";
import { pathToUri } from "./common";
import { HeaderData as LanguageHeaderData } from "./language";

export async function processHeaders(
    headerFiles: string[],
    headersDirectory: string,
    // Func def is used
    // eslint-disable-next-line no-unused-vars
    func: (uri: string, text: string, filePath: string) => LanguageHeaderData,
    external = false
) {
    const { results, errors } = await PromisePool.withConcurrency(4)
        .for(headerFiles)
        .process(async (relPath) => {
            const absPath = path.join(headersDirectory, relPath);
            const text = fs.readFileSync(absPath, "utf8");
            const uri = pathToUri(absPath);
            let pathString: string;
            if (external) {
                pathString = absPath;
            } else {
                pathString = relPath;
            }
            return func(uri, text, pathString);
        });
    return { results, errors };
}
