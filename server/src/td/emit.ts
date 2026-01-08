/**
 * TD Emitter - converts IR to WeiDU D code
 *
 * Takes a TDScript IR and produces formatted D text output.
 */

import * as path from "path";
import {
    TDScript,
    TDConstruct,
    TDBegin,
    TDAppend,
    TDExtend,
    TDChain,
    TDState,
    TDText,
    TDTransition,
    TDTransitionNext,
    TDChainEpilogue,
    TDInterject,
} from "./types";

const INDENT = "    ";

/**
 * Emit a complete TD script as D code.
 */
export function emitD(script: TDScript): string {
    const filename = path.basename(script.sourceFile);
    const header = `/* Generated from ${filename} - do not edit */\n\n`;
    const body = script.constructs.map(emitConstruct).join("\n\n");
    return header + body;
}

/**
 * Emit a top-level construct.
 */
function emitConstruct(construct: TDConstruct): string {
    switch (construct.type) {
        case "begin":
            return emitBegin(construct);
        case "append":
            return emitAppend(construct);
        case "extend_top":
        case "extend_bottom":
            return emitExtend(construct);
        case "chain":
            return emitChain(construct);
        case "interject":
        case "interject_copy_trans":
        case "interject_copy_trans2":
            return emitInterject(construct);
        case "patch":
            return emitPatch(construct);
    }
}

// =============================================================================
// BEGIN / APPEND
// =============================================================================

function emitBegin(begin: TDBegin): string {
    const nonPausing = begin.nonPausing ? " 1" : "";
    const header = `BEGIN ${begin.filename}${nonPausing}\n`;
    const states = begin.states.map(emitState).join("\n\n");
    return header + "\n" + states;
}

function emitAppend(append: TDAppend): string {
    const ifExists = append.ifFileExists ? "IF_FILE_EXISTS " : "";
    const header = `APPEND ${ifExists}${append.filename}\n`;
    const states = append.states.map(emitState).join("\n\n");
    return header + states + "\nEND";
}

// =============================================================================
// State
// =============================================================================

function emitState(state: TDState): string {
    const lines: string[] = [];

    // State header: IF ~trigger~ label or IF ~~ label
    const trigger = state.trigger ?? "";
    const weight = state.weight !== undefined ? `WEIGHT #${state.weight} ` : "";
    lines.push(`IF ${weight}~${trigger}~ ${state.label}`);

    // SAY - with multisay support
    if (state.say.length > 0) {
        const sayTexts = state.say.map((s) => emitText(s.text));
        lines.push(`    SAY ${sayTexts.join(" = ")}`);
    }

    // Transitions
    for (const trans of state.transitions) {
        lines.push(emitTransition(trans));
    }

    lines.push("END");
    return lines.join("\n");
}

// =============================================================================
// Transition
// =============================================================================

function emitTransition(trans: TDTransition): string {
    const hasTrigger = trans.trigger !== undefined && trans.trigger !== "";
    const hasReply = trans.reply !== undefined;

    // Without reply, use full format: IF ~trigger~ THEN GOTO target
    // With reply, use shorthand: +~trigger~+ @text + target
    if (!hasReply) {
        return emitTransitionLongform(trans, hasTrigger);
    }

    let result = INDENT;

    // Trigger part: +~trigger~+ or ++
    if (hasTrigger) {
        result += `+~${trans.trigger}~+`;
    } else {
        result += "++";
    }

    // Reply text
    result += " " + emitText(trans.reply);

    // DO action
    if (trans.action) {
        result += ` DO ~${trans.action}~`;
    }

    // Journal entries
    if (trans.journal) {
        result += ` JOURNAL ${emitText(trans.journal)}`;
    }
    if (trans.solvedJournal) {
        result += ` SOLVED_JOURNAL ${emitText(trans.solvedJournal)}`;
    }
    if (trans.unsolvedJournal) {
        result += ` UNSOLVED_JOURNAL ${emitText(trans.unsolvedJournal)}`;
    }

    // Flags
    if (trans.flags !== undefined) {
        result += ` FLAGS ${trans.flags}`;
    }

    // Next: + target for shorthand
    result += " " + emitTransitionNextShorthand(trans.next);

    return result;
}

/**
 * Emit transition in long form: IF ~trigger~ THEN [DO ~action~] GOTO target
 * Used when there's no reply text.
 */
function emitTransitionLongform(trans: TDTransition, hasTrigger: boolean): string {
    let result = INDENT + "IF ~";
    result += hasTrigger ? trans.trigger : "";
    result += "~ THEN";

    if (trans.action) {
        result += ` DO ~${trans.action}~`;
    }

    result += " " + emitTransitionNext(trans.next);
    return result;
}

