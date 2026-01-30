/**
 * TD Intermediate Representation Types
 *
 * These types represent the parsed structure of a TD file before
 * emission to D format. The IR is language-agnostic and captures
 * all D constructs.
 */

// =============================================================================
// Enums
// =============================================================================

/** Top-level D construct types. */
export enum TDConstructType {
    Begin = "begin",
    Append = "append",
    ExtendTop = "extend_top",
    ExtendBottom = "extend_bottom",
    Chain = "chain",
    Interject = "interject",
    InterjectCopyTrans = "interject_copy_trans",
    InterjectCopyTrans2 = "interject_copy_trans2",
    Patch = "patch",
}

/** Text content types. */
export enum TDTextType {
    Tra = "tra",
    Tlk = "tlk",
    Literal = "literal",
    Forced = "forced",
}

/** Transition destination types. */
export enum TDTransitionType {
    Goto = "goto",
    Exit = "exit",
    Extern = "extern",
    CopyTrans = "copy_trans",
}

/** Chain epilogue types. */
export enum TDEpilogueType {
    Exit = "exit",
    End = "end",
    CopyTrans = "copy_trans",
    Transitions = "transitions",
}

/** Patch operation types. */
export enum TDPatchOp {
    AlterTrans = "alter_trans",
    AddStateTrigger = "add_state_trigger",
    AddTransTrigger = "add_trans_trigger",
    AddTransAction = "add_trans_action",
    ReplaceTransTrigger = "replace_trans_trigger",
    ReplaceTransAction = "replace_trans_action",
    ReplaceTriggerText = "replace_trigger_text",
    ReplaceActionText = "replace_action_text",
    SetWeight = "set_weight",
    ReplaceSay = "replace_say",
    ReplaceStateTrigger = "replace_state_trigger",
    ReplaceStates = "replace_states",
}

// =============================================================================
// Script-level types
// =============================================================================

/** A complete TD script, can contain multiple constructs */
export interface TDScript {
    sourceFile: string;
    constructs: TDConstruct[];
}

/** Top-level D construct */
export type TDConstruct =
    | TDBegin
    | TDAppend
    | TDExtend
    | TDChain
    | TDInterject
    | TDPatch;

/** BEGIN - new dialog file */
export interface TDBegin {
    type: TDConstructType.Begin;
    filename: string;
    nonPausing?: boolean;
    states: TDState[];
}

/** APPEND - add states to existing dialog */
export interface TDAppend {
    type: TDConstructType.Append;
    filename: string;
    ifFileExists?: boolean;
    states: TDState[];
}

/** EXTEND_TOP / EXTEND_BOTTOM - add transitions to existing state */
export interface TDExtend {
    type: TDConstructType.ExtendTop | TDConstructType.ExtendBottom;
    filename: string;
    stateLabel: string;
    position?: number;
    transitions: TDTransition[];
}

/** CHAIN - multi-speaker conversation */
export interface TDChain {
    type: TDConstructType.Chain;
    filename: string;
    label: string;
    trigger?: string;
    weight?: number;
    action?: string;
    ifFileExists?: boolean;
    entries: TDChainEntry[];
    epilogue: TDChainEpilogue;
}

/** INTERJECT variants */
export interface TDInterject {
    type: TDConstructType.Interject | TDConstructType.InterjectCopyTrans | TDConstructType.InterjectCopyTrans2;
    filename: string;
    stateLabel: string;
    globalVariable: string;
    safe?: boolean;
    entries: TDChainEntry[];
    epilogue?: TDChainEpilogue; // Not needed for copy_trans variants
}

/** Patching operations */
export interface TDPatch {
    type: TDConstructType.Patch;
    operation: TDPatchOperation;
}

// =============================================================================
// State types
// =============================================================================

/** A dialog state (IF ... END block) */
export interface TDState {
    label: string;
    trigger?: string; // State entry trigger
    weight?: number;
    say: TDSay[];
    transitions: TDTransition[];
}

/** SAY statement, can have multiple texts (multisay) */
export interface TDSay {
    text: TDText;
}

