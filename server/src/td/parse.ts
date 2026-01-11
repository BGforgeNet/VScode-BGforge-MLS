/**
 * TD Parser - converts TypeScript AST to TD IR
 *
 * Walks the TypeScript AST (via ts-morph) and produces TDScript IR
 * for emission to WeiDU D format.
 */

import {
    ArrayLiteralExpression,
    Block,
    CallExpression,
    Expression,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    FunctionExpression,
    IfStatement,
    Node,
    SourceFile,
    Statement,
    SyntaxKind,
} from "ts-morph";
import {
    TDScript,
    TDConstruct,
    TDState,
    TDText,
    TDTransition,
    TDChain,
    TDChainEntry,
    TDChainEpilogue,
    TDBegin,
    TDAppend,
    TDExtend,
    TDInterject,
    TDAlterTrans,
    TDAddStateTrigger,
    TDAddTransTrigger,
    TDAddTransAction,
    TDReplaceTrans,
    TDReplaceText,
    TDSetWeight,
    TDReplaceSay,
    TDReplaceStateTrigger,
    TDReplaceStates,
} from "./types";
import * as utils from "../transpiler-utils";
import type { VarsContext } from "../transpiler-utils";

/** Function info including optional entry trigger from if-wrapping */
interface FuncInfo {
    func: FunctionDeclaration;
    trigger?: string;
}

/** Context for user function inlining */
type FuncsContext = Map<string, FuncInfo>;