function emitTransitionNextShorthand(next: TDTransitionNext): string {
    switch (next.type) {
        case "goto":
            return `+ ${next.target}`;
        case "exit":
            return "EXIT";
        case "extern": {
            const ifExists = next.ifFileExists ? "IF_FILE_EXISTS " : "";
            return `EXTERN ${ifExists}${next.filename} ${next.target}`;
        }
        case "copy_trans": {
            const safe = next.safe ? "SAFE " : "";
            const keyword = next.late ? "COPY_TRANS_LATE" : "COPY_TRANS";
            return `${keyword} ${safe}${next.filename} ${next.target}`;
        }
    }
}

function emitTransitionNext(next: TDTransitionNext): string {
    switch (next.type) {
        case "goto":
            return `GOTO ${next.target}`;
        case "exit":
            return "EXIT";
        case "extern": {
            const ifExists = next.ifFileExists ? "IF_FILE_EXISTS " : "";
            return `EXTERN ${ifExists}${next.filename} ${next.target}`;
        }
        case "copy_trans": {
            const safe = next.safe ? "SAFE " : "";
            const keyword = next.late ? "COPY_TRANS_LATE" : "COPY_TRANS";
            return `${keyword} ${safe}${next.filename} ${next.target}`;
        }
    }
}

// =============================================================================
// Text
// =============================================================================

function emitText(text: TDText): string {
    // Handle male/female variants
    if (text.male && text.female) {
        return `${emitText(text.male)} ${emitText(text.female)}`;
    }

    let result: string;
    switch (text.type) {
        case "tra":
            result = `@${text.value}`;
            break;
        case "tlk":
            result = `#${text.value}`;
            break;
        case "literal":
            result = `~${text.value}~`;
            break;
        case "forced":
            result = `!${text.value}`;
            break;
    }

    // Add sound if present
    if (text.sound) {
        result += ` [${text.sound}]`;
    }

    return result;
}

// =============================================================================
// EXTEND
// =============================================================================

function emitExtend(extend: TDExtend): string {
    const keyword = extend.type === "extend_top" ? "EXTEND_TOP" : "EXTEND_BOTTOM";
    const position = extend.position !== undefined ? ` #${extend.position}` : "";

    const lines: string[] = [];
    lines.push(`${keyword} ${extend.filename} ${extend.stateLabel}${position}`);

    for (const trans of extend.transitions) {
        lines.push(emitTransition(trans));
    }

    lines.push("END");
    return lines.join("\n");
}

// =============================================================================
// CHAIN
// =============================================================================

function emitChain(chain: TDChain): string {
    const lines: string[] = [];

    // CHAIN header
    lines.push("CHAIN");

    // IF trigger THEN filename label
    if (chain.trigger) {
        const weight = chain.weight !== undefined ? `WEIGHT #${chain.weight} ` : "";
        lines.push(`IF ${weight}~${chain.trigger}~ THEN ${chain.filename} ${chain.label}`);
    } else {
        lines.push(`${chain.filename} ${chain.label}`);
    }

    // First entry text (initial speaker)
    let currentSpeaker = chain.filename;
    let firstEntry = true;

    for (const entry of chain.entries) {
        if (entry.speaker && entry.speaker !== currentSpeaker) {
            // Speaker switch
            const ifCond = entry.trigger ? ` IF ~${entry.trigger}~` : "";
            const ifExists = entry.ifFileExists ? "IF_FILE_EXISTS " : "";
            lines.push(`== ${ifExists}${entry.speaker}${ifCond}`);
            currentSpeaker = entry.speaker;
        } else if (!firstEntry && entry.trigger) {
            // Same speaker with condition
            lines.push(`= IF ~${entry.trigger}~`);
        }

        // Emit texts (multisay within entry)
        for (let i = 0; i < entry.texts.length; i++) {
            const text = entry.texts[i];
            if (!text) continue;
            if (i === 0 && firstEntry) {
                // First text of chain - no prefix
                lines.push(emitText(text));
            } else if (i === 0) {
                // First text after speaker switch - no = prefix (already on == line)
                lines.push(emitText(text));
            } else {
                // Continuation - use = for multisay
                lines.push(`= ${emitText(text)}`);
            }
        }

        // Action after entry
        if (entry.action) {
            lines.push(`DO ~${entry.action}~`);
        }

        firstEntry = false;
    }

    // Epilogue
    lines.push(emitChainEpilogue(chain.epilogue));

    return lines.join("\n");
}

