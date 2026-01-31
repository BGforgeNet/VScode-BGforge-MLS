/**
 * TD patch operations - transforms TypeScript calls into WeiDU D
 * patch operations (ALTER_TRANS, ADD_STATE_TRIGGER, etc.)
 *
 * Extracted from TDParser as standalone functions that receive
 * parser context (vars) as a parameter.
 */

import {
    CallExpression,
    Expression,
    FunctionDeclaration,
    Node,
    SyntaxKind,
} from "ts-morph";
import {
    TDConstructType,
    TDPatchOp,
    type TDConstruct,
    type TDState,
    type TDAlterTrans,
    type TDAddStateTrigger,
    type TDAddTransTrigger,
    type TDAddTransAction,
    type TDReplaceTrans,
    type TDReplaceText,
    type TDSetWeight,
    type TDReplaceSay,
    type TDReplaceStateTrigger,
    type TDReplaceStates,
} from "./types";
import * as utils from "../transpiler-utils";
import type { VarsContext } from "../transpiler-utils";
import {
    resolveStringExpr,
    parseStateList,
    parseNumberArray,
    parseUnless,
} from "./parse-helpers";
import {
    expressionToTrigger,
    expressionToAction,
    expressionToText,
} from "./expression-eval";
import { transformFunctionToState } from "./state-transitions";
import type { FuncsContext } from "./state-transitions";

/**
 * Transform alterTrans(filename, states, transitions, changes).
 */
