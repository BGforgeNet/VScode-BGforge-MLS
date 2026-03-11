/**
 * WeiDU D file parser.
 * Extracts cross-file references (state label locations) from a single
 * tree-sitter AST parse, returning a unified ParseResult.
 *
 * D files have no user-defined functions/macros, so symbols is always empty.
 * Only the reference index (dialog-scoped state labels) is populated.
 *
 * NOTE: reference-finder.ts has structurally similar AST traversal (same node types)
 * but filters by a specific (dialogFile, labelName) pair for single-file rename/references.
 * If new node types are added to the grammar, both this file and reference-finder.ts
 * must be updated.
 */

import { Location } from "vscode-languageserver/node";
import type { Node as SyntaxNode } from "web-tree-sitter";
import { type ParseResult, EMPTY_PARSE_RESULT } from "../core/parse-result";
import { makeRange } from "../core/position-utils";
import { SyntaxType } from "./tree-sitter.d";
import { normalizeDialogFile } from "./state-utils";
import { parseWithCache, isInitialized } from "./parser";

/** Build the composite key for dialog-scoped labels. */
function labelKey(dialogFile: string, labelName: string): string {
    return `${dialogFile}:${labelName}`;
}

/**
 * Parse a D file and return references (state label locations).
 * Symbols is always empty — D files have no user-defined functions/macros.
 */
