/**
 * Dialog parser for WeiDU D files using tree-sitter.
 * Extracts dialog structure (blocks, states, transitions) for tree visualization.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { parseWithCache, isInitialized } from "./parser";
import { SyntaxType } from "./tree-sitter.d";

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

export type DDialogTarget =
    | { kind: "goto"; label: string }
    | { kind: "extern"; file: string; label: string }
    | { kind: "exit" }
    | { kind: "copy_trans"; file: string; label: string };

export interface DDialogTransition {
    line: number;
    replyText?: string;
    trigger?: string;
    action?: string;
    target: DDialogTarget;
}

export interface DDialogState {
    label: string;
    line: number;
    sayText: string;
    trigger?: string;
    speaker?: string;
    transitions: DDialogTransition[];
    blockLabel?: string;
}

/** Structural blocks produce dialog states. Modify blocks patch existing dialogs. */
export type DDialogBlockKind = "begin" | "append" | "chain" | "extend" | "interject" | "replace" | "modify";

export interface DDialogBlock {
    kind: DDialogBlockKind;
    file: string;
    line: number;
    label?: string;
    /** Display name for modify blocks (e.g. "ALTER_TRANS", "REPLACE_TRANS_TRIGGER") */
    actionName?: string;
    /** Human-readable summary for modify blocks */
    description?: string;
    /** State labels/numbers targeted by this block (for linking in modify blocks) */
    stateRefs?: string[];
}

