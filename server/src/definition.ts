import { Location } from "vscode-languageserver";
import { conlog } from "./common";

export const staticData = new Map();
export const dynamicData = new Map();
export const selfData = new Map();

export interface Definition extends Map<string, Location> {}
export interface DefinitionMap extends Map<string, Definition> {}

export interface DefinitionItem {
    name: string;
    line: number;
    start: number;
    end: number;
}
export interface DefinitionList extends Array<DefinitionItem> {}

export function getLocation(langId: string, uri: string, symbol: string) {
    const empty: Location[] = [];

    let result: Location;

    const staticMap = staticData.get(langId);
    const dynamicMap = dynamicData.get(langId);
    const selfMap = selfData.get(uri);

    if (!staticMap && !dynamicMap && !selfMap) {
        return empty;
    }

    if (selfMap) {
        result = selfMap.get(symbol);
        if (result) {
            return result;
        }
    }

    if (dynamicMap) {
        result = dynamicMap.get(symbol);
        if (result) {
            return result;
        }
    }

    if (staticMap) {
        result = staticMap.get(symbol);
        if (result) {
            return result;
        }
    }

    return empty;
}
