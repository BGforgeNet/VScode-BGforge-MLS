import { readFileSync } from "fs";
import path = require("path");
import { Position, SignatureInformation } from "vscode-languageserver/node";
import { conlog } from "./common";

export interface SignatureMap extends Map<string, SignatureInformation> {}
export interface SignatureData extends Map<string, SignatureMap> {}

export const staticData: SignatureData = new Map();
export const languages = ["fallout-ssl"];

export function loadStatic() {
    for (const langId of languages) {
        try {
            const filePath = path.join(__dirname, `signature.${langId}.json`);
            const jsonData = JSON.parse(readFileSync(filePath, "utf-8"));
            const sigData: SignatureMap = new Map(Object.entries(jsonData));
            staticData.set(langId, sigData);
        } catch (e) {
            conlog(e);
        }
    }
}

export function getResponse(signature: SignatureInformation, parameter: number) {
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
export function getLabel(text: string, position: Position) {
    const lines = text.split(/\r?\n/g);
    const line = lines[position.line];
    const pos = position.character;

    // only left side matters for signature
    const left = line.slice(0, pos);
    const lastChar = left.slice(-1);
    // short circuit on closing parenthesis
    if (lastChar == ")") {
        return null;
    }
    const splitOnParen = left.split("(");
    const args = splitOnParen.pop();
    const symbol = splitOnParen.pop().split(/(\s+)/).pop();
    const posInArgs = pos - (left.length - args.length);
    // again, right side doesn't matter
    const argsLeft = args.slice(0, posInArgs);
    const argNum = argsLeft.split(",").length - 1;
    const result: SigReqData = { label: symbol, parameter: argNum };
    return result;
}
