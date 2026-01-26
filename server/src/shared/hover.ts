/**
 * Hover data types and loading utilities.
 * Defines the Hover data structures and static data loading.
 */

import { Hover } from "vscode-languageserver/node";
import { MapData } from "./feature-data";

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
