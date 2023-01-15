import { readFileSync } from "fs";
import path = require("path");
import { Position, SignatureInformation } from "vscode-languageserver/node";
import { conlog } from "./common";

export interface SigMap extends Map<string, SignatureInformation> {}

/** uri => [item list] */
export interface SelfMap extends Map<string, SigMap> {}
export interface Data {
    self: SelfMap;
    headers: SigMap;
    extHeaders?: SigMap;
    static: SigMap;
}

export const languages = ["fallout-ssl"];

export function loadStatic(langId: string): SigMap {
    try {
        const filePath = path.join(__dirname, `signature.${langId}.json`);
        const jsonData = JSON.parse(readFileSync(filePath, "utf-8"));
        const sigData: SigMap = new Map(Object.entries(jsonData));
        return sigData;
    } catch (e) {
        conlog(e);
    }
    return new Map();
}

export function getResponse(signature: SignatureInformation, parameter: number) {
    const result = {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: parameter,
    };
    return result;
}

export interface Request {
    symbol: string;
    parameter: number;
}

/** Finds label and current parameter index */
export function getRequest(text: string, position: Position) {
    const lines = text.split(/\r?\n/g);
    const line = lines[position.line];
    const pos = position.character;

    // only left side matters for signature
    const left = line.slice(0, pos);
    const lastChar = left.slice(-1);
    // short circuit on closing parenthesis
    if (lastChar == ")") {
        return;
    }
    const splitOnParen = left.split("(");
    const args = splitOnParen.pop();
    if (!args) {
        return;
    }
    const symbol = args.split(/(\s+)/).pop();
    if (!symbol) {
        return;
    }
    const posInArgs = pos - (left.length - args.length);
    // again, right side doesn't matter
    const argsLeft = args.slice(0, posInArgs);
    const argNum = argsLeft.split(",").length - 1;
    const request: Request = { symbol: symbol, parameter: argNum };
    return request;
}