/** TD function/keyword constants */
const TD_KEYWORDS = {
    SAY: "say",
    ACTION: "action",
    GOTO: "goTo",
    EXIT: "exit",
    REPLY: "reply",
    JOURNAL: "journal",
    SOLVED_JOURNAL: "solvedJournal",
    UNSOLVED_JOURNAL: "unsolvedJournal",
    FLAGS: "flags",
    EXTERN: "extern",
    WEIGHT: "weight",
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
    TRA: "tra",
    TLK: "tlk",
    TLK_FORCED: "tlkForced",
    OR: "OR",
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
                const value = this.evaluateExpression(init);
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
        if (!parent) return undefined;

        // Check if parent is a Block inside an IfStatement
        if (Node.isBlock(parent)) {
            const blockParent = parent.getParent();
            if (Node.isIfStatement(blockParent)) {
                // This function is the "then" branch of an if
                return this.expressionToTrigger(blockParent.getExpression());
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
                return this.transformInterject(call, "interject");
            case TD_KEYWORDS.INTERJECT_COPY_TRANS:
                return this.transformInterject(call, "interject_copy_trans");
            case TD_KEYWORDS.INTERJECT_COPY_TRANS2:
                return this.transformInterject(call, "interject_copy_trans2");
            case TD_KEYWORDS.REPLACE:
                return this.transformReplace(call);
            case TD_KEYWORDS.ALTER_TRANS:
                return this.transformAlterTrans(call);
            case TD_KEYWORDS.ADD_STATE_TRIGGER:
                return this.transformAddStateTrigger(call);
            case TD_KEYWORDS.ADD_TRANS_TRIGGER:
                return this.transformAddTransTrigger(call);
            case TD_KEYWORDS.ADD_TRANS_ACTION:
                return this.transformAddTransAction(call);
            case TD_KEYWORDS.REPLACE_TRANS_TRIGGER:
                return this.transformReplaceTrans(call, "replace_trans_trigger");
            case TD_KEYWORDS.REPLACE_TRANS_ACTION:
                return this.transformReplaceTrans(call, "replace_trans_action");
            case TD_KEYWORDS.REPLACE_TRIGGER_TEXT:
                return this.transformReplaceText(call, "replace_trigger_text");
            case TD_KEYWORDS.REPLACE_ACTION_TEXT:
                return this.transformReplaceText(call, "replace_action_text");
            case TD_KEYWORDS.SET_WEIGHT:
                return this.transformSetWeight(call);
            case TD_KEYWORDS.REPLACE_SAY:
                return this.transformReplaceSay(call);
            case TD_KEYWORDS.REPLACE_STATE_TRIGGER:
                return this.transformReplaceStateTrigger(call);
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
            trigger = this.expressionToTrigger(triggerArg as Expression);
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
            const chain = this.transformFunctionToChain(funcInfo.func, trigger);
            return chain ? [chain] : null;
        } else if (Node.isFunctionExpression(funcArg)) {
            // Inline function: chain(function name() { ... }) or chain(trigger, function name() { ... })
            const func = funcArg as FunctionExpression;
            const chain = this.transformFunctionToChain(func, trigger);
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

        const filename = this.resolveStringExpr(filenameArg as Expression);

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
                const state = this.transformFunctionToState(funcInfo.func, funcInfo.trigger);
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
            type: "begin",
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

        const filename = this.resolveStringExpr(filenameArg as Expression);

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
                    const state = this.transformFunctionToState(funcInfo.func, funcInfo.trigger);
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
            const state = this.transformFunctionToState(funcInfo.func, funcInfo.trigger);
            if (state) {
                states.push(state);
            }
        } else if (Node.isArrowFunction(stateArg) || Node.isFunctionExpression(stateArg)) {
            // Inline function - needs label from somewhere
            // For now, skip inline functions
        }

        const append: TDAppend = {
            type: "append",
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

        const filename = this.resolveStringExpr(filenameArg as Expression);
        const stateLabel = this.resolveStringExpr(stateLabelArg as Expression);

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

        if (!transitionsArg) {
            throw new Error(`${funcName}() requires transitions function at ${call.getStartLineNumber()}`);
        }

        // Extract transitions from arrow function body
        const transitions: TDTransition[] = [];
        if (Node.isArrowFunction(transitionsArg)) {
            const body = transitionsArg.getBody();
            if (Node.isBlock(body)) {
                // Process all statements together to build transitions
                this.processExtendStatements((body as Block).getStatements(), transitions);
            }
        } else {
            throw new Error(`${funcName}() transitions argument must be an arrow function at ${call.getStartLineNumber()}`);
        }

        const extend: TDExtend = {
            type: isTop ? "extend_top" : "extend_bottom",
            filename,
            stateLabel,
            transitions,
            position,
        };

        return [extend];
    }

    /**
     * Process say() call within chain context.
     * Handles say(speaker, text) vs say(text) multisay pattern.
     */
    private processSayInChain(
        args: Node[],
        expr: CallExpression,
        currentEntry: TDChainEntry | null,
        entries: TDChainEntry[],
        options?: { trigger?: string }
    ): TDChainEntry | null {
        if (args.length >= 2 && args[0] && args[1]) {
            // say(speaker, text) - new entry with speaker
            if (currentEntry) {
                entries.push(currentEntry);
            }
            const newEntry: TDChainEntry = {
                speaker: utils.stripQuotes(args[0].getText()),
                texts: [this.expressionToText(args[1] as Expression)],
            };
            if (options?.trigger) {
                newEntry.trigger = options.trigger;
            }
            return newEntry;
        } else if (args.length >= 1 && args[0]) {
            // say(text) - multisay continuation
            if (!currentEntry) {
                throw new Error(
                    `say(text) without speaker - must use say(speaker, text) first at ${expr.getStartLineNumber()}`
                );
            }
            currentEntry.texts.push(this.expressionToText(args[0] as Expression));
            return currentEntry;
        } else {
            throw new Error(`say() requires at least 1 argument at ${expr.getStartLineNumber()}`);
        }
    }

    /**
     * Process chain function body statements to extract entries.
     * Handles say(speaker, text), say(text) multisay, and conditionals.
     */
    private processChainStatements(
        statements: Statement[],
        entries: TDChainEntry[],
        currentEntry: TDChainEntry | null,
        options?: { trigger?: string }
    ): TDChainEntry | null {
        for (const stmt of statements) {
            if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
                const expr = stmt.getExpression();
                if (Node.isCallExpression(expr)) {
                    const funcName = expr.getExpression().getText();
                    const args = expr.getArguments();

                    if (funcName === TD_KEYWORDS.SAY) {
                        currentEntry = this.processSayInChain(
                            args,
                            expr,
                            currentEntry,
                            entries,
                            options
                        );
                    }
                }
            } else if (stmt.isKind(SyntaxKind.IfStatement)) {
                // Push current entry before processing conditional
                if (currentEntry) {
                    entries.push(currentEntry);
                    currentEntry = null;
                }
                this.processChainIf(stmt as IfStatement, entries, currentEntry);
            }
        }

        return currentEntry;
    }

    /**
     * Transform interject() variants to INTERJECT.
     * interject(entryFile, entryLabel, globalVar, chainFunc, exitFile, exitLabel)
     * interjectCopyTrans(entryFile, entryLabel, globalVar, chainFunc, options?)
     * interjectCopyTrans2(entryFile, entryLabel, globalVar, chainFunc)
     */
    private transformInterject(
        call: CallExpression,
        type: "interject" | "interject_copy_trans" | "interject_copy_trans2"
    ): TDConstruct[] | null {
        const args = call.getArguments();
        const funcName = type === "interject" ? "interject" : type === "interject_copy_trans" ? "interjectCopyTrans" : "interjectCopyTrans2";
        const minArgs = type === "interject" ? 6 : 4;

        if (args.length < minArgs) {
            throw new Error(`${funcName}() requires at least ${minArgs} arguments at ${call.getStartLineNumber()}`);
        }

        const entryFile = this.resolveStringExpr(args[0] as Expression);
        const entryLabel = this.resolveStringExpr(args[1] as Expression);
        const globalVar = this.resolveStringExpr(args[2] as Expression);
        const chainFunc = args[3];

        // Check for safe option (interjectCopyTrans only, arg 5)
        let safe = false;
        if (type === "interject_copy_trans" && args[4]) {
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
                const currentEntry = this.processChainStatements(statements, entries, null);

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
        if (type === "interject") {
            const exitFile = this.resolveStringExpr(args[4] as Expression);
            const exitLabel = this.resolveStringExpr(args[5] as Expression);
            epilogue = {
                type: "end",
                filename: exitFile,
                target: exitLabel,
            };
        } else if (type === "interject_copy_trans" || type === "interject_copy_trans2") {
            epilogue = {
                type: "copy_trans",
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

    // =============================================================================
    // Patch Operations
    // =============================================================================

    /**
     * Transform alterTrans(filename, states, transitions, changes)
     */
    private transformAlterTrans(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 4) {
            throw new Error(`alterTrans() requires 4 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const states = this.parseStateList(args[1] as Expression);
        const transitions = this.parseNumberArray(args[2] as Expression);
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
                        changes.trigger = this.expressionToTrigger(value);
                    }
                } else if (propName === "action") {
                    changes.action = this.expressionToAction(value);
                } else if (propName === "reply") {
                    changes.reply = this.expressionToText(value);
                }
            }
        }

        const operation: TDAlterTrans = {
            op: "alter_trans",
            filename,
            states,
            transitions,
            changes,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform addStateTrigger(filename, states, trigger, options?)
     */
    private transformAddStateTrigger(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 3) {
            throw new Error(`addStateTrigger() requires at least 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const states = this.parseStateList(args[1] as Expression);
        const trigger = this.expressionToTrigger(args[2] as Expression);
        const unless = args[3] ? this.parseUnless(args[3] as Expression) : undefined;

        const operation: TDAddStateTrigger = {
            op: "add_state_trigger",
            filename,
            states,
            trigger,
            unless,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform addTransTrigger(filename, states, trigger, options?)
     */
    private transformAddTransTrigger(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 3) {
            throw new Error(`addTransTrigger() requires at least 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const states = this.parseStateList(args[1] as Expression);
        const trigger = this.expressionToTrigger(args[2] as Expression);

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
                            transitions = this.parseNumberArray(value);
                        } else if (propName === "unless") {
                            unless = this.parseUnless(value);
                        }
                    }
                }
            }
        }

        const operation: TDAddTransTrigger = {
            op: "add_trans_trigger",
            filename,
            states,
            transitions,
            trigger,
            unless,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform addTransAction(filename, states, transitions, action, options?)
     */
    private transformAddTransAction(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 4) {
            throw new Error(`addTransAction() requires at least 4 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const states = this.parseStateList(args[1] as Expression);
        const transitions = this.parseNumberArray(args[2] as Expression);
        const action = this.expressionToAction(args[3] as Expression);
        const unless = args[4] ? this.parseUnless(args[4] as Expression) : undefined;

        const operation: TDAddTransAction = {
            op: "add_trans_action",
            filename,
            states,
            transitions,
            action,
            unless,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform replaceTransTrigger/replaceTransAction
     */
    private transformReplaceTrans(
        call: CallExpression,
        op: "replace_trans_trigger" | "replace_trans_action"
    ): TDConstruct[] | null {
        const args = call.getArguments();
        const funcName = op === "replace_trans_trigger" ? "replaceTransTrigger" : "replaceTransAction";

        if (args.length < 5) {
            throw new Error(`${funcName}() requires at least 5 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const states = this.parseStateList(args[1] as Expression);
        const transitions = this.parseNumberArray(args[2] as Expression);
        const oldText = utils.stripQuotes(args[3]!.getText());
        const newText = utils.stripQuotes(args[4]!.getText());
        const unless = args[5] ? this.parseUnless(args[5] as Expression) : undefined;

        const operation: TDReplaceTrans = {
            op,
            filename,
            states,
            transitions,
            oldText,
            newText,
            unless,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform replaceTriggerText/replaceActionText
     */
    private transformReplaceText(
        call: CallExpression,
        op: "replace_trigger_text" | "replace_action_text"
    ): TDConstruct[] | null {
        const args = call.getArguments();
        const funcName = op === "replace_trigger_text" ? "replaceTriggerText" : "replaceActionText";

        if (args.length < 3) {
            throw new Error(`${funcName}() requires at least 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filenamesArg = args[0];
        let filenames: string[];

        // Can be a single string or array of strings
        if (Node.isStringLiteral(filenamesArg) || filenamesArg?.getKind() === SyntaxKind.StringLiteral) {
            filenames = [this.resolveStringExpr(filenamesArg as Expression)];
        } else if (Node.isArrayLiteralExpression(filenamesArg)) {
            filenames = filenamesArg.getElements().map((e) => this.resolveStringExpr(e as Expression));
        } else {
            throw new Error(`${funcName}() first argument must be a string or array of strings at ${call.getStartLineNumber()}`);
        }

        const oldText = utils.stripQuotes(args[1]!.getText());
        const newText = utils.stripQuotes(args[2]!.getText());
        const unless = args[3] ? this.parseUnless(args[3] as Expression) : undefined;

        const operation: TDReplaceText = {
            op,
            filenames,
            oldText,
            newText,
            unless,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform setWeight(filename, state, weight)
     */
    private transformSetWeight(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 3) {
            throw new Error(`setWeight() requires 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const state = this.resolveStringExpr(args[1] as Expression);
        const weight = Number(args[2]!.getText());

        const operation: TDSetWeight = {
            op: "set_weight",
            filename,
            state,
            weight,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform replaceSay(filename, state, text)
     */
    private transformReplaceSay(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 3) {
            throw new Error(`replaceSay() requires 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const state = this.resolveStringExpr(args[1] as Expression);
        const text = this.expressionToText(args[2] as Expression);

        const operation: TDReplaceSay = {
            op: "replace_say",
            filename,
            state,
            text,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform replaceStateTrigger(filename, states, trigger, options?)
     */
    private transformReplaceStateTrigger(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 3) {
            throw new Error(`replaceStateTrigger() requires at least 3 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
        const states = this.parseStateList(args[1] as Expression);
        const trigger = this.expressionToTrigger(args[2] as Expression);
        const unless = args[3] ? this.parseUnless(args[3] as Expression) : undefined;

        const operation: TDReplaceStateTrigger = {
            op: "replace_state_trigger",
            filename,
            states,
            trigger,
            unless,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform replace(filename, { stateNum: function, ... })
     * Replaces entire states by their numeric index
     */
    private transformReplace(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 2) {
            throw new Error(`replace() requires 2 arguments at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(args[0] as Expression);
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
                const state = this.transformFunctionToState(funcDecl);

                if (!state) {
                    throw new Error(`replace() failed to parse state ${stateNum} at ${call.getStartLineNumber()}`);
                }

                // Override label with the numeric state
                state.label = stateNum.toString();
                replacements.set(stateNum, state);
            }
        }

        const operation: TDReplaceStates = {
            op: "replace_states",
            filename,
            replacements,
        };

        return [{ type: "patch", operation }];
    }

    /**
     * Transform a function to a STATE.
     */
    private transformFunctionToState(func: FunctionDeclaration, entryTrigger?: string): TDState | null {
        const name = func.getName();
        if (!name) return null;

        const body = func.getBody()?.asKind(SyntaxKind.Block);
        if (!body) return null;

        const state: TDState = {
            label: name,
            trigger: entryTrigger,
            say: [],
            transitions: [],
        };

        // Process body statements
        for (const stmt of body.getStatements()) {
            this.processStateStatement(stmt, state);
        }

        return state;
    }

    /**
     * Process a statement inside a state function.
     */
    private processStateStatement(stmt: Statement, state: TDState) {
        if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                const funcName = expr.getExpression().getText();
                const args = expr.getArguments();

                // Handle say() - specific to states
                if (funcName === "say") {
                    this.validateArgs("say", args, 1, expr.getStartLineNumber());
                    state.say.push({ text: this.expressionToText(args[0] as Expression) });
                }
                // Handle weight() - specific to states
                else if (funcName === "weight") {
                    this.validateArgs("weight", args, 1, expr.getStartLineNumber());
                    state.weight = Number(args[0]!.getText()); // Guaranteed by validateArgs
                }
                // Handle transition calls - use unified helper
                else {
                    const context = {
                        getLastTransition: () => state.transitions[state.transitions.length - 1],
                        addTransition: (trans: TDTransition) => state.transitions.push(trans),
                    };

                    const handled = this.processTransitionCall(funcName, args, expr, context);

                    // If not a transition call, check if it's a user function
                    if (!handled) {
                        const funcInfo = this.funcs.get(funcName);
                        if (funcInfo) {
                            this.inlineUserFunction(expr, funcInfo.func, state);
                        }
                    }
                }
            }
        } else if (stmt.isKind(SyntaxKind.IfStatement)) {
            // if (trigger) { ... } - transition with trigger
            this.processIfTransition(stmt as IfStatement, state);
        } else if (stmt.isKind(SyntaxKind.ForOfStatement)) {
            // for (const x of arr) { ... } - unroll
            this.unrollForOf(stmt as ForOfStatement, (s) => this.processStateStatement(s, state));
        } else if (stmt.isKind(SyntaxKind.ForStatement)) {
            // for (let i = 0; ...) { ... } - unroll
            this.unrollFor(stmt as ForStatement, (s) => this.processStateStatement(s, state));
        }
    }

    /**
     * Process an if statement as a transition with trigger.
     */
    private processIfTransition(ifStmt: IfStatement, state: TDState) {
        const trigger = this.expressionToTrigger(ifStmt.getExpression());
        const thenStmts = utils.getBlockStatements(ifStmt.getThenStatement());

        // Create transition with trigger
        const trans: TDTransition = {
            trigger,
            next: { type: "exit" }, // Default
        };
        state.transitions.push(trans);

        // Process then block to fill in transition details
        for (const s of thenStmts) {
            this.processTransitionStatement(s, trans);
        }

        // Handle else branch (creates additional transitions)
        const elseStmt = ifStmt.getElseStatement();
        if (elseStmt) {
            if (Node.isIfStatement(elseStmt)) {
                // else if - recurse
                this.processIfTransition(elseStmt, state);
            } else {
                // else block - no trigger transition
                const elseStmts = utils.getBlockStatements(elseStmt);
                const elseTrans: TDTransition = {
                    next: { type: "exit" },
                };
                state.transitions.push(elseTrans);
                for (const s of elseStmts) {
                    this.processTransitionStatement(s, elseTrans);
                }
            }
        }
    }

    /**
     * Process a statement that fills in transition details.
     */
    private processTransitionStatement(stmt: Statement, trans: TDTransition) {
        if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                const funcName = expr.getExpression().getText();
                const args = expr.getArguments();

                // Special handling for reply() in single transition context
                if (funcName === "reply") {
                    this.validateArgs("reply", args, 1, expr.getStartLineNumber());
                    trans.reply = this.expressionToText(args[0] as Expression);
                    return;
                }

                // Create context wrapper for single transition
                const context = {
                    getLastTransition: () => trans,
                    addTransition: () => {
                        // In single-transition context, we don't add new transitions
                        // This shouldn't be called for this context
                    },
                };

                this.processTransitionCall(funcName, args, expr, context);
            }
        }
    }

    /**
     * Transform a function to a CHAIN.
     */
    private transformFunctionToChain(func: FunctionDeclaration | FunctionExpression, entryTrigger?: string): TDChain | null {
        const name = func.getName();
        if (!name) return null;

        const body = func.getBody()?.asKind(SyntaxKind.Block);
        if (!body) return null;

        // Get first speaker from first say(speaker, text)
        let filename = "";
        const entries: TDChainEntry[] = [];
        let currentEntry: TDChainEntry | null = null;
        let epilogue: TDChainEpilogue = { type: "exit" };

        for (const stmt of body.getStatements()) {
            if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
                const expr = stmt.getExpression();
                if (Node.isCallExpression(expr)) {
                    const funcName = expr.getExpression().getText();
                    const args = expr.getArguments();

                    if (funcName === TD_KEYWORDS.SAY) {
                        currentEntry = this.processSayInChain(args, expr, currentEntry, entries);
                        // Extract filename from first speaker
                        if (!filename && currentEntry?.speaker) {
                            filename = currentEntry.speaker;
                        }
                    } else if (funcName === TD_KEYWORDS.ACTION) {
                        // Action after current entry
                        if (args.length === 0) {
                            throw new Error(`action() requires at least 1 argument at ${expr.getStartLineNumber()}`);
                        }
                        if (!currentEntry) {
                            throw new Error(`action() must come after a say() statement at ${expr.getStartLineNumber()}`);
                        }
                        currentEntry.action = args.map(a => a.getText()).join(" ");
                    } else if (funcName === "exit") {
                        epilogue = { type: "exit" };
                    } else if (funcName === "goTo") {
                        if (args.length < 1 || !args[0]) {
                            throw new Error(`goTo() requires at least 1 argument at ${expr.getStartLineNumber()}`);
                        }
                        epilogue = {
                            type: "end",
                            filename,
                            target: args[0].getText(),
                        };
                    }
                }
            } else if (stmt.isKind(SyntaxKind.IfStatement)) {
                // Conditional in chain - push current entry first to preserve order
                if (currentEntry) {
                    entries.push(currentEntry);
                    currentEntry = null;
                }
                this.processChainIf(stmt as IfStatement, entries, currentEntry);
            }
        }

        // Push final entry
        if (currentEntry) {
            entries.push(currentEntry);
        }

        return {
            type: "chain",
            filename,
            label: name,
            trigger: entryTrigger,
            entries,
            epilogue,
        };
    }

    /**
     * Process an if statement inside a chain (conditional text).
     */
    private processChainIf(ifStmt: IfStatement, entries: TDChainEntry[], _currentEntry: TDChainEntry | null) {
        const trigger = this.expressionToTrigger(ifStmt.getExpression());
        const thenStmts = utils.getBlockStatements(ifStmt.getThenStatement());

        const conditionalEntry = this.processChainStatements(
            thenStmts,
            entries,
            null,
            { trigger }
        );

        // Push final conditional entry
        if (conditionalEntry) {
            entries.push(conditionalEntry);
        }
    }

    /**
     * Process statements in extend block to build transitions.
     * Similar to processStateStatement but builds transitions directly.
     */
    private processExtendStatements(statements: Statement[], transitions: TDTransition[]) {
        for (const stmt of statements) {
            if (stmt.isKind(SyntaxKind.IfStatement)) {
                // if (trigger) { ... } - transition with trigger
                const ifStmt = stmt as IfStatement;
                const trigger = this.expressionToTrigger(ifStmt.getExpression());
                const thenStmts = utils.getBlockStatements(ifStmt.getThenStatement());

                const trans: TDTransition = {
                    trigger,
                    next: { type: "exit" },
                };

                for (const s of thenStmts) {
                    this.processTransitionStatement(s, trans);
                }

                transitions.push(trans);
            } else if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
                // Expression statement - could be reply(), goTo(), action(), etc.
                const expr = stmt.getExpression();
                if (Node.isCallExpression(expr)) {
                    const funcName = expr.getExpression().getText();
                    const args = expr.getArguments();

                    // Create context for transitions array
                    const context = {
                        getLastTransition: () => transitions[transitions.length - 1],
                        addTransition: (trans: TDTransition) => transitions.push(trans),
                    };

                    this.processTransitionCall(funcName, args, expr, context);
                }
            } else if (stmt.isKind(SyntaxKind.ForOfStatement)) {
                // Unroll loop
                this.unrollForOf(stmt as ForOfStatement, (s) => {
                    this.processExtendStatements([s], transitions);
                });
            } else if (stmt.isKind(SyntaxKind.ForStatement)) {
                // Unroll loop
                this.unrollFor(stmt as ForStatement, (s) => {
                    this.processExtendStatements([s], transitions);
                });
            }
        }
    }

    /**
     * Inline a user function call into a state.
     */
    private inlineUserFunction(call: CallExpression, func: FunctionDeclaration, state: TDState) {
        const body = func.getBody()?.asKind(SyntaxKind.Block);
        if (!body) return;

        const paramMap = utils.buildParamMap(call, func, this.vars);

        // Save current vars
        const savedVars = new Map(this.vars);
        paramMap.forEach((value, key) => this.vars.set(key, value));

        // Process function body
        for (const stmt of body.getStatements()) {
            this.processStateStatement(stmt, state);
        }

        // Restore vars
        this.vars = savedVars;
    }

    // =========================================================================
    // Expression Helpers
    // =========================================================================

    /**
     * Convert an expression to a trigger string.
     */
    private expressionToTrigger(expr: Expression): string {
        // Handle binary expressions (||, &&)
        if (Node.isBinaryExpression(expr)) {
            const opKind = expr.getOperatorToken().getKind();

            if (opKind === SyntaxKind.AmpersandAmpersandToken) {
                // AND: space-separated conditions
                const left = this.expressionToTrigger(expr.getLeft());
                const right = this.expressionToTrigger(expr.getRight());
                return `${left} ${right}`;
            }

            if (opKind === SyntaxKind.BarBarToken) {
                // OR: collect all OR-ed conditions and emit as OR(n) cond1 cond2 ...
                const conditions = this.collectOrConditions(expr);
                const count = conditions.length;
                return `OR(${count}) ${conditions.join(" ")}`;
            }
        }

        // Handle parenthesized expression
        if (Node.isParenthesizedExpression(expr)) {
            return this.expressionToTrigger(expr.getExpression());
        }

        // Handle OR(n, cond1, cond2, ...) -> OR(n) cond1 cond2 ...
        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            if (funcName === "OR" && expr.getArguments().length >= 2) {
                const args = expr.getArguments();
                const count = args[0]?.getText() ?? "2";
                const conditions = args.slice(1).map(a => this.expressionToTrigger(a as Expression));
                return `OR(${count}) ${conditions.join(" ")}`;
            }
            // Regular function call - serialize as trigger
            return this.expressionToActionString(expr);
        }

        // Handle ! prefix
        if (Node.isPrefixUnaryExpression(expr) && expr.getOperatorToken() === SyntaxKind.ExclamationToken) {
            const inner = this.expressionToTrigger(expr.getOperand());
            return `!${inner}`;
        }

        return utils.substituteVars(expr.getText(), this.vars);
    }

    /**
     * Collect all conditions from a || chain into a flat array.
     */
    private collectOrConditions(expr: Expression): string[] {
        const conditions: string[] = [];

        const collect = (e: Expression) => {
            if (Node.isBinaryExpression(e) && e.getOperatorToken().getKind() === SyntaxKind.BarBarToken) {
                collect(e.getLeft());
                collect(e.getRight());
            } else if (Node.isParenthesizedExpression(e)) {
                collect(e.getExpression());
            } else {
                // Atom - could be a call, negated call, or other expression
                conditions.push(this.expressionToTrigger(e));
            }
        };

        collect(expr);
        return conditions;
    }

    /**
     * Convert an expression to an action string.
     */
    private expressionToAction(expr: Expression): string {
        return this.expressionToActionString(expr);
    }

    /**
     * Convert an expression to TDText.
     */
    private expressionToText(expr: Expression): TDText {
        // Handle object literal for male/female variants
        if (Node.isObjectLiteralExpression(expr)) {
            let male: TDText | undefined;
            let female: TDText | undefined;
            let maleSound: string | undefined;
            let femaleSound: string | undefined;

            for (const prop of expr.getProperties()) {
                if (Node.isPropertyAssignment(prop)) {
                    const propName = prop.getName();
                    const value = prop.getInitializer();
                    if (!value) continue;

                    if (propName === "male") {
                        male = this.expressionToText(value);
                    } else if (propName === "female") {
                        female = this.expressionToText(value);
                    } else if (propName === "maleSound") {
                        maleSound = utils.stripQuotes(value.getText());
                    } else if (propName === "femaleSound") {
                        femaleSound = utils.stripQuotes(value.getText());
                    }
                }
            }

            if (male && female) {
                if (maleSound) male.sound = maleSound;
                if (femaleSound) female.sound = femaleSound;
                return {
                    type: "tra", // Placeholder, actual type from male/female
                    value: 0,
                    male,
                    female,
                };
            }
        }

        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const args = expr.getArguments();

            // tra(num) or tra(num, { sound: "..." })
            if (funcName === TD_KEYWORDS.TRA && args.length >= 1 && args[0]) {
                const argText = utils.substituteVars(args[0].getText(), this.vars);
                const text: TDText = {
                    type: "tra",
                    value: Number(argText),
                };

                // Check for options (second argument)
                if (args[1] && Node.isObjectLiteralExpression(args[1])) {
                    for (const prop of args[1].getProperties()) {
                        if (Node.isPropertyAssignment(prop) && prop.getName() === "sound") {
                            const soundValue = prop.getInitializer();
                            if (soundValue) {
                                text.sound = utils.stripQuotes(soundValue.getText());
                            }
                        }
                    }
                }

                return text;
            }

            // tlk(num) or tlk(num, { sound: "..." })
            if (funcName === TD_KEYWORDS.TLK && args.length >= 1 && args[0]) {
                const argText = utils.substituteVars(args[0].getText(), this.vars);
                const text: TDText = {
                    type: "tlk",
                    value: Number(argText),
                };

                // Check for options
                if (args[1] && Node.isObjectLiteralExpression(args[1])) {
                    for (const prop of args[1].getProperties()) {
                        if (Node.isPropertyAssignment(prop) && prop.getName() === "sound") {
                            const soundValue = prop.getInitializer();
                            if (soundValue) {
                                text.sound = utils.stripQuotes(soundValue.getText());
                            }
                        }
                    }
                }

                return text;
            }

            // tlkForced(num, text) - text override is stored in emitter, not IR
            if (funcName === TD_KEYWORDS.TLK_FORCED && args.length >= 2 && args[0] && args[1]) {
                const numText = utils.substituteVars(args[0].getText(), this.vars);
                return {
                    type: "forced",
                    value: numText,
                };
            }
        }

        if (Node.isStringLiteral(expr)) {
            return {
                type: "literal",
                value: utils.stripQuotes(expr.getText()),
            };
        }

        // Fallback to literal
        return {
            type: "literal",
            value: utils.substituteVars(expr.getText(), this.vars),
        };
    }

    // =========================================================================
    // Loop Unrolling
    // =========================================================================

    /**
     * Unroll a for-of loop.
     * Supports both simple variables and array destructuring patterns.
     */
    private unrollForOf(forOf: ForOfStatement, onStatement: (s: Statement) => void) {
        const arrayExpr = forOf.getExpression();
        const elements = this.resolveArrayElements(arrayExpr);

        if (!elements) {
            throw new Error(`Cannot unroll for-of: array "${arrayExpr.getText()}" not resolvable`);
        }

        const initializer = forOf.getInitializer();
        const bodyStmts = utils.getBlockStatements(forOf.getStatement());

        // Check for array destructuring pattern: const [a, b, c] of array
        const bindingPattern = initializer.getDescendantsOfKind(SyntaxKind.ArrayBindingPattern)[0];

        if (bindingPattern) {
            // Destructuring: extract binding element names
            const bindingNames = utils.getBindingNames(bindingPattern);

            for (const element of elements) {
                const values = utils.parseArrayLiteral(element);
                if (!values) {
                    throw new Error(`Cannot destructure "${element}" - not a valid array literal`);
                }

                // Set each destructured variable
                for (let i = 0; i < bindingNames.length; i++) {
                    const name = bindingNames[i];
                    if (name) {
                        this.vars.set(name, values[i] ?? "undefined");
                    }
                }

                for (const stmt of bodyStmts) {
                    onStatement(stmt);
                }
            }

            // Clean up all destructured variables
            for (const name of bindingNames) {
                if (name) {
                    this.vars.delete(name);
                }
            }
        } else {
            // Simple variable: const item of array
            const loopVar = initializer.getText().replace(/^const\s+/, "").replace(/^let\s+/, "");

            for (const element of elements) {
                this.vars.set(loopVar, element);
                for (const stmt of bodyStmts) {
                    onStatement(stmt);
                }
            }

            this.vars.delete(loopVar);
        }
    }

    /**
     * Unroll a for loop.
     */
    private unrollFor(forStmt: ForStatement, onStatement: (s: Statement) => void) {
        const initializer = forStmt.getInitializer();
        if (!initializer || !initializer.isKind(SyntaxKind.VariableDeclarationList)) {
            throw new Error("Cannot unroll for loop: complex initializer");
        }

        const decls = initializer.getDeclarations();
        const firstDecl = decls[0];
        if (!firstDecl) {
            throw new Error("Cannot unroll for loop: no variable declaration");
        }

        const loopVar = firstDecl.getName();
        const initValue = utils.evaluateNumeric(firstDecl.getInitializer(), this.vars);
        if (initValue === undefined) {
            throw new Error("Cannot unroll for loop: non-numeric initializer");
        }

        const condition = forStmt.getCondition();
        if (!condition) {
            throw new Error("Cannot unroll for loop: no condition");
        }

        const incrementor = forStmt.getIncrementor();
        if (!incrementor) {
            throw new Error("Cannot unroll for loop: no incrementor");
        }

        const increment = utils.parseIncrement(incrementor.getText());
        const bodyStmts = utils.getBlockStatements(forStmt.getStatement());

        let current = initValue;
        let iterations = 0;

        while (utils.evaluateCondition(condition.getText(), loopVar, current, this.vars)) {
            if (iterations >= utils.MAX_LOOP_ITERATIONS) {
                throw new Error(`Loop exceeded ${utils.MAX_LOOP_ITERATIONS} iterations`);
            }

            this.vars.set(loopVar, current.toString());
            for (const stmt of bodyStmts) {
                onStatement(stmt);
            }

            current += increment;
            iterations++;
        }

        this.vars.delete(loopVar);
    }

    // =========================================================================
    // Utility Methods
    // =========================================================================

    private evaluateExpression(expr: Expression): string | undefined {
        if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
            const elements = (expr as ArrayLiteralExpression)
                .getElements()
                .map(e => e.getText());
            return `[${elements.join(", ")}]`;
        }

        if (expr.isKind(SyntaxKind.StringLiteral) || expr.isKind(SyntaxKind.NumericLiteral)) {
            return expr.getText();
        }

        if (expr.isKind(SyntaxKind.Identifier)) {
            const name = expr.getText();
            return this.vars.get(name);
        }

        return expr.getText();
    }

    private resolveArrayElements(expr: Expression): string[] | null {
        if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
            // Use flattenArrayElements to support spread expressions
            return utils.flattenArrayElements(expr as ArrayLiteralExpression, this.vars);
        }

        if (expr.isKind(SyntaxKind.Identifier)) {
            const name = expr.getText();
            const value = this.vars.get(name);
            if (value && value.startsWith("[") && value.endsWith("]")) {
                // Use parseArrayLiteral to handle nested arrays correctly
                return utils.parseArrayLiteral(value);
            }
        }

        return null;
    }

    /**
     * Resolve an expression to its string value.
     * Handles string literals and variable references.
     */
    private resolveStringExpr(expr: Expression): string {
        if (Node.isStringLiteral(expr)) {
            return utils.stripQuotes(expr.getText());
        }
        if (Node.isIdentifier(expr)) {
            const name = expr.getText();
            const value = this.vars.get(name);
            if (value !== undefined) {
                return utils.stripQuotes(value);
            }
            return name;
        }
        return utils.stripQuotes(expr.getText());
    }

    /**
     * Convert an expression to a D action string.
     * Function calls are serialized as FunctionName(arg1,arg2,...).
     */
    private expressionToActionString(expr: Expression): string {
        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const args = expr.getArguments();
            const argStrings = args.map(a => this.expressionToActionString(a as Expression));
            return `${funcName}(${argStrings.join(",")})`;
        }

        if (Node.isStringLiteral(expr)) {
            // Keep quotes for string arguments
            return expr.getText();
        }

        if (Node.isNumericLiteral(expr)) {
            return expr.getText();
        }

        if (Node.isIdentifier(expr)) {
            // Could be a constant or identifier - substitute if known
            const name = expr.getText();
            const value = this.vars.get(name);
            return value ?? name;
        }

        // Fallback to raw text
        return utils.substituteVars(expr.getText(), this.vars);
    }

    // =============================================================================
    // Refactored Helpers - Validation and Transition Processing
    // =============================================================================

    /**
     * Validate function call has required number of arguments.
     */
    private validateArgs(funcName: string, args: Node[], minArgs: number, lineNumber: number) {
        if (args.length < minArgs || !args.slice(0, minArgs).every((a) => a)) {
            const argWord = minArgs === 1 ? "argument" : "arguments";
            throw new Error(`${funcName}() requires at least ${minArgs} ${argWord} at ${lineNumber}`);
        }
    }

    /**
     * Process a transition-modifying call (reply, goTo, action, journal, etc.)
     * Works with state, single transition, or extend context.
     *
     * Context interface:
     *   - getLastTransition(): returns the last transition or undefined
     *   - addTransition(trans): adds a new transition
     */
    private processTransitionCall(
        funcName: string,
        args: Node[],
        expr: CallExpression,
        context: {
            getLastTransition(): TDTransition | undefined;
            addTransition(trans: TDTransition): void;
        }
    ) {
        const lineNumber = expr.getStartLineNumber();

        switch (funcName) {
            case "reply":
                this.validateArgs("reply", args, 1, lineNumber);
                context.addTransition({
                    reply: this.expressionToText(args[0] as Expression),
                    next: { type: "exit" },
                });
                break;

            case "goTo": {
                this.validateArgs("goTo", args, 1, lineNumber);
                const target = this.resolveStringExpr(args[0] as Expression);
                const lastTrans = context.getLastTransition();
                if (lastTrans) {
                    lastTrans.next = { type: "goto", target };
                } else {
                    context.addTransition({ next: { type: "goto", target } });
                }
                break;
            }

            case "exit": {
                const lastTrans = context.getLastTransition();
                if (lastTrans) {
                    lastTrans.next = { type: "exit" };
                } else {
                    context.addTransition({ next: { type: "exit" } });
                }
                break;
            }

            case "action": {
                this.validateArgs("action", args, 1, lineNumber);
                const actionStr = args.map(a => this.expressionToActionString(a as Expression)).join(" ");
                const lastTrans = context.getLastTransition();
                if (lastTrans) {
                    lastTrans.action = actionStr;
                } else {
                    context.addTransition({ action: actionStr, next: { type: "exit" } });
                }
                break;
            }

            case "journal":
                this.setTransitionField(context, "journal", args, lineNumber, funcName);
                break;

            case "solvedJournal":
                this.setTransitionField(context, "solvedJournal", args, lineNumber, funcName);
                break;

            case "unsolvedJournal":
                this.setTransitionField(context, "unsolvedJournal", args, lineNumber, funcName);
                break;

            case "flags": {
                this.validateArgs("flags", args, 1, lineNumber);
                const lastTrans = context.getLastTransition();
                if (!lastTrans) {
                    throw new Error(`flags() must come after a transition at ${lineNumber}`);
                }
                lastTrans.flags = Number(args[0]!.getText()); // Guaranteed by validateArgs
                break;
            }

            case "extern": {
                this.validateArgs("extern", args, 2, lineNumber);
                const lastTrans = context.getLastTransition();
                if (!lastTrans) {
                    throw new Error(`extern() must come after a transition at ${lineNumber}`);
                }
                lastTrans.next = {
                    type: "extern",
                    filename: utils.stripQuotes(args[0]!.getText()), // Guaranteed by validateArgs
                    target: utils.stripQuotes(args[1]!.getText()), // Guaranteed by validateArgs
                };
                break;
            }

            default:
                return false; // Not handled
        }

        return true; // Handled
    }

    /**
     * Set a text field (journal/solvedJournal/unsolvedJournal) on last transition.
     */
    private setTransitionField(
        context: { getLastTransition(): TDTransition | undefined },
        field: "journal" | "solvedJournal" | "unsolvedJournal",
        args: Node[],
        lineNumber: number,
        funcName: string
    ) {
        this.validateArgs(funcName, args, 1, lineNumber);
        const lastTrans = context.getLastTransition();
        if (!lastTrans) {
            throw new Error(`${funcName}() must come after a transition at ${lineNumber}`);
        }
        lastTrans[field] = this.expressionToText(args[0] as Expression);
    }

    // =============================================================================
    // Patch Operation Helpers
    // =============================================================================

    /**
     * Parse a state list (array of strings/numbers or single value)
     */
    private parseStateList(expr: Expression): (string | number)[] {
        if (Node.isArrayLiteralExpression(expr)) {
            return expr.getElements().map((e) => {
                const text = e.getText();
                // Check if it's a number or string
                if (/^\d+$/.test(text)) {
                    return Number(text);
                }
                return this.resolveStringExpr(e as Expression);
            });
        }

        // Single value
        const text = expr.getText();
        if (/^\d+$/.test(text)) {
            return [Number(text)];
        }
        return [this.resolveStringExpr(expr)];
    }

    /**
     * Parse an array of numbers
     */
    private parseNumberArray(expr: Expression): number[] {
        if (!Node.isArrayLiteralExpression(expr)) {
            throw new Error(`Expected array of numbers at ${expr.getStartLineNumber()}`);
        }

        return expr.getElements().map((e) => Number(e.getText()));
    }

    /**
     * Parse unless option (can be string or regex-like object)
     */
    private parseUnless(expr: Expression): string | undefined {
        // Can be a string or object with { unless: "..." }
        if (Node.isObjectLiteralExpression(expr)) {
            for (const prop of expr.getProperties()) {
                if (Node.isPropertyAssignment(prop) && prop.getName() === "unless") {
                    const value = prop.getInitializer();
                    if (value) {
                        return utils.stripQuotes(value.getText());
                    }
                }
            }
            return undefined;
        }

        return utils.stripQuotes(expr.getText());
    }
}