export interface DDialogData {
    blocks: DDialogBlock[];
    states: DDialogState[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse dialog structure from D file text using tree-sitter.
 */
export function parseDDialog(text: string): DDialogData {
    if (!isInitialized()) {
        return { blocks: [], states: [] };
    }
    const tree = parseWithCache(text);
    if (!tree) {
        return { blocks: [], states: [] };
    }

    const blocks: DDialogBlock[] = [];
    const states: DDialogState[] = [];

    for (const child of tree.rootNode.children) {
        switch (child.type) {
            // Structural actions (produce dialog states)
            case SyntaxType.BeginAction:
                parseBeginAction(child, blocks, states);
                break;
            case SyntaxType.AppendAction:
                parseAppendAction(child, blocks, states);
                break;
            case SyntaxType.ChainAction:
                parseChainAction(child, blocks, states);
                break;
            case SyntaxType.ExtendAction:
                parseExtendAction(child, blocks, states);
                break;
            case SyntaxType.InterjectAction:
            case SyntaxType.InterjectCopyTrans:
                parseInterjectAction(child, blocks, states);
                break;
            case SyntaxType.ReplaceAction:
                parseReplaceAction(child, blocks, states);
                break;

            // Modification actions (patch existing dialogs)
            case SyntaxType.AlterTrans:
                parseAlterTrans(child, blocks);
                break;
            case SyntaxType.AddStateTrigger:
                parseAddStateTrigger(child, blocks);
                break;
            case SyntaxType.AddTransAction:
                parseAddTransAction(child, blocks);
                break;
            case SyntaxType.AddTransTrigger:
                parseAddTransTrigger(child, blocks);
                break;
            case SyntaxType.ReplaceSay:
                parseReplaceSay(child, blocks);
                break;
            case SyntaxType.ReplaceStateTrigger:
                parseReplaceStateTrigger(child, blocks);
                break;
            case SyntaxType.ReplaceTransAction:
                parseReplaceTransAction(child, blocks);
                break;
            case SyntaxType.ReplaceTransTrigger:
                parseReplaceTransTrigger(child, blocks);
                break;
            case SyntaxType.SetWeight:
                parseSetWeight(child, blocks);
                break;
            case SyntaxType.ReplaceActionText:
            case SyntaxType.ReplaceActionTextProcess:
            case SyntaxType.ReplaceActionTextRegexp:
                parseReplaceText(child, blocks, "REPLACE_ACTION_TEXT");
                break;
            case SyntaxType.ReplaceTriggerText:
            case SyntaxType.ReplaceTriggerTextRegexp:
                parseReplaceText(child, blocks, "REPLACE_TRIGGER_TEXT");
                break;
        }
    }

    return { blocks, states };
}

// ---------------------------------------------------------------------------
// Structural block parsers
// ---------------------------------------------------------------------------

function parseBeginAction(node: SyntaxNode, blocks: DDialogBlock[], states: DDialogState[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    blocks.push({
        kind: "begin",
        file,
        line: node.startPosition.row + 1,
    });

    for (const child of node.children) {
        if (child.type === SyntaxType.State) {
            const state = parseState(child, file);
            if (state) {
                states.push(state);
            }
        }
    }
}

function parseAppendAction(node: SyntaxNode, blocks: DDialogBlock[], states: DDialogState[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    blocks.push({
        kind: "append",
        file,
        line: node.startPosition.row + 1,
    });

    for (const child of node.children) {
        if (child.type === SyntaxType.State) {
            const state = parseState(child, file);
            if (state) {
                states.push(state);
            }
        }
    }
}

function parseChainAction(node: SyntaxNode, blocks: DDialogBlock[], states: DDialogState[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const labelNode = node.childForFieldName("label");
    const label = labelNode ? labelNode.text : undefined;

    blocks.push({
        kind: "chain",
        file,
        line: node.startPosition.row + 1,
        label,
    });

    flattenChain(node, file, label, states);
}

function parseExtendAction(node: SyntaxNode, blocks: DDialogBlock[], states: DDialogState[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const statesField = node.childrenForFieldName("states");
    const stateRefs = statesField.map((s) => s.text).join(", ");
    const line = node.startPosition.row + 1;

    blocks.push({
        kind: "extend",
        file,
        line,
        label: stateRefs || undefined,
    });

    // EXTEND adds transitions to existing states -- extract as pseudo-state
    const transitions: DDialogTransition[] = [];
    for (const child of node.children) {
        if (child.type === SyntaxType.Transition) {
            transitions.push(...parseTransitionContainer(child));
        }
    }

    if (transitions.length > 0) {
        states.push({
            label: stateRefs || "extended",
            line,
            sayText: "",
            speaker: file,
            transitions,
            // Tag with blockLabel so getBlockStates doesn't mix with APPEND states
            blockLabel: `extend_${line}`,
        });
    }
}

function parseInterjectAction(node: SyntaxNode, blocks: DDialogBlock[], states: DDialogState[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const labelNode = node.childForFieldName("label");
    const label = labelNode ? labelNode.text : undefined;

    blocks.push({
        kind: "interject",
        file,
        line: node.startPosition.row + 1,
        label,
    });

    // Interjects may contain chain-like text sequences
    flattenChain(node, file, label, states);
}

function parseReplaceAction(node: SyntaxNode, blocks: DDialogBlock[], states: DDialogState[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    blocks.push({
        kind: "replace",
        file,
        line: node.startPosition.row + 1,
    });

    // REPLACE has child states just like APPEND
    for (const child of node.children) {
        if (child.type === SyntaxType.State) {
            const state = parseState(child, file);
            if (state) {
                states.push(state);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Modification block parsers
// ---------------------------------------------------------------------------

function parseAlterTrans(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const stateRefs = extractStateRefs(node);
    const changes = extractAlterTransParts(node);

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "ALTER_TRANS",
        description: changes || undefined,
        stateRefs: stateRefs.length > 0 ? stateRefs : undefined,
    });
}

function parseAddStateTrigger(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const state = getNodeFieldText(node, "state") ?? "?";
    const trigger = getNodeFieldText(node, "trigger") ?? "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "ADD_STATE_TRIGGER",
        description: truncate(trigger, 80) || undefined,
        stateRefs: [state],
    });
}

function parseAddTransAction(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const stateRefs = extractStateRefs(node);
    const action = getNodeFieldText(node, "action") ?? "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "ADD_TRANS_ACTION",
        description: truncate(action, 80) || undefined,
        stateRefs: stateRefs.length > 0 ? stateRefs : undefined,
    });
}

function parseAddTransTrigger(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const state = getNodeFieldText(node, "state") ?? "?";
    const trigger = getNodeFieldText(node, "trigger") ?? "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "ADD_TRANS_TRIGGER",
        description: truncate(trigger, 80) || undefined,
        stateRefs: [state],
    });
}

function parseReplaceSay(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const state = getNodeFieldText(node, "state") ?? "?";
    const textNode = node.childForFieldName("text");
    const text = textNode ? extractTextContent(textNode) : "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "REPLACE_SAY",
        description: truncate(text, 80) || undefined,
        stateRefs: [state],
    });
}

function parseReplaceStateTrigger(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const state = getNodeFieldText(node, "state") ?? "?";
    const trigger = getNodeFieldText(node, "trigger") ?? "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "REPLACE_STATE_TRIGGER",
        description: truncate(trigger, 80) || undefined,
        stateRefs: [state],
    });
}

