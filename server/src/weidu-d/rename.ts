/**
 * Rename symbol for WeiDU D files.
 * Supports dialog-scoped state label rename.
 *
 * A state label's identity is (dialogFile, labelName).
 * Rename collects ALL references with matching pair across the entire source_file.
 *
 * Public API: prepareRenameSymbol, renameSymbol.
 */

import { Position, TextEdit, WorkspaceEdit } from "vscode-languageserver/node";
import type { Node as SyntaxNode } from "web-tree-sitter";
import { makeRange } from "../core/position-utils";
import { parseWithCache, isInitialized } from "./parser";
import { SyntaxType } from "./tree-sitter.d";
import { findLabelNodeAtPosition, normalizeDialogFile } from "./state-utils";

/** WeiDU D state labels: alphanumeric identifiers. */
const VALID_STATE_LABEL = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Prepares for rename by validating the position and returning the range and placeholder.
 * Returns null if rename is not allowed at this position.
 */
export function prepareRenameSymbol(
    text: string,
    position: Position
): { range: { start: Position; end: Position }; placeholder: string } | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const labelInfo = findLabelNodeAtPosition(tree.rootNode, position);
    if (!labelInfo) {
        return null;
    }

    // Ensure there's a definition for this label in the file
    const refs = findAllDialogLabelRefs(tree.rootNode, labelInfo.dialogFile, labelInfo.labelNode.text);
    const hasDefinition = refs.some(r => r.isDefinition);
    if (!hasDefinition) {
        lastPrepareResult = null;
        return null;
    }

    // Cache for the subsequent renameSymbol call
    lastPrepareResult = {
        text,
        dialogFile: labelInfo.dialogFile,
        labelName: labelInfo.labelNode.text,
        refs,
    };

    return {
        range: makeRange(labelInfo.labelNode),
        placeholder: labelInfo.labelNode.text,
    };
}

/**
 * Rename a symbol at the given position.
 * Returns null if the symbol cannot be renamed.
 */
export function renameSymbol(
    text: string,
    position: Position,
    newName: string,
    uri: string
): WorkspaceEdit | null {
    if (!isInitialized() || !VALID_STATE_LABEL.test(newName)) {
        return null;
    }

    const tree = parseWithCache(text);
    if (!tree) {
        return null;
    }

    const labelInfo = findLabelNodeAtPosition(tree.rootNode, position);
    if (!labelInfo) {
        return null;
    }

    // Reuse cached refs from prepareRename if the text and label match
    const cached = lastPrepareResult;
    const refs = (cached && cached.text === text && cached.dialogFile === labelInfo.dialogFile && cached.labelName === labelInfo.labelNode.text)
        ? cached.refs
        : findAllDialogLabelRefs(tree.rootNode, labelInfo.dialogFile, labelInfo.labelNode.text);
    lastPrepareResult = null;

    if (refs.length === 0) {
        return null;
    }

    const hasDefinition = refs.some(r => r.isDefinition);
    if (!hasDefinition) {
        return null;
    }

    const edits: TextEdit[] = refs.map(ref => ({
        range: makeRange(ref.node),
        newText: newName,
    }));

    return { changes: { [uri]: edits } };
}

/** A reference to a state label in the AST. */
interface LabelRef {
    readonly node: SyntaxNode;
    readonly isDefinition: boolean;
}

/**
 * Cache the last prepareRename result to avoid double AST traversal.
 * LSP calls prepareRename then rename sequentially — the second call
 * reuses the refs found by the first if the text hasn't changed.
 */
let lastPrepareResult: {
    readonly text: string;
    readonly dialogFile: string;
    readonly labelName: string;
    readonly refs: readonly LabelRef[];
} | null = null;

/**
 * Find all references to (dialogFile, labelName) in the entire tree.
 *
 * Group A — inside begin_action/append_action with matching fileNode:
 *   State.label (definition), GotoNext.label, ShortGoto.label
 *
 * Group B — top-level actions with matching file field:
 *   ExternNext, ChainAction, InterjectAction, InterjectCopyTrans,
 *   ExtendAction, AddStateTrigger, AddTransTrigger, CopyTrans,
 *   ReplaceSay, ReplaceStateTrigger, SetWeight, ChainEpilogue
 */
