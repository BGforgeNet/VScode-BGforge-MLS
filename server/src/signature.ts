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

export function sig_response(signature: SignatureInformation, parameter: number) {
    const result = {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: parameter,
    };
    return result;
}

export interface SigReqData {
    label: string;
    parameter: number;
}

/** Finds label and current parameter index */
export function find_label_for_signature(line: string, pos: number) {
    // only left side matters for signature
    const left = line.slice(0, pos);
    const last_char = left.slice(-1);
    // short circuit on closing parenthesis
    if (last_char == ")") {
        return null;
    }
    const split_on_paren = left.split("(");
    const args = split_on_paren.pop();
    const symbol = split_on_paren.pop().split(/(\s+)/).pop();
    const pos_in_args = pos - (left.length - args.length);
    // again, right side doesn't matter
    const args_left = args.slice(0, pos_in_args);
    const arg_num = args_left.split(",").length - 1;
    const result: SigReqData = { label: symbol, parameter: arg_num };
    return result;
}