function parseReplaceTransAction(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const stateRefs = extractStateRefs(node);
    const oldText = getNodeFieldText(node, "old_text") ?? "";
    const newText = getNodeFieldText(node, "new_text") ?? "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "REPLACE_TRANS_ACTION",
        description: `${truncate(oldText, 40)} -> ${truncate(newText, 40)}`,
        stateRefs: stateRefs.length > 0 ? stateRefs : undefined,
    });
}

function parseReplaceTransTrigger(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const stateRefs = extractStateRefs(node);
    const oldText = getNodeFieldText(node, "old_text") ?? "";
    const newText = getNodeFieldText(node, "new_text") ?? "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "REPLACE_TRANS_TRIGGER",
        description: `${truncate(oldText, 40)} -> ${truncate(newText, 40)}`,
        stateRefs: stateRefs.length > 0 ? stateRefs : undefined,
    });
}

function parseSetWeight(node: SyntaxNode, blocks: DDialogBlock[]): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const state = getNodeFieldText(node, "state") ?? "?";
    const weightNodes = node.childrenForFieldName("weight");
    const weight = weightNodes.map((w) => w.text).join("");

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName: "SET_WEIGHT",
        description: weight || undefined,
        stateRefs: [state],
    });
}

function parseReplaceText(node: SyntaxNode, blocks: DDialogBlock[], actionName: string): void {
    const file = getNodeFieldText(node, "file");
    if (!file) return;

    const oldText = getNodeFieldText(node, "old_text") ?? "";
    const newText = getNodeFieldText(node, "new_text") ?? "";

    blocks.push({
        kind: "modify",
        file,
        line: node.startPosition.row + 1,
        actionName,
        description: `${truncate(oldText, 40)} -> ${truncate(newText, 40)}`,
    });
}

// ---------------------------------------------------------------------------
// State parser
// ---------------------------------------------------------------------------

function parseState(node: SyntaxNode, speaker: string): DDialogState | undefined {
    const labelNode = node.childForFieldName("label");
    if (!labelNode) return undefined;

    const label = labelNode.text;
    const sayText = extractSayText(node);
    const trigger = extractTrigger(node);
    const transitions: DDialogTransition[] = [];

    for (const child of node.children) {
        if (child.type === SyntaxType.Transition) {
            transitions.push(...parseTransitionContainer(child));
        }
    }

    return {
        label,
        line: node.startPosition.row + 1,
        sayText,
        trigger: trigger || undefined,
        speaker,
        transitions,
    };
}

// ---------------------------------------------------------------------------
// Transition parsers
// ---------------------------------------------------------------------------

/**
 * Parse all transitions inside a transition container node.
 * A Transition node wraps one or more TransitionFull, TransitionShort, or CopyTrans.
 */
function parseTransitionContainer(container: SyntaxNode): DDialogTransition[] {
    const transitions: DDialogTransition[] = [];

    for (const child of container.children) {
        switch (child.type) {
            case SyntaxType.TransitionFull:
                transitions.push(parseTransitionFull(child));
                break;
            case SyntaxType.TransitionShort:
                transitions.push(parseTransitionShort(child));
                break;
            case SyntaxType.CopyTrans:
                transitions.push(parseCopyTrans(child));
                break;
        }
    }

    // If the container itself has target nodes directly (not wrapped in full/short)
    if (transitions.length === 0) {
        const target = extractTarget(container);
        if (target) {
            transitions.push({
                line: container.startPosition.row + 1,
                target,
            });
        }
    }

    return transitions;
}