function findAllDialogLabelRefs(root: SyntaxNode, dialogFile: string, labelName: string): readonly LabelRef[] {
    const refs: LabelRef[] = [];

    function visit(node: SyntaxNode): void {
        // Group A: begin_action or append_action scope
        if (node.type === SyntaxType.BeginAction || node.type === SyntaxType.AppendAction) {
            const fileNode = node.childForFieldName("file");
            if (fileNode && normalizeDialogFile(fileNode.text) === dialogFile) {
                collectRefsInScope(node, dialogFile, labelName, refs);
            }
            // Don't recurse — collectRefsInScope handles children
            return;
        }

        // Group B: top-level actions with file + state/label fields
        // collectTopLevelRefs handles the node AND its children (e.g., chain_epilogue
        // inside chain_action), so return early to avoid double-counting.
        if (collectTopLevelRefs(node, dialogFile, labelName, refs)) {
            return;
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
    return refs;
}

/** Collect state label refs inside a begin_action or append_action scope. */
function collectRefsInScope(scopeNode: SyntaxNode, scopeDialog: string, labelName: string, refs: LabelRef[]): void {
    function visit(node: SyntaxNode): void {
        // State definition
        if (node.type === SyntaxType.State) {
            const label = node.childForFieldName("label");
            if (label && label.text === labelName) {
                refs.push({ node: label, isDefinition: true });
            }
        }

        // GOTO reference
        if (node.type === SyntaxType.GotoNext) {
            const label = node.childForFieldName("label");
            if (label && label.text === labelName) {
                refs.push({ node: label, isDefinition: false });
            }
        }

        // Short GOTO (+ label)
        if (node.type === SyntaxType.ShortGoto) {
            const label = node.childForFieldName("label");
            if (label && label.text === labelName) {
                refs.push({ node: label, isDefinition: false });
            }
        }

        // ExternNext inside a scope — match only if pointing to same dialog
        if (node.type === SyntaxType.ExternNext) {
            const fileNode = node.childForFieldName("file");
            const label = node.childForFieldName("label");
            if (fileNode && label && normalizeDialogFile(fileNode.text) === scopeDialog && label.text === labelName) {
                refs.push({ node: label, isDefinition: false });
            }
        }

        // CopyTrans inside transitions
        if (node.type === SyntaxType.CopyTrans) {
            const fileNode = node.childForFieldName("file");
            const stateNode = node.childForFieldName("state");
            if (fileNode && stateNode && normalizeDialogFile(fileNode.text) === scopeDialog && stateNode.text === labelName) {
                refs.push({ node: stateNode, isDefinition: false });
            }
        }

        for (const child of node.children) {
            visit(child);
        }
    }
    visit(scopeNode);
}

/**
 * Collect refs from top-level actions that reference (dialogFile, labelName).
 * Returns true if the node was handled (caller should NOT recurse into children).
 */
function collectTopLevelRefs(node: SyntaxNode, dialogFile: string, labelName: string, refs: LabelRef[]): boolean {
    const type = node.type;

    // CHAIN action: file + label + chain_epilogue children
    if (type === SyntaxType.ChainAction) {
        matchFileLabel(node, "file", "label", dialogFile, labelName, refs);
        for (const child of node.children) {
            if (child.type === SyntaxType.ChainEpilogue) {
                matchFileLabel(child, "file", "label", dialogFile, labelName, refs);
            }
        }
        return true;
    }

    // INTERJECT action: file + label + chain_epilogue children
    if (type === SyntaxType.InterjectAction || type === SyntaxType.InterjectCopyTrans) {
        matchFileLabel(node, "file", "label", dialogFile, labelName, refs);
        for (const child of node.children) {
            if (child.type === SyntaxType.ChainEpilogue) {
                matchFileLabel(child, "file", "label", dialogFile, labelName, refs);
            }
        }
        return true;
    }

    // EXTEND_TOP/EXTEND_BOTTOM: file + states[] (array field) + transition refs
    if (type === SyntaxType.ExtendAction) {
        const fileNode = node.childForFieldName("file");
        if (fileNode && normalizeDialogFile(fileNode.text) === dialogFile) {
            const statesNodes = node.childrenForFieldName("states");
            for (const stateNode of statesNodes) {
                if (stateNode.text === labelName) {
                    refs.push({ node: stateNode, isDefinition: false });
                }
            }
            collectTransitionRefs(node, labelName, refs);
        }
        return true;
    }

    // ADD_STATE_TRIGGER: file + state
    if (type === SyntaxType.AddStateTrigger) {
        matchFileState(node, dialogFile, labelName, refs);
        return true;
    }

    // ADD_TRANS_TRIGGER: file + state (first field only, extras are unnamed)
    if (type === SyntaxType.AddTransTrigger) {
        matchFileState(node, dialogFile, labelName, refs);
        return true;
    }

    // REPLACE_SAY: file + state
    if (type === SyntaxType.ReplaceSay) {
        matchFileState(node, dialogFile, labelName, refs);
        return true;
    }

    // REPLACE_STATE_TRIGGER: file + state
    if (type === SyntaxType.ReplaceStateTrigger) {
        matchFileState(node, dialogFile, labelName, refs);
        return true;
    }

    // SET_WEIGHT: file + state
    if (type === SyntaxType.SetWeight) {
        matchFileState(node, dialogFile, labelName, refs);
        return true;
    }

    return false;
}

/** Match a node's file + label fields against the target dialog/label. */
function matchFileLabel(
    node: SyntaxNode,
    fileField: string,
    labelField: string,
    dialogFile: string,
    labelName: string,
    refs: LabelRef[]
): void {
    const fileNode = node.childForFieldName(fileField);
    const labelNode = node.childForFieldName(labelField);
    if (fileNode && labelNode && normalizeDialogFile(fileNode.text) === dialogFile && labelNode.text === labelName) {
        refs.push({ node: labelNode, isDefinition: false });
    }
}

/** Match a node's file + state fields against the target dialog/label. */
function matchFileState(node: SyntaxNode, dialogFile: string, labelName: string, refs: LabelRef[]): void {
    matchFileLabel(node, "file", "state", dialogFile, labelName, refs);
}

/** Collect GOTO and ShortGoto refs inside transitions (used for EXTEND_TOP/EXTEND_BOTTOM). */
function collectTransitionRefs(parent: SyntaxNode, labelName: string, refs: LabelRef[]): void {
    function visit(node: SyntaxNode): void {
        if (node.type === SyntaxType.GotoNext || node.type === SyntaxType.ShortGoto) {
            const label = node.childForFieldName("label");
            if (label && label.text === labelName) {
                refs.push({ node: label, isDefinition: false });
            }
        }
        for (const child of node.children) {
            visit(child);
        }
    }
    visit(parent);
}
