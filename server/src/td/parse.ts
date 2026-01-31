/**
 * TD Parser - converts TypeScript AST to TD IR
 *
 * Walks the TypeScript AST (via ts-morph) and produces TDScript IR
 * for emission to WeiDU D format.
 *
 * Implementation is split across modules:
 * - parse-helpers.ts: utility functions (evaluate, resolve, validate, parse)
 * - expression-eval.ts: expression to trigger/action/text conversion
 * - state-transitions.ts: state/chain/transition processing, loop unrolling
 * - patch-operations.ts: patch operation transforms (ALTER_TRANS, etc.)
 */

import {
    ArrayLiteralExpression,
    Block,
    CallExpression,
    Expression,
    FunctionDeclaration,
    FunctionExpression,
    Node,
    SourceFile,
    Statement,
    SyntaxKind,
} from "ts-morph";
import {
    TDConstructType,
    TDPatchOp,
    TDEpilogueType,
    type TDScript,
    type TDConstruct,
    type TDState,
    type TDTransition,
    type TDChainEntry,
    type TDChainEpilogue,
    type TDBegin,
    type TDAppend,
    type TDExtend,
    type TDInterject,
} from "./types";
import type { VarsContext } from "../transpiler-utils";
import { evaluateExpression, resolveStringExpr } from "./parse-helpers";
import { expressionToTrigger } from "./expression-eval";
import {
    transformFunctionToState,
    transformFunctionToChain,
    processChainStatements,
    processExtendStatements,
    type FuncsContext,
} from "./state-transitions";
import {
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
} from "./patch-operations";

/** TD function/keyword constants */
const TD_KEYWORDS = {
    BEGIN: "begin",
    CHAIN: "chain",
    APPEND: "append",
    EXTEND_TOP: "extendTop",
    EXTEND_BOTTOM: "extendBottom",
    INTERJECT: "interject",
    INTERJECT_COPY_TRANS: "interjectCopyTrans",
    INTERJECT_COPY_TRANS2: "interjectCopyTrans2",
    ALTER_TRANS: "alterTrans",
    REPLACE: "replace",
    ADD_STATE_TRIGGER: "addStateTrigger",
    ADD_TRANS_TRIGGER: "addTransTrigger",
    ADD_TRANS_ACTION: "addTransAction",
    REPLACE_TRANS_TRIGGER: "replaceTransTrigger",
    REPLACE_TRANS_ACTION: "replaceTransAction",
    REPLACE_TRIGGER_TEXT: "replaceTriggerText",
    REPLACE_ACTION_TEXT: "replaceActionText",
    SET_WEIGHT: "setWeight",
    REPLACE_SAY: "replaceSay",
    REPLACE_STATE_TRIGGER: "replaceStateTrigger",
} as const;

export class TDParser {
    private vars: VarsContext = new Map();
    private funcs: FuncsContext = new Map();
    private sourceFile!: SourceFile;

    /**
     * Parse a bundled TypeScript source file to TD IR.
     */
    parse(sourceFile: SourceFile): TDScript {
        this.sourceFile = sourceFile;
        this.vars.clear();
        this.funcs.clear();

        // Pass 1: Collect declarations
        this.collectDeclarations();

        // Pass 2: Transform top-level statements to constructs
        const constructs: TDConstruct[] = [];

        for (const stmt of sourceFile.getStatements()) {
            const construct = this.transformTopLevel(stmt);
            if (construct) {
                constructs.push(...construct);
            }
        }

        return {
            sourceFile: sourceFile.getFilePath(),
            constructs,
        };
    }