/** Text content - can be tra ref, tlk ref, or literal */
export interface TDText {
    type: TDTextType;
    value: number | string;
    sound?: string;
    // For male/female variants
    male?: TDText;
    female?: TDText;
}

// =============================================================================
// Transition types
// =============================================================================

/** A transition within a state */
export interface TDTransition {
    trigger?: string; // Empty = no trigger (++)
    reply?: TDText;
    action?: string;
    next: TDTransitionNext;
    journal?: TDText;
    solvedJournal?: TDText;
    unsolvedJournal?: TDText;
    flags?: number;
}

/** Where a transition goes */
export type TDTransitionNext =
    | { type: TDTransitionType.Goto; target: string }
    | { type: TDTransitionType.Exit }
    | { type: TDTransitionType.Extern; filename: string; target: string; ifFileExists?: boolean }
    | { type: TDTransitionType.CopyTrans; filename: string; target: string; safe?: boolean; late?: boolean };

// =============================================================================
// Chain types
// =============================================================================

/** Entry in a CHAIN - speaker + text */
export interface TDChainEntry {
    speaker?: string; // undefined = same speaker continues
    trigger?: string; // IF condition for this entry
    ifFileExists?: boolean;
    texts: TDText[];
    action?: string;
}

/** How a CHAIN ends */
export type TDChainEpilogue =
    | { type: TDEpilogueType.Exit }
    | { type: TDEpilogueType.End; filename: string; target: string }
    | { type: TDEpilogueType.CopyTrans; filename: string; target: string; safe?: boolean; late?: boolean }
    | { type: TDEpilogueType.Transitions; transitions: TDTransition[] };

// =============================================================================
// Patch operation types
// =============================================================================

export type TDPatchOperation =
    | TDAlterTrans
    | TDAddStateTrigger
    | TDAddTransTrigger
    | TDAddTransAction
    | TDReplaceTrans
    | TDReplaceText
    | TDSetWeight
    | TDReplaceSay
    | TDReplaceStateTrigger
    | TDReplaceStates;

export interface TDAlterTrans {
    op: TDPatchOp.AlterTrans;
    filename: string;
    states: (string | number)[];
    transitions: number[];
    changes: {
        trigger?: string | false;
        action?: string;
        reply?: TDText;
        // ... other fields
    };
}

export interface TDAddStateTrigger {
    op: TDPatchOp.AddStateTrigger;
    filename: string;
    states: (string | number)[];
    trigger: string;
    unless?: string;
}

export interface TDAddTransTrigger {
    op: TDPatchOp.AddTransTrigger;
    filename: string;
    states: (string | number)[];
    transitions?: number[];
    trigger: string;
    unless?: string;
}

export interface TDAddTransAction {
    op: TDPatchOp.AddTransAction;
    filename: string;
    states: (string | number)[];
    transitions: number[];
    action: string;
    unless?: string;
}

export interface TDReplaceTrans {
    op: TDPatchOp.ReplaceTransTrigger | TDPatchOp.ReplaceTransAction;
    filename: string;
    states: (string | number)[];
    transitions: number[];
    oldText: string;
    newText: string;
    unless?: string;
}

export interface TDReplaceText {
    op: TDPatchOp.ReplaceTriggerText | TDPatchOp.ReplaceActionText;
    filenames: string[];
    oldText: string;
    newText: string;
    unless?: string;
}

export interface TDSetWeight {
    op: TDPatchOp.SetWeight;
    filename: string;
    state: string;
    weight: number;
}

export interface TDReplaceSay {
    op: TDPatchOp.ReplaceSay;
    filename: string;
    state: string;
    text: TDText;
}

export interface TDReplaceStateTrigger {
    op: TDPatchOp.ReplaceStateTrigger;
    filename: string;
    states: (string | number)[];
    trigger: string;
    unless?: string;
}

export interface TDReplaceStates {
    op: TDPatchOp.ReplaceStates;
    filename: string;
    replacements: Map<number, TDState>;
}