export function parseFile(uri: string, text: string): ParseResult {
    if (!isInitialized()) {
        return EMPTY_PARSE_RESULT;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return EMPTY_PARSE_RESULT;
    }

    const refs = new Map<string, Location[]>();

    function addRef(dialogFile: string, labelName: string, loc: Location): void {
        const key = labelKey(dialogFile, labelName);
        let locs = refs.get(key);
        if (!locs) {
            locs = [];
            refs.set(key, locs);
        }
        locs.push(loc);
    }

    function visit(node: SyntaxNode): void {
        // begin_action or append_action: collect state defs, GOTOs, ShortGotos, ExternNexts
        if (node.type === SyntaxType.BeginAction || node.type === SyntaxType.AppendAction) {
            const fileNode = node.childForFieldName("file");
            if (fileNode) {
                const dialogFile = normalizeDialogFile(fileNode.text);
                collectRefsInScope(node, dialogFile, uri, addRef);
            }
            // Don't recurse — collectRefsInScope handles children
            return;
        }

        // Top-level actions with file + state/label fields.
        // If handled, skip children to avoid double-counting (e.g., ChainEpilogue).
        if (collectTopLevelRefs(node, uri, addRef)) {
            return;
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(tree.rootNode);
    return { symbols: [], refs };
}

/** Collect state label refs inside a begin_action or append_action scope. */
function collectRefsInScope(
    scopeNode: SyntaxNode,
    scopeDialog: string,
    uri: string,
    addRef: (dialogFile: string, labelName: string, loc: Location) => void,
): void {
    function visit(node: SyntaxNode): void {
        // State definition
        if (node.type === SyntaxType.State) {
            const label = node.childForFieldName("label");
            if (label) {
                addRef(scopeDialog, label.text, { uri, range: makeRange(label) });
            }
        }

        // GOTO reference
        if (node.type === SyntaxType.GotoNext) {
            const label = node.childForFieldName("label");
            if (label) {
                addRef(scopeDialog, label.text, { uri, range: makeRange(label) });
            }
        }

        // Short GOTO
        if (node.type === SyntaxType.ShortGoto) {
            const label = node.childForFieldName("label");
            if (label) {
                addRef(scopeDialog, label.text, { uri, range: makeRange(label) });
            }
        }

        // ExternNext inside scope
        if (node.type === SyntaxType.ExternNext) {
            const fileNode = node.childForFieldName("file");
            const label = node.childForFieldName("label");
            if (fileNode && label) {
                addRef(normalizeDialogFile(fileNode.text), label.text, { uri, range: makeRange(label) });
            }
        }

        // CopyTrans in transitions
        if (node.type === SyntaxType.CopyTrans) {
            const fileNode = node.childForFieldName("file");
            const stateNode = node.childForFieldName("state");
            if (fileNode && stateNode) {
                addRef(normalizeDialogFile(fileNode.text), stateNode.text, { uri, range: makeRange(stateNode) });
            }
        }

        for (const child of node.children) {
            visit(child);
        }
    }
    // Processes the scope root and all descendants; nested begin_action is not expected by grammar design
    visit(scopeNode);
}

/**
 * Collect refs from top-level actions that reference (dialogFile, labelName).
 * Returns true if the node was handled (caller should NOT recurse into children).
 */
function collectTopLevelRefs(
    node: SyntaxNode,
    uri: string,
    addRef: (dialogFile: string, labelName: string, loc: Location) => void,
): boolean {
    const type = node.type;

    // CHAIN action: file + label + chain_epilogue children
    if (type === SyntaxType.ChainAction) {
        collectFileLabel(node, "file", "label", uri, addRef);
        for (const child of node.children) {
            if (child.type === SyntaxType.ChainEpilogue) {
                collectFileLabel(child, "file", "label", uri, addRef);
            }
        }
        return true;
    }

    // INTERJECT action: file + label + chain_epilogue children
    if (type === SyntaxType.InterjectAction || type === SyntaxType.InterjectCopyTrans) {
        collectFileLabel(node, "file", "label", uri, addRef);
        for (const child of node.children) {
            if (child.type === SyntaxType.ChainEpilogue) {
                collectFileLabel(child, "file", "label", uri, addRef);
            }
        }
        return true;
    }

    // EXTEND_TOP/EXTEND_BOTTOM: file + states[] + transition refs
    if (type === SyntaxType.ExtendAction) {
        const fileNode = node.childForFieldName("file");
        if (fileNode) {
            const dialogFile = normalizeDialogFile(fileNode.text);
            const statesNodes = node.childrenForFieldName("states");
            for (const stateNode of statesNodes) {
                addRef(dialogFile, stateNode.text, { uri, range: makeRange(stateNode) });
            }
            collectTransitionRefs(node, dialogFile, uri, addRef);
        }
        return true;
    }

    // ADD_STATE_TRIGGER, ADD_TRANS_TRIGGER, REPLACE_SAY, REPLACE_STATE_TRIGGER, SET_WEIGHT
    if (type === SyntaxType.AddStateTrigger || type === SyntaxType.AddTransTrigger ||
        type === SyntaxType.ReplaceSay || type === SyntaxType.ReplaceStateTrigger ||
        type === SyntaxType.SetWeight) {
        collectFileLabel(node, "file", "state", uri, addRef);
        return true;
    }

    return false;
}

/** Extract file + label/state fields and add a ref. */
function collectFileLabel(
    node: SyntaxNode,
    fileField: string,
    labelField: string,
    uri: string,
    addRef: (dialogFile: string, labelName: string, loc: Location) => void,
): void {
    const fileNode = node.childForFieldName(fileField);
    const labelNode = node.childForFieldName(labelField);
    if (fileNode && labelNode) {
        addRef(normalizeDialogFile(fileNode.text), labelNode.text, { uri, range: makeRange(labelNode) });
    }
}

/** Collect GOTO and ShortGoto refs inside transitions (for EXTEND_TOP/EXTEND_BOTTOM). */
function collectTransitionRefs(
    parent: SyntaxNode,
    dialogFile: string,
    uri: string,
    addRef: (dialog: string, label: string, loc: Location) => void,
): void {
    function visit(node: SyntaxNode): void {
        if (node.type === SyntaxType.GotoNext || node.type === SyntaxType.ShortGoto) {
            const label = node.childForFieldName("label");
            if (label) {
                addRef(dialogFile, label.text, { uri, range: makeRange(label) });
            }
        }
        for (const child of node.children) {
            visit(child);
        }
    }
    visit(parent);
}
