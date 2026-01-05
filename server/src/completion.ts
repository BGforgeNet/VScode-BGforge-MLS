import { CompletionItem } from "vscode-languageserver/node";
import { ListData } from "./shared/feature-data";
import { loadStaticJson } from "./shared/static-data";

/** source is path, relative to workspace root, or absolute if not in workspace */
export interface CompletionItemEx extends CompletionItem {
    uri: string;
    source: string;
}
export interface CompletionList extends Array<CompletionItem> {}
export interface CompletionListEx extends Array<CompletionItemEx> {}

/**
 * Completion data container using the standard self/headers/extHeaders/static pattern.
 * - self: per-document completions (uri → CompletionItemEx[])
 * - headers: workspace header completions
 * - extHeaders: external headers completions
 * - static: built-in completions from JSON
 */
export type Data = ListData<CompletionItemEx, CompletionItem>;

export function loadStatic(langId: string): CompletionList {
    return loadStaticJson<CompletionList>("completion", langId) ?? [];
}