    /**
     * Collect variable and function declarations for compile-time evaluation.
     */
    private collectDeclarations() {
        // Collect all variable declarations
        for (const varDecl of this.sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
            const name = varDecl.getName();
            const init = varDecl.getInitializer();
            if (init) {
                const value = evaluateExpression(init, this.vars);
                if (value !== undefined) {
                    this.vars.set(name, value);
                }
            }
        }

        // Collect function declarations (including those inside if statements)
        for (const func of this.sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
            const name = func.getName();
            if (name) {
                // Check if function is inside an if statement (entry trigger)
                const trigger = this.getFunctionEntryTrigger(func);
                this.funcs.set(name, { func, trigger });
            }
        }
    }

    /**
     * Check if a function is inside an if statement and return its trigger.
     * Pattern: if (trigger()) { function name() { ... } }
     */
    private getFunctionEntryTrigger(func: FunctionDeclaration): string | undefined {
        const parent = func.getParent();

        // Check if parent is a Block inside an IfStatement
        if (Node.isBlock(parent)) {
            const blockParent = parent.getParent();
            if (Node.isIfStatement(blockParent)) {
                // This function is the "then" branch of an if
                return expressionToTrigger(blockParent.getExpression(), this.vars);
            }
        }

        return undefined;
    }

    /**
     * Transform a top-level statement to TD constructs.
     */
    private transformTopLevel(stmt: Statement): TDConstruct[] | null {
        // Skip variable and function declarations
        if (stmt.isKind(SyntaxKind.VariableStatement) || stmt.isKind(SyntaxKind.FunctionDeclaration)) {
            return null;
        }

        // Skip if-wrapped functions - they're processed when referenced in dialog()/append()
        // The if-wrapper just provides the entry trigger, which is captured during collection
        if (stmt.isKind(SyntaxKind.IfStatement)) {
            return null;
        }

        // Handle expression statement (top-level calls like dialog(), append(), etc.)
        if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                return this.transformTopLevelCall(expr);
            }
        }

        // Handle export default (for dialog())
        if (stmt.isKind(SyntaxKind.ExportAssignment)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                return this.transformTopLevelCall(expr);
            }
        }

        return null;
    }

    /**
     * Transform a top-level call expression.
     */
    private transformTopLevelCall(call: CallExpression): TDConstruct[] | null {
        const funcName = call.getExpression().getText();

        switch (funcName) {
            case TD_KEYWORDS.BEGIN:
                return this.transformBegin(call);
            case TD_KEYWORDS.CHAIN:
                return this.transformChainCall(call);
            case TD_KEYWORDS.APPEND:
                return this.transformAppend(call);
            case TD_KEYWORDS.EXTEND_TOP:
            case TD_KEYWORDS.EXTEND_BOTTOM:
                return this.transformExtend(call, funcName === TD_KEYWORDS.EXTEND_TOP);
            case TD_KEYWORDS.INTERJECT:
                return this.transformInterject(call, TDConstructType.Interject);
            case TD_KEYWORDS.INTERJECT_COPY_TRANS:
                return this.transformInterject(call, TDConstructType.InterjectCopyTrans);
            case TD_KEYWORDS.INTERJECT_COPY_TRANS2:
                return this.transformInterject(call, TDConstructType.InterjectCopyTrans2);
            case TD_KEYWORDS.REPLACE:
                return transformReplace(call, this.vars, this.funcs);
            case TD_KEYWORDS.ALTER_TRANS:
                return transformAlterTrans(call, this.vars);
            case TD_KEYWORDS.ADD_STATE_TRIGGER:
                return transformAddStateTrigger(call, this.vars);
            case TD_KEYWORDS.ADD_TRANS_TRIGGER:
                return transformAddTransTrigger(call, this.vars);
            case TD_KEYWORDS.ADD_TRANS_ACTION:
                return transformAddTransAction(call, this.vars);
            case TD_KEYWORDS.REPLACE_TRANS_TRIGGER:
                return transformReplaceTrans(call, TDPatchOp.ReplaceTransTrigger, this.vars);
            case TD_KEYWORDS.REPLACE_TRANS_ACTION:
                return transformReplaceTrans(call, TDPatchOp.ReplaceTransAction, this.vars);
            case TD_KEYWORDS.REPLACE_TRIGGER_TEXT:
                return transformReplaceText(call, TDPatchOp.ReplaceTriggerText, this.vars);
            case TD_KEYWORDS.REPLACE_ACTION_TEXT:
                return transformReplaceText(call, TDPatchOp.ReplaceActionText, this.vars);
            case TD_KEYWORDS.SET_WEIGHT:
                return transformSetWeight(call, this.vars);
            case TD_KEYWORDS.REPLACE_SAY:
                return transformReplaceSay(call, this.vars);
            case TD_KEYWORDS.REPLACE_STATE_TRIGGER:
                return transformReplaceStateTrigger(call, this.vars);
            default:
                return null;
        }
    }

    /**
     * Transform chain(function) or chain(trigger, function) to CHAIN construct.
     * Accepts either function reference or inline named function expression.
     */
    private transformChainCall(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 1 || args.length > 2) {
            throw new Error(`chain() requires 1 or 2 arguments (function) or (trigger, function) at ${call.getStartLineNumber()}`);
        }

        let trigger: string | undefined;
        let funcArg: Node;

        if (args.length === 1) {
            // chain(function) - no trigger
            funcArg = args[0]!;
        } else {
            // chain(trigger, function) - with trigger
            const triggerArg = args[0]!;
            funcArg = args[1]!;

            // Parse trigger expression
            trigger = expressionToTrigger(triggerArg as Expression, this.vars);
        }

        // Parse function (either reference or inline expression)
        if (Node.isIdentifier(funcArg)) {
            // Function reference: chain(myFunc) or chain(trigger, myFunc)
            const funcName = funcArg.getText();
            const funcInfo = this.funcs.get(funcName);
            if (!funcInfo) {
                throw new Error(`Function "${funcName}" not found in chain() at ${funcArg.getStartLineNumber()}`);
            }

            // Use trigger from argument, ignore if-wrapper trigger
            const chain = transformFunctionToChain(funcInfo.func, this.vars, trigger);
            return chain ? [chain] : null;
        } else if (Node.isFunctionExpression(funcArg)) {
            // Inline function: chain(function name() { ... }) or chain(trigger, function name() { ... })
            const func = funcArg as FunctionExpression;
            const chain = transformFunctionToChain(func, this.vars, trigger);
            return chain ? [chain] : null;
        }

        throw new Error(`chain() function argument must be a function reference or inline function expression at ${call.getStartLineNumber()}`);
    }

    /**
     * Transform begin(filename, [states]) to BEGIN.
     * All functions are emitted as states.
     */
    private transformBegin(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 2) {
            throw new Error(`begin() requires 2 arguments (filename, states) at ${call.getStartLineNumber()}`);
        }

        const filenameArg = args[0];
        const statesArg = args[1];

        if (!filenameArg || !statesArg) {
            throw new Error(`begin() requires 2 arguments (filename, states) at ${call.getStartLineNumber()}`);
        }

        const filename = resolveStringExpr(filenameArg as Expression, this.vars);

        if (!Node.isArrayLiteralExpression(statesArg)) {
            throw new Error(`begin() second argument must be an array of state functions at ${call.getStartLineNumber()}`);
        }

        const states: TDState[] = [];

        for (const element of (statesArg as ArrayLiteralExpression).getElements()) {
            if (Node.isIdentifier(element)) {
                const funcName = element.getText();
                const funcInfo = this.funcs.get(funcName);
                if (!funcInfo) {
                    throw new Error(`Function "${funcName}" not found in begin() at ${element.getStartLineNumber()}`);
                }

                // All functions in begin() are emitted as states
                const state = transformFunctionToState(funcInfo.func, this.vars, this.funcs, funcInfo.trigger);
                if (state) {
                    states.push(state);
                }
            }
        }

        // Create BEGIN construct
        if (states.length === 0) {
            return null;
        }

        const begin: TDBegin = {
            type: TDConstructType.Begin,
            filename,
            states,
        };

        return [begin];
    }

    /**
     * Transform append(filename, state | [states]) to APPEND.
     */
    private transformAppend(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 2) {
            throw new Error(`append() requires 2 arguments (filename, state or [states]) at ${call.getStartLineNumber()}`);
        }

        const filenameArg = args[0];
        const stateArg = args[1];

        if (!filenameArg || !stateArg) {
            throw new Error(`append() requires 2 arguments (filename, state or [states]) at ${call.getStartLineNumber()}`);
        }

        const filename = resolveStringExpr(filenameArg as Expression, this.vars);

        // State can be a single function reference, array of function references, or inline function
        const states: TDState[] = [];

        if (Node.isArrayLiteralExpression(stateArg)) {
            // Array of states
            for (const element of (stateArg as ArrayLiteralExpression).getElements()) {
                if (Node.isIdentifier(element)) {
                    const funcName = element.getText();
                    const funcInfo = this.funcs.get(funcName);
                    if (!funcInfo) {
                        throw new Error(`Function "${funcName}" not found in append() at ${element.getStartLineNumber()}`);
                    }
                    const state = transformFunctionToState(funcInfo.func, this.vars, this.funcs, funcInfo.trigger);
                    if (state) {
                        states.push(state);
                    }
                }
            }
        } else if (Node.isIdentifier(stateArg)) {
            // Single state
            const funcName = stateArg.getText();
            const funcInfo = this.funcs.get(funcName);
            if (!funcInfo) {
                throw new Error(`Function "${funcName}" not found in append() at ${stateArg.getStartLineNumber()}`);
            }
            const state = transformFunctionToState(funcInfo.func, this.vars, this.funcs, funcInfo.trigger);
            if (state) {
                states.push(state);
            }
        } else if (Node.isArrowFunction(stateArg) || Node.isFunctionExpression(stateArg)) {
            // Inline function - needs label from somewhere
            // For now, skip inline functions
        }

        const append: TDAppend = {
            type: TDConstructType.Append,
            filename,
            states,
        };

        return [append];
    }

    /**
     * Transform extendTop/extendBottom to EXTEND.
     * Signatures:
     *   extendTop(filename, state, transitions)
     *   extendBottom(filename, state, options, transitions)
     *   extendBottom(filename, state, transitions)
     */
    private transformExtend(call: CallExpression, isTop: boolean): TDConstruct[] | null {
        const funcName = isTop ? "extendTop" : "extendBottom";
        const args = call.getArguments();
        if (args.length < 3) {
            throw new Error(`${funcName}() requires at least 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filenameArg = args[0];
        const stateLabelArg = args[1];

        if (!filenameArg || !stateLabelArg) {
            throw new Error(`${funcName}() requires at least 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = resolveStringExpr(filenameArg as Expression, this.vars);
        const stateLabel = resolveStringExpr(stateLabelArg as Expression, this.vars);

        // Check if 3rd arg is options object or transitions function
        let position: number | undefined;
        let transitionsArg: Expression;

        if (args.length === 4) {
            // 4 args: filename, state, options, transitions
            const optionsArg = args[2];
            transitionsArg = args[3] as Expression;

            // Parse options object { position: N }
            if (Node.isObjectLiteralExpression(optionsArg)) {
                const props = optionsArg.getProperties();
                for (const prop of props) {
                    if (Node.isPropertyAssignment(prop)) {
                        const name = prop.getName();
                        if (name === "position") {
                            position = Number(prop.getInitializer()?.getText());
                        }
                    }
                }
            }
        } else if (args.length === 3) {
            // 3 args: filename, state, transitions
            transitionsArg = args[2] as Expression;
        } else {
            throw new Error(`${funcName}() takes 3 or 4 arguments at ${call.getStartLineNumber()}`);
        }

        // Extract transitions from arrow function body
        const transitions: TDTransition[] = [];
        if (Node.isArrowFunction(transitionsArg)) {
            const body = transitionsArg.getBody();
            if (Node.isBlock(body)) {
                // Process all statements together to build transitions
                processExtendStatements((body as Block).getStatements(), transitions, this.vars);
            }
        } else {
            throw new Error(`${funcName}() transitions argument must be an arrow function at ${call.getStartLineNumber()}`);
        }

        const extend: TDExtend = {
            type: isTop ? TDConstructType.ExtendTop : TDConstructType.ExtendBottom,
            filename,
            stateLabel,
            transitions,
            position,
        };

        return [extend];
    }

    /**
     * Transform interject() variants to INTERJECT.
     * interject(entryFile, entryLabel, globalVar, chainFunc, exitFile, exitLabel)
     * interjectCopyTrans(entryFile, entryLabel, globalVar, chainFunc, options?)
     * interjectCopyTrans2(entryFile, entryLabel, globalVar, chainFunc)
     */
    private transformInterject(
        call: CallExpression,
        type: TDConstructType.Interject | TDConstructType.InterjectCopyTrans | TDConstructType.InterjectCopyTrans2
    ): TDConstruct[] | null {
        const args = call.getArguments();
        const funcName = type === TDConstructType.Interject ? "interject" : type === TDConstructType.InterjectCopyTrans ? "interjectCopyTrans" : "interjectCopyTrans2";
        const minArgs = type === TDConstructType.Interject ? 6 : 4;

        if (args.length < minArgs) {
            throw new Error(`${funcName}() requires at least ${minArgs} arguments at ${call.getStartLineNumber()}`);
        }

        const entryFile = resolveStringExpr(args[0] as Expression, this.vars);
        const entryLabel = resolveStringExpr(args[1] as Expression, this.vars);
        const globalVar = resolveStringExpr(args[2] as Expression, this.vars);
        const chainFunc = args[3];

        // Check for safe option (interjectCopyTrans only, arg 5)
        let safe = false;
        if (type === TDConstructType.InterjectCopyTrans && args[4]) {
            const opts = args[4];
            if (Node.isObjectLiteralExpression(opts)) {
                for (const prop of opts.getProperties()) {
                    if (Node.isPropertyAssignment(prop) && prop.getName() === "safe") {
                        const value = prop.getInitializer();
                        if (value?.getText() === "true") {
                            safe = true;
                        }
                    }
                }
            }
        }

        // Parse chain function body to get entries
        const entries: TDChainEntry[] = [];

        if (Node.isArrowFunction(chainFunc)) {
            const body = chainFunc.getBody();
            if (Node.isBlock(body)) {
                const statements = (body as Block).getStatements();
                const currentEntry = processChainStatements(statements, entries, null, this.vars);

                // Push final entry
                if (currentEntry) {
                    entries.push(currentEntry);
                }
            }
        }

        if (entries.length === 0) {
            throw new Error(`${funcName}() chain function must have at least one say() at ${call.getStartLineNumber()}`);
        }

        // Determine epilogue
        let epilogue: TDChainEpilogue | undefined;
        if (type === TDConstructType.Interject) {
            const exitFile = resolveStringExpr(args[4] as Expression, this.vars);
            const exitLabel = resolveStringExpr(args[5] as Expression, this.vars);
            epilogue = {
                type: TDEpilogueType.End,
                filename: exitFile,
                target: exitLabel,
            };
        } else {
            epilogue = {
                type: TDEpilogueType.CopyTrans,
                filename: entryFile,
                target: entryLabel,
            };
        }

        const interject: TDInterject = {
            type,
            filename: entryFile,
            stateLabel: entryLabel,
            globalVariable: globalVar,
            safe: safe || undefined,
            entries,
            epilogue,
        };

        return [interject];
    }
}
