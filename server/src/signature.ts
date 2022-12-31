import { readFileSync } from "fs";
import path = require("path");
import { SignatureInformation } from "vscode-languageserver/node";
import { conlog } from "./common";

export interface SignatureMap extends Map<string, SignatureInformation> {}
export interface SignatureData extends Map<string, SignatureMap> {}

export const static_signatures: SignatureData = new Map();
export const signature_languages = ["fallout-ssl"];

export function load_static_signatures() {
    for (const lang_id of signature_languages) {
        try {
            const file_path = path.join(__dirname, `signature.${lang_id}.json`);
            const json_data = JSON.parse(readFileSync(file_path, "utf-8"));
            const sig_data: SignatureMap = new Map(Object.entries(json_data));
            static_signatures.set(lang_id, sig_data);
        } catch (e) {
            conlog(e);
        }
    }
}