function parseTransitionFull(node: SyntaxNode): DDialogTransition {
    const trigger = extractTransitionTrigger(node);
    const replyText = extractReplyText(node);
    const action = extractDoAction(node);
    const target = extractTarget(node) ?? { kind: "exit" as const };

    return {
        line: node.startPosition.row + 1,
        replyText: replyText || undefined,
        trigger: trigger || undefined,
        action: action || undefined,
        target,
    };
}

function parseTransitionShort(node: SyntaxNode): DDialogTransition {
    const replyNode = node.childForFieldName("reply");
    const replyText = replyNode ? extractTextContent(replyNode) : undefined;
    const action = extractDoAction(node);

    // Short transitions use short_goto for target
    const target = extractTarget(node) ?? { kind: "exit" as const };

    return {
        line: node.startPosition.row + 1,
        replyText: replyText || undefined,
        action: action || undefined,
        target,
    };
}

function parseCopyTrans(node: SyntaxNode): DDialogTransition {
    const file = getNodeFieldText(node, "file") ?? "";
    const stateNode = node.childForFieldName("state");
    const label = stateNode ? stateNode.text : "";

    return {
        line: node.startPosition.row + 1,
        target: { kind: "copy_trans", file, label },
    };
}

// ---------------------------------------------------------------------------
// CHAIN flattening
// ---------------------------------------------------------------------------

/**
 * Flatten a CHAIN (or INTERJECT) into synthetic states connected by GOTO transitions.
 */
function flattenChain(
    node: SyntaxNode,
    initialSpeaker: string,
    chainLabel: string | undefined,
    states: DDialogState[],
): void {
    const syntheticStates: DDialogState[] = [];
    let currentSpeaker = initialSpeaker;
    let stateIndex = 0;

    for (const child of node.children) {
        if (child.type === SyntaxType.ChainText) {
            const sayText = extractChainText(child);
            const trigger = extractChainTextTrigger(child);
            const label = stateIndex === 0 && chainLabel
                ? chainLabel
                : `${chainLabel ?? "chain"}_${stateIndex}`;

            syntheticStates.push({
                label,
                line: child.startPosition.row + 1,
                sayText,
                trigger: trigger || undefined,
                speaker: currentSpeaker,
                transitions: [],
                blockLabel: chainLabel,
            });
            stateIndex++;
        } else if (child.type === SyntaxType.ChainSpeaker) {
            const speakerFile = getNodeFieldText(child, "file");
            if (speakerFile) {
                currentSpeaker = speakerFile;
            }
        } else if (child.type === SyntaxType.ChainEpilogue) {
            // Epilogue contains the final transition(s) for the chain
            const transitions = parseChainEpilogue(child);
            if (syntheticStates.length > 0) {
                const lastState = syntheticStates[syntheticStates.length - 1]!;
                lastState.transitions.push(...transitions);
            }
        } else if (child.type === SyntaxType.ChainBranch) {
            // Branch: conditional transitions within a chain
            const transitions = parseChainBranch(child);
            if (syntheticStates.length > 0) {
                const lastState = syntheticStates[syntheticStates.length - 1]!;
                lastState.transitions.push(...transitions);
            }
        }
    }

    // Connect sequential chain states with GOTO transitions
    for (let i = 0; i < syntheticStates.length - 1; i++) {
        const current = syntheticStates[i]!;
        const next = syntheticStates[i + 1]!;
        // Only add auto-transition if no explicit transitions exist
        if (current.transitions.length === 0) {
            current.transitions.push({
                line: current.line,
                target: { kind: "goto", label: next.label },
            });
        }
    }

    states.push(...syntheticStates);
}

function parseChainEpilogue(node: SyntaxNode): DDialogTransition[] {
    const transitions: DDialogTransition[] = [];

    for (const child of node.children) {
        if (child.type === SyntaxType.Transition) {
            transitions.push(...parseTransitionContainer(child));
        }
    }

    // Direct target on epilogue itself
    if (transitions.length === 0) {
        const target = extractTarget(node);
        if (target) {
            transitions.push({
                line: node.startPosition.row + 1,
                target,
            });
        }
    }

    return transitions;
}

