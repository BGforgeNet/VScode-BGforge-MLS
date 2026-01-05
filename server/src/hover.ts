import { Hover } from "vscode-languageserver/node";
import { MapData } from "./shared/feature-data";
import { loadStaticMap } from "./shared/static-data";

/** source is path, relative to workspace root, or absolute if not in workspace */
export interface HoverEx extends Hover {
    source: string;
    uri: string;
}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}

/**
 * Hover data container using the standard self/headers/extHeaders/static pattern.
 * - self: per-document hovers (uri → Map<symbol, HoverEx>)
 * - headers: workspace header hovers
 * - extHeaders: external headers hovers
 * - static: built-in hovers from JSON
 */
export type Data = MapData<HoverEx, Hover>;

export function loadStatic(langId: string): HoverMap {
    return loadStaticMap<Hover>("hover", langId);
}
