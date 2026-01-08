/**
 * TD Intermediate Representation Types
 *
 * These types represent the parsed structure of a TD file before
 * emission to D format. The IR is language-agnostic and captures
 * all D constructs.
 */

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
    type: "begin";
    filename: string;
    nonPausing?: boolean;
    states: TDState[];
}

/** APPEND - add states to existing dialog */
export interface TDAppend {
    type: "append";
    filename: string;
    ifFileExists?: boolean;
    states: TDState[];
}

/** EXTEND_TOP / EXTEND_BOTTOM - add transitions to existing state */
export interface TDExtend {
    type: "extend_top" | "extend_bottom";
    filename: string;
    stateLabel: string;
    position?: number;
    transitions: TDTransition[];
}

/** CHAIN - multi-speaker conversation */
export interface TDChain {
    type: "chain";
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
    type: "interject" | "interject_copy_trans" | "interject_copy_trans2";
    filename: string;
    stateLabel: string;
    globalVariable: string;
    safe?: boolean;
    entries: TDChainEntry[];
    epilogue?: TDChainEpilogue; // Not needed for copy_trans variants
}

/** Patching operations */
export interface TDPatch {
    type: "patch";
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
    type: "tra" | "tlk" | "literal" | "forced";
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
    | { type: "goto"; target: string }
    | { type: "exit" }
    | { type: "extern"; filename: string; target: string; ifFileExists?: boolean }
    | { type: "copy_trans"; filename: string; target: string; safe?: boolean; late?: boolean };

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
    | { type: "exit" }
    | { type: "end"; filename: string; target: string }
    | { type: "copy_trans"; filename: string; target: string; safe?: boolean; late?: boolean }
    | { type: "transitions"; transitions: TDTransition[] };

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
    | TDReplaceStateTrigger;

export interface TDAlterTrans {
    op: "alter_trans";
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
    op: "add_state_trigger";
    filename: string;
    states: (string | number)[];
    trigger: string;
    unless?: string;
}

export interface TDAddTransTrigger {
    op: "add_trans_trigger";
    filename: string;
    states: (string | number)[];
    transitions?: number[];
    trigger: string;
    unless?: string;
}

export interface TDAddTransAction {
    op: "add_trans_action";
    filename: string;
    states: (string | number)[];
    transitions: number[];
    action: string;
    unless?: string;
}

export interface TDReplaceTrans {
    op: "replace_trans_trigger" | "replace_trans_action";
    filename: string;
    states: (string | number)[];
    transitions: number[];
    oldText: string;
    newText: string;
    unless?: string;
}

export interface TDReplaceText {
    op: "replace_trigger_text" | "replace_action_text";
    filenames: string[];
    oldText: string;
    newText: string;
    unless?: string;
}

export interface TDSetWeight {
    op: "set_weight";
    filename: string;
    state: string;
    weight: number;
}

export interface TDReplaceSay {
    op: "replace_say";
    filename: string;
    state: string;
    text: TDText;
}

export interface TDReplaceStateTrigger {
    op: "replace_state_trigger";
    filename: string;
    states: (string | number)[];
    trigger: string;
    unless?: string;
}