function parseChainBranch(node: SyntaxNode): DDialogTransition[] {
    const transitions: DDialogTransition[] = [];

    for (const child of node.children) {
        if (child.type === SyntaxType.Transition) {
            transitions.push(...parseTransitionContainer(child));
        }
    }

    return transitions;
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

function extractSayText(stateNode: SyntaxNode): string {
    const sayNode = stateNode.childForFieldName("say");
    if (!sayNode) return "";
    return extractSayTextContent(sayNode);
}

/**
 * Extract text from a say_text node, which may contain tilde_string, tra_ref, tlk_ref, or at_var_ref.
 */
function extractSayTextContent(sayTextNode: SyntaxNode): string {
    for (const child of sayTextNode.children) {
        switch (child.type) {
            case SyntaxType.TildeString:
                return extractTildeContent(child);
            case SyntaxType.String:
                return extractStringContent(child);
            case SyntaxType.TraRef:
                return child.text;
            case SyntaxType.TlkRef:
                return child.text;
            case SyntaxType.AtVarRef:
                return child.text;
            case SyntaxType.DoubleString:
                return extractDoubleContent(child);
        }
    }
    return sayTextNode.text.trim();
}

function extractTildeContent(node: SyntaxNode): string {
    for (const child of node.children) {
        if (child.type === SyntaxType.TildeContent) {
            return child.text;
        }
    }
    // Fallback: strip surrounding tildes
    const text = node.text;
    if (text.startsWith("~") && text.endsWith("~")) {
        return text.slice(1, -1);
    }
    return text;
}

function extractStringContent(node: SyntaxNode): string {
    // String node may contain tilde_string, double_string, etc.
    for (const child of node.children) {
        if (child.type === SyntaxType.TildeString) {
            return extractTildeContent(child);
        }
        if (child.type === SyntaxType.DoubleString) {
            return extractDoubleContent(child);
        }
    }
    return node.text;
}

function extractDoubleContent(node: SyntaxNode): string {
    for (const child of node.children) {
        if (child.type === SyntaxType.DoubleContent) {
            return child.text;
        }
    }
    const text = node.text;
    if (text.startsWith('"') && text.endsWith('"')) {
        return text.slice(1, -1);
    }
    return text;
}

function extractTextContent(node: SyntaxNode): string {
    switch (node.type) {
        case SyntaxType.TildeString:
            return extractTildeContent(node);
        case SyntaxType.String:
            return extractStringContent(node);
        case SyntaxType.TraRef:
        case SyntaxType.TlkRef:
        case SyntaxType.AtVarRef:
            return node.text;
        case SyntaxType.DoubleString:
            return extractDoubleContent(node);
        default:
            // For say_text or other wrapper nodes
            return extractSayTextContent(node);
    }
}

function extractChainText(chainTextNode: SyntaxNode): string {
    // chain_text children include say_text nodes
    for (const child of chainTextNode.children) {
        if (child.type === SyntaxType.SayText) {
            return extractSayTextContent(child);
        }
    }
    // Fallback: look for direct text content nodes
    for (const child of chainTextNode.children) {
        switch (child.type) {
            case SyntaxType.TildeString:
                return extractTildeContent(child);
            case SyntaxType.String:
                return extractStringContent(child);
            case SyntaxType.TraRef:
            case SyntaxType.TlkRef:
            case SyntaxType.AtVarRef:
                return child.text;
        }
    }
    return chainTextNode.text.trim();
}

function extractChainTextTrigger(chainTextNode: SyntaxNode): string | undefined {
    const triggerNode = chainTextNode.childForFieldName("trigger");
    if (!triggerNode) return undefined;
    return extractStringContent(triggerNode) || undefined;
}

function extractTrigger(stateNode: SyntaxNode): string | undefined {
    const triggerNode = stateNode.childForFieldName("trigger");
    if (!triggerNode) return undefined;
    const content = extractStringContent(triggerNode);
    // Empty trigger (~~ or "") is not meaningful
    if (!content.trim()) return undefined;
    return content;
}

function extractTransitionTrigger(transitionNode: SyntaxNode): string | undefined {
    const triggerNode = transitionNode.childForFieldName("trigger");
    if (!triggerNode) return undefined;
    const content = extractStringContent(triggerNode);
    if (!content.trim()) return undefined;
    return content;
}

function extractDoAction(transitionNode: SyntaxNode): string | undefined {
    for (const child of transitionNode.children) {
        if (child.type === SyntaxType.DoFeature) {
            const actionNode = child.childForFieldName("action");
            if (actionNode) {
                return extractStringContent(actionNode);
            }
        }
    }
    return undefined;
}

function extractReplyText(transitionNode: SyntaxNode): string | undefined {
    for (const child of transitionNode.children) {
        if (child.type === SyntaxType.ReplyFeature) {
            const textNode = child.childForFieldName("text");
            if (textNode) {
                return extractTextContent(textNode);
            }
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Target extraction
// ---------------------------------------------------------------------------

function extractTarget(node: SyntaxNode): DDialogTarget | undefined {
    for (const child of node.children) {
        switch (child.type) {
            case SyntaxType.GotoNext: {
                const labelNode = child.childForFieldName("label");
                if (labelNode) {
                    return { kind: "goto", label: labelNode.text };
                }
                break;
            }
            case SyntaxType.ShortGoto: {
                const labelNode = child.childForFieldName("label");
                if (labelNode) {
                    return { kind: "goto", label: labelNode.text };
                }
                break;
            }
            case SyntaxType.ExternNext: {
                const fileNode = child.childForFieldName("file");
                const labelNode = child.childForFieldName("label");
                if (fileNode && labelNode) {
                    return { kind: "extern", file: fileNode.text, label: labelNode.text };
                }
                break;
            }
            case SyntaxType.ExitNext:
                return { kind: "exit" };
            case SyntaxType.CopyTrans: {
                const fileNode = child.childForFieldName("file");
                const stateNode = child.childForFieldName("state");
                if (fileNode && stateNode) {
                    return { kind: "copy_trans", file: fileNode.text, label: stateNode.text };
                }
                break;
            }
        }

        // Recurse into transition containers
        const nested = extractTarget(child);
        if (nested) return nested;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// ALTER_TRANS detail extraction
// ---------------------------------------------------------------------------

/**
 * Extract human-readable summary from ALTER_TRANS node.
 * ALTER_TRANS file BEGIN state END BEGIN trans END BEGIN changes END
 * The grammar doesn't expose state/trans as named fields, so we walk children.
 */
function extractAlterTransParts(node: SyntaxNode): string {
    const parts: string[] = [];
    // Collect all AlterTransChange children for the change descriptions
    for (const child of node.children) {
        if (child.type === SyntaxType.AlterTransChange) {
            parts.push(truncate(child.text, 60));
        }
    }
    if (parts.length > 0) {
        return parts.join("; ");
    }
    return "";
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Extract state label references from unnamed _state_label_list children.
 * These appear as Identifier/StateLabelAlnum/Number nodes between BEGIN/END keywords.
 */
function extractStateRefs(node: SyntaxNode): string[] {
    const refs: string[] = [];
    let inList = false;
    let listCount = 0;
    for (const child of node.children) {
        // "BEGIN" and "END" are tree-sitter anonymous (keyword) nodes, not named node types.
        // They don't appear in the SyntaxType enum and must be matched as raw strings.
        if (child.type === "BEGIN") {
            // Only the first BEGIN...END pair is the state list
            if (listCount === 0) {
                inList = true;
            }
            continue;
        }
        if (child.type === "END") {
            if (inList) {
                inList = false;
                listCount++;
            }
            continue;
        }
        if (inList) {
            refs.push(child.text);
        }
    }
    return refs;
}

function getNodeFieldText(node: SyntaxNode, fieldName: string): string | undefined {
    const child = node.childForFieldName(fieldName);
    if (!child) return undefined;
    // Strip quotes/tildes from identifiers and strings
    const text = child.text;
    if ((text.startsWith("~") && text.endsWith("~")) || (text.startsWith('"') && text.endsWith('"'))) {
        return text.slice(1, -1);
    }
    return text;
}

function truncate(text: string, maxLen: number): string {
    const singleLine = text.replace(/\s+/g, " ").trim();
    if (singleLine.length <= maxLen) return singleLine;
    return singleLine.slice(0, maxLen - 1) + "\u2026";
}
