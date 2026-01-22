/**
 * Parallel header file processing using promise pool.
 * Processes multiple header files concurrently to extract definitions and completions.
 */

import PromisePool from "@supercharge/promise-pool";
import * as fs from "fs";
import * as path from "path";
import { normalizeUri, pathToUri } from "../common";
import { HeaderData as LanguageHeaderData } from "../data-loader";

export async function processHeaders(
    headerFiles: string[],
    headersDirectory: string,
    func: (uri: string, text: string, filePath: string) => LanguageHeaderData,
    external = false
) {
    const { results, errors } = await PromisePool.withConcurrency(4)
        .for(headerFiles)
        .process(async (relPath) => {
            const absPath = path.join(headersDirectory, relPath);
            const text = fs.readFileSync(absPath, "utf8");
            // Normalize URI to resolve symlinks for consistent comparison
            const uri = normalizeUri(pathToUri(absPath));
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