function emitChainEpilogue(epilogue: TDChainEpilogue): string {
    switch (epilogue.type) {
        case "exit":
            return "EXIT";
        case "end":
            return `END ${epilogue.filename} ${epilogue.target}`;
        case "copy_trans": {
            const safe = epilogue.safe ? "SAFE " : "";
            const keyword = epilogue.late ? "COPY_TRANS_LATE" : "COPY_TRANS";
            return `${keyword} ${safe}${epilogue.filename} ${epilogue.target}`;
        }
        case "transitions":
            return (
                "END\n" + epilogue.transitions.map(emitTransition).join("\n")
            );
    }
}

// =============================================================================
// INTERJECT
// =============================================================================

function emitInterject(interject: TDChain | TDInterject): string {
    // Type narrowing
    if (interject.type === "chain") {
        return emitChain(interject);
    }

    const lines: string[] = [];
    const safe = interject.safe ? "SAFE " : "";

    let keyword: string;
    switch (interject.type) {
        case "interject":
            keyword = "INTERJECT";
            break;
        case "interject_copy_trans":
            keyword = `INTERJECT_COPY_TRANS ${safe}`;
            break;
        case "interject_copy_trans2":
            keyword = `INTERJECT_COPY_TRANS2 ${safe}`;
            break;
    }

    lines.push(`${keyword}${interject.filename} ${interject.stateLabel} ${interject.globalVariable}`);

    for (const entry of interject.entries) {
        for (const text of entry.texts) {
            lines.push(emitText(text));
        }
    }

    if (interject.epilogue) {
        lines.push(emitChainEpilogue(interject.epilogue));
    }

    return lines.join("\n");
}

// =============================================================================
// Patch operations
// =============================================================================

function emitPatch(patch: { type: "patch"; operation: import("./types").TDPatchOperation }): string {
    const op = patch.operation;

    switch (op.op) {
        case "alter_trans":
            return emitAlterTrans(op);
        case "add_state_trigger":
            return `ADD_STATE_TRIGGER ${op.filename} ${formatStateList(op.states)} ~${op.trigger}~${formatUnless(op.unless)}`;
        case "add_trans_trigger": {
            const trans = op.transitions ? ` DO ${op.transitions.join(" ")}` : "";
            return `ADD_TRANS_TRIGGER ${op.filename} ${formatStateList(op.states)} ~${op.trigger}~${trans}${formatUnless(op.unless)}`;
        }
        case "add_trans_action":
            return `ADD_TRANS_ACTION ${op.filename} BEGIN ${formatStateList(op.states)} END BEGIN ${op.transitions.join(" ")} END ~${op.action}~${formatUnless(op.unless)}`;
        case "replace_trans_trigger":
        case "replace_trans_action": {
            const keyword = op.op === "replace_trans_trigger" ? "REPLACE_TRANS_TRIGGER" : "REPLACE_TRANS_ACTION";
            return `${keyword} ${op.filename} BEGIN ${formatStateList(op.states)} END BEGIN ${op.transitions.join(" ")} END ~${op.oldText}~ ~${op.newText}~${formatUnless(op.unless)}`;
        }
        case "replace_trigger_text":
        case "replace_action_text": {
            const keyword = op.op === "replace_trigger_text" ? "REPLACE_TRIGGER_TEXT" : "REPLACE_ACTION_TEXT";
            return `${keyword} ${op.filenames.join(" ")} ~${op.oldText}~ ~${op.newText}~${formatUnless(op.unless)}`;
        }
        case "set_weight":
            return `SET_WEIGHT ${op.filename} ${op.state} #${op.weight}`;
        case "replace_say":
            return `REPLACE_SAY ${op.filename} ${op.state} ${emitText(op.text)}`;
        case "replace_state_trigger":
            return `REPLACE_STATE_TRIGGER ${op.filename} ${formatStateList(op.states)} ~${op.trigger}~${formatUnless(op.unless)}`;
    }
}

function emitAlterTrans(op: import("./types").TDAlterTrans): string {
    const lines: string[] = [];
    lines.push(`ALTER_TRANS ${op.filename}`);
    lines.push(`BEGIN ${formatStateList(op.states)} END`);
    lines.push(`BEGIN ${op.transitions.join(" ")} END`);
    lines.push("BEGIN");

    if (op.changes.trigger !== undefined) {
        const triggerValue = op.changes.trigger === false ? "" : op.changes.trigger;
        lines.push(`  "TRIGGER" ~${triggerValue}~`);
    }
    if (op.changes.action !== undefined) {
        lines.push(`  "ACTION" ~${op.changes.action}~`);
    }
    if (op.changes.reply !== undefined) {
        lines.push(`  "REPLY" ${emitText(op.changes.reply)}`);
    }

    lines.push("END");
    return lines.join("\n");
}

function formatStateList(states: (string | number)[]): string {
    return states.map((s) => (typeof s === "number" ? s.toString() : s)).join(" ");
}

function formatUnless(unless?: string): string {
    return unless ? ` UNLESS ~${unless}~` : "";
}