function transformAlterTrans(call: CallExpression, vars: VarsContext): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 4) {
        throw new Error(`alterTrans() requires 4 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const states = parseStateList(args[1] as Expression, vars);
    const transitions = parseNumberArray(args[2] as Expression);
    const changesObj = args[3];

    if (!Node.isObjectLiteralExpression(changesObj)) {
        throw new Error(`alterTrans() fourth argument must be an object at ${call.getStartLineNumber()}`);
    }

    const changes: TDAlterTrans["changes"] = {};

    for (const prop of changesObj.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
            const propName = prop.getName();
            const value = prop.getInitializer();

            if (!value) continue;

            if (propName === "trigger") {
                if (value.getText() === "false") {
                    changes.trigger = false;
                } else {
                    changes.trigger = expressionToTrigger(value, vars);
                }
            } else if (propName === "action") {
                changes.action = expressionToAction(value, vars);
            } else if (propName === "reply") {
                changes.reply = expressionToText(value, vars);
            }
        }
    }

    const operation: TDAlterTrans = {
        op: TDPatchOp.AlterTrans,
        filename,
        states,
        transitions,
        changes,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform addStateTrigger(filename, states, trigger, options?).
 */
function transformAddStateTrigger(call: CallExpression, vars: VarsContext): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 3) {
        throw new Error(`addStateTrigger() requires at least 3 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const states = parseStateList(args[1] as Expression, vars);
    const trigger = expressionToTrigger(args[2] as Expression, vars);
    const unless = args[3] ? parseUnless(args[3] as Expression) : undefined;

    const operation: TDAddStateTrigger = {
        op: TDPatchOp.AddStateTrigger,
        filename,
        states,
        trigger,
        unless,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform addTransTrigger(filename, states, trigger, options?).
 */
function transformAddTransTrigger(call: CallExpression, vars: VarsContext): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 3) {
        throw new Error(`addTransTrigger() requires at least 3 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const states = parseStateList(args[1] as Expression, vars);
    const trigger = expressionToTrigger(args[2] as Expression, vars);

    let transitions: number[] | undefined;
    let unless: string | undefined;

    // args[3] can be options object with trans and/or unless
    if (args[3]) {
        const opts = args[3];
        if (Node.isObjectLiteralExpression(opts)) {
            for (const prop of opts.getProperties()) {
                if (Node.isPropertyAssignment(prop)) {
                    const propName = prop.getName();
                    const value = prop.getInitializer();
                    if (!value) continue;

                    if (propName === "trans") {
                        transitions = parseNumberArray(value);
                    } else if (propName === "unless") {
                        unless = parseUnless(value);
                    }
                }
            }
        }
    }

    const operation: TDAddTransTrigger = {
        op: TDPatchOp.AddTransTrigger,
        filename,
        states,
        transitions,
        trigger,
        unless,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform addTransAction(filename, states, transitions, action, options?).
 */
function transformAddTransAction(call: CallExpression, vars: VarsContext): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 4) {
        throw new Error(`addTransAction() requires at least 4 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const states = parseStateList(args[1] as Expression, vars);
    const transitions = parseNumberArray(args[2] as Expression);
    const action = expressionToAction(args[3] as Expression, vars);
    const unless = args[4] ? parseUnless(args[4] as Expression) : undefined;

    const operation: TDAddTransAction = {
        op: TDPatchOp.AddTransAction,
        filename,
        states,
        transitions,
        action,
        unless,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform replaceTransTrigger/replaceTransAction.
 */
function transformReplaceTrans(
    call: CallExpression,
    op: TDPatchOp.ReplaceTransTrigger | TDPatchOp.ReplaceTransAction,
    vars: VarsContext
): TDConstruct[] | null {
    const args = call.getArguments();
    const funcName = op === TDPatchOp.ReplaceTransTrigger ? "replaceTransTrigger" : "replaceTransAction";

    if (args.length < 5) {
        throw new Error(`${funcName}() requires at least 5 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const states = parseStateList(args[1] as Expression, vars);
    const transitions = parseNumberArray(args[2] as Expression);
    const oldText = utils.stripQuotes(args[3]!.getText());
    const newText = utils.stripQuotes(args[4]!.getText());
    const unless = args[5] ? parseUnless(args[5] as Expression) : undefined;

    const operation: TDReplaceTrans = {
        op,
        filename,
        states,
        transitions,
        oldText,
        newText,
        unless,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform replaceTriggerText/replaceActionText.
 */
function transformReplaceText(
    call: CallExpression,
    op: TDPatchOp.ReplaceTriggerText | TDPatchOp.ReplaceActionText,
    vars: VarsContext
): TDConstruct[] | null {
    const args = call.getArguments();
    const funcName = op === TDPatchOp.ReplaceTriggerText ? "replaceTriggerText" : "replaceActionText";

    if (args.length < 3) {
        throw new Error(`${funcName}() requires at least 3 arguments at ${call.getStartLineNumber()}`);
    }

    const filenamesArg = args[0];
    let filenames: string[];

    // Can be a single string or array of strings
    if (Node.isStringLiteral(filenamesArg) || filenamesArg?.getKind() === SyntaxKind.StringLiteral) {
        filenames = [resolveStringExpr(filenamesArg as Expression, vars)];
    } else if (Node.isArrayLiteralExpression(filenamesArg)) {
        filenames = filenamesArg.getElements().map((e) => resolveStringExpr(e as Expression, vars));
    } else {
        throw new Error(`${funcName}() first argument must be a string or array of strings at ${call.getStartLineNumber()}`);
    }

    const oldText = utils.stripQuotes(args[1]!.getText());
    const newText = utils.stripQuotes(args[2]!.getText());
    const unless = args[3] ? parseUnless(args[3] as Expression) : undefined;

    const operation: TDReplaceText = {
        op,
        filenames,
        oldText,
        newText,
        unless,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform setWeight(filename, state, weight).
 */
function transformSetWeight(call: CallExpression, vars: VarsContext): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 3) {
        throw new Error(`setWeight() requires 3 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const state = resolveStringExpr(args[1] as Expression, vars);
    const weight = Number(args[2]!.getText());

    const operation: TDSetWeight = {
        op: TDPatchOp.SetWeight,
        filename,
        state,
        weight,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform replaceSay(filename, state, text).
 */
function transformReplaceSay(call: CallExpression, vars: VarsContext): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 3) {
        throw new Error(`replaceSay() requires 3 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const state = resolveStringExpr(args[1] as Expression, vars);
    const text = expressionToText(args[2] as Expression, vars);

    const operation: TDReplaceSay = {
        op: TDPatchOp.ReplaceSay,
        filename,
        state,
        text,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform replaceStateTrigger(filename, states, trigger, options?).
 */
function transformReplaceStateTrigger(call: CallExpression, vars: VarsContext): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 3) {
        throw new Error(`replaceStateTrigger() requires at least 3 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const states = parseStateList(args[1] as Expression, vars);
    const trigger = expressionToTrigger(args[2] as Expression, vars);
    const unless = args[3] ? parseUnless(args[3] as Expression) : undefined;

    const operation: TDReplaceStateTrigger = {
        op: TDPatchOp.ReplaceStateTrigger,
        filename,
        states,
        trigger,
        unless,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

/**
 * Transform replace(filename, { stateNum: function, ... }).
 * Replaces entire states by their numeric index.
 */
function transformReplace(
    call: CallExpression,
    vars: VarsContext,
    funcs: FuncsContext
): TDConstruct[] | null {
    const args = call.getArguments();
    if (args.length < 2) {
        throw new Error(`replace() requires 2 arguments at ${call.getStartLineNumber()}`);
    }

    const filename = resolveStringExpr(args[0] as Expression, vars);
    const statesObj = args[1];

    if (!Node.isObjectLiteralExpression(statesObj)) {
        throw new Error(`replace() second argument must be an object literal at ${call.getStartLineNumber()}`);
    }

    const replacements = new Map<number, TDState>();

    for (const prop of statesObj.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
            const stateNum = Number(prop.getName());
            const funcExpr = prop.getInitializer();

            if (!funcExpr || !Node.isFunctionExpression(funcExpr)) {
                throw new Error(`replace() state ${stateNum} must be a function at ${call.getStartLineNumber()}`);
            }

            // FunctionExpression has similar structure to FunctionDeclaration for our parsing needs
            // We need to cast to access methods like getName(), getBody() which exist on both
            const funcDecl = funcExpr as unknown as FunctionDeclaration;
            const state = transformFunctionToState(funcDecl, vars, funcs);

            if (!state) {
                throw new Error(`replace() failed to parse state ${stateNum} at ${call.getStartLineNumber()}`);
            }

            // Override label with the numeric state
            state.label = stateNum.toString();
            replacements.set(stateNum, state);
        }
    }

    const operation: TDReplaceStates = {
        op: TDPatchOp.ReplaceStates,
        filename,
        replacements,
    };

    return [{ type: TDConstructType.Patch, operation }];
}

export {
    transformAlterTrans,
    transformAddStateTrigger,
    transformAddTransTrigger,
    transformAddTransAction,
    transformReplaceTrans,
    transformReplaceText,
    transformSetWeight,
    transformReplaceSay,
    transformReplaceStateTrigger,
    transformReplace,
};
