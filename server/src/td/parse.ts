/**
 * TD Parser - converts TypeScript AST to TD IR
 *
 * Walks the TypeScript AST (via ts-morph) and produces TDScript IR
 * for emission to WeiDU D format.
 *
 * Implementation is split across modules:
 * - parse-helpers.ts: utility functions (evaluate, resolve, validate, parse)
 * - expression-eval.ts: expression to trigger/action/text conversion
 * - chain-parsing.ts: method chain transition parsing (reply().action().goTo())
 * - chain-processing.ts: chain body processing (from/fromWhen/say)
 * - state-transitions.ts: state/transition/extend processing, loop unrolling
 * - state-resolution.ts: transitive state collection and orphan detection
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
    type TDReplaceStates,
} from "./types";
import type { VarsContext } from "../transpiler-utils";
import { evaluateExpression, resolveStringExpr, parseBooleanOption, parseRequiredNumber } from "./parse-helpers";
import { expressionToTrigger } from "./expression-eval";
import {
    transformFunctionToState,
    processExtendStatements,
    processStateStatement,
    type FuncsContext,
} from "./state-transitions";
import {
    transformFunctionToChain,
    processChainStatements,
    processChainBody,
} from "./chain-processing";
import { resolveTransitiveStates, collectOrphanWarnings } from "./state-resolution";
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
    APPEND_EARLY: "appendEarly",
    REPLACE_STATE: "replaceState",
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
    /** Functions used as direct callees (helpers), not state functions. */
    private calledAsFunction = new Set<string>();
    private sourceFile!: SourceFile;

    /**
     * Parse a bundled TypeScript source file to TD IR.
     */
    parse(sourceFile: SourceFile): TDScript {
        this.sourceFile = sourceFile;
        this.vars.clear();
        this.funcs.clear();
        this.calledAsFunction.clear();

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

        // Pass 3: Transitively collect goTo targets not explicitly listed
        resolveTransitiveStates(constructs, this.funcs, this.vars);

        // Pass 4: Warn about orphan state functions
        const warnings = collectOrphanWarnings(constructs, this.funcs, this.calledAsFunction);

        return {
            sourceFile: sourceFile.getFilePath(),
            constructs,
            warnings: warnings.length > 0 ? warnings : undefined,
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

        // Identify functions used as direct callees (helper functions, not states).
        // e.g. helper() → "helper" is callee, so it's a helper function.
        // goTo(myState) → "goTo" is callee, "myState" is an argument, not added.
        for (const call of this.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
            const callee = call.getExpression();
            if (Node.isIdentifier(callee)) {
                const name = callee.getText();
                if (this.funcs.has(name)) {
                    this.calledAsFunction.add(name);
                }
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
                return this.transformAppend(call, false);
            case TD_KEYWORDS.APPEND_EARLY:
                return this.transformAppend(call, true);
            case TD_KEYWORDS.REPLACE_STATE:
                return this.transformReplaceState(call);
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
     * Transform chain() to CHAIN construct.
     * Signatures:
     *   chain(function name() { ... })                    - old form
     *   chain(trigger, function name() { ... })           - old form with trigger
     *   chain(dialog, label, body)                        - new form
     *   chain(entryTrigger, dialog, label, body, options) - new form with trigger
     */
    private transformChainCall(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 1) {
            throw new Error(`chain() requires at least 1 argument at ${call.getStartLineNumber()}`);
        }

        // Detect new form: chain(dialog, label, body) or chain(trigger, dialog, label, body)
        // New form has an arrow function as the body argument (3rd or 4th).
        // Old form has a function expression or identifier as 1st or 2nd argument.
        const isNewForm = (args.length >= 3 && Node.isArrowFunction(args[2])) ||
                          (args.length >= 4 && Node.isArrowFunction(args[3]));

        if (isNewForm) {
            return this.transformChainNewForm(call);
        }

        // Old form: chain(function) or chain(trigger, function)
        let trigger: string | undefined;
        let funcArg: Node;

        if (args.length === 1) {
            funcArg = args[0]!;
        } else {
            trigger = expressionToTrigger(args[0] as Expression, this.vars);
            funcArg = args[1]!;
        }

        if (Node.isIdentifier(funcArg)) {
            const funcName = funcArg.getText();
            const funcInfo = this.funcs.get(funcName);
            if (!funcInfo) {
                throw new Error(`Function "${funcName}" not found in chain() at ${funcArg.getStartLineNumber()}`);
            }
            const chain = transformFunctionToChain(funcInfo.func, this.vars, trigger);
            return chain ? [chain] : null;
        } else if (Node.isFunctionExpression(funcArg)) {
            const chain = transformFunctionToChain(funcArg as FunctionExpression, this.vars, trigger);
            return chain ? [chain] : null;
        }

        throw new Error(`chain() argument must be a function reference or expression at ${call.getStartLineNumber()}`);
    }

    /**
     * Transform new-form chain: chain(dialog, label, body) or chain(trigger, dialog, label, body).
     * The body is an arrow function with from()/fromWhen()/say() calls.
     */
    private transformChainNewForm(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        let trigger: string | undefined;
        let dialog: string;
        let label: string;
        let bodyArg: Expression;

        if (Node.isArrowFunction(args[2])) {
            // chain(dialog, label, body)
            dialog = resolveStringExpr(args[0] as Expression, this.vars);
            label = resolveStringExpr(args[1] as Expression, this.vars);
            bodyArg = args[2] as Expression;
        } else if (args[3] && Node.isArrowFunction(args[3])) {
            // chain(trigger, dialog, label, body)
            trigger = expressionToTrigger(args[0] as Expression, this.vars);
            dialog = resolveStringExpr(args[1] as Expression, this.vars);
            label = resolveStringExpr(args[2] as Expression, this.vars);
            bodyArg = args[3] as Expression;
        } else {
            throw new Error(`chain() body must be an arrow function at ${call.getStartLineNumber()}`);
        }

        // Parse body to extract chain entries
        const entries: TDChainEntry[] = [];
        let epilogue: TDChainEpilogue = { type: TDEpilogueType.Exit };

        if (Node.isArrowFunction(bodyArg)) {
            const body = bodyArg.getBody();
            if (Node.isBlock(body)) {
                const result = processChainBody(
                    (body as Block).getStatements(), dialog, this.vars
                );
                entries.push(...result.entries);
                epilogue = result.epilogue;
            }
        }

        return [{
            type: TDConstructType.Chain,
            filename: dialog,
            label,
            trigger,
            entries,
            epilogue,
        }];
    }

    /**
     * Transform begin(filename, [states]) or begin(filename, s1, s2, ...) to BEGIN.
     * Supports array form, rest-args form, and object form.
     */
    private transformBegin(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 2) {
            throw new Error(`begin() requires at least 2 arguments at ${call.getStartLineNumber()}`);
        }

        const filenameArg = args[0];
        if (!filenameArg) {
            throw new Error(`begin() requires a filename at ${call.getStartLineNumber()}`);
        }

        const filename = resolveStringExpr(filenameArg as Expression, this.vars);
        const states: TDState[] = [];

        // Check for options as last argument (distinguished from object-form states)
        const lastArg = args[args.length - 1];
        const hasOptionsArg = lastArg && Node.isObjectLiteralExpression(lastArg) &&
            !this.isObjectWithMethods(lastArg);
        const nonPausing = hasOptionsArg ? parseBooleanOption(lastArg, "nonPausing") || undefined : undefined;
        const stateArgs = hasOptionsArg ? args.slice(1, -1) : args.slice(1);

        // Process state arguments
        this.collectStatesFromArgs(stateArgs, states, "begin");

        if (states.length === 0) {
            return null;
        }

        const begin: TDBegin = {
            type: TDConstructType.Begin,
            filename,
            nonPausing,
            states,
        };

        return [begin];
    }

    /**
     * Transform append/appendEarly to APPEND construct.
     * Supports array form, rest-args form, single function, and object form.
     */
    private transformAppend(call: CallExpression, isEarly: boolean): TDConstruct[] | null {
        const funcName = isEarly ? "appendEarly" : "append";
        const args = call.getArguments();
        if (args.length < 2) {
            throw new Error(`${funcName}() requires at least 2 arguments at ${call.getStartLineNumber()}`);
        }

        const filenameArg = args[0];
        if (!filenameArg) {
            throw new Error(`${funcName}() requires a filename at ${call.getStartLineNumber()}`);
        }

        const filename = resolveStringExpr(filenameArg as Expression, this.vars);
        const states: TDState[] = [];

        // Check for options as last argument (distinguished from object-form states)
        const lastArg = args[args.length - 1];
        const hasOptionsArg = lastArg && Node.isObjectLiteralExpression(lastArg) &&
            !this.isObjectWithMethods(lastArg);
        const ifFileExists = hasOptionsArg ? parseBooleanOption(lastArg, "ifFileExists") || undefined : undefined;
        const stateArgs = hasOptionsArg ? args.slice(1, -1) : args.slice(1);

        // Process state arguments
        this.collectStatesFromArgs(stateArgs, states, funcName);

        const append: TDAppend = {
            type: TDConstructType.Append,
            filename,
            ifFileExists,
            early: isEarly || undefined,
            states,
        };

        return [append];
    }

    /**
     * Transform replaceState(dialog, stateNum, body) to a patch that replaces a state.
     */
    private transformReplaceState(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 3) {
            throw new Error(`replaceState() requires 3 arguments (dialog, stateNum, body) at ${call.getStartLineNumber()}`);
        }

        const filename = resolveStringExpr(args[0] as Expression, this.vars);
        const stateNum = parseRequiredNumber(args[1]!, "replaceState stateNum", call.getStartLineNumber());
        const bodyArg = args[2];

        if (!Node.isArrowFunction(bodyArg) && !Node.isFunctionExpression(bodyArg)) {
            throw new Error(`replaceState() body must be a function at ${call.getStartLineNumber()}`);
        }

        // Create a temporary FunctionDeclaration-like for parsing
        const body = bodyArg.getBody();
        if (!Node.isBlock(body)) {
            throw new Error(`replaceState() body must be a block at ${call.getStartLineNumber()}`);
        }

        // Build state from body statements
        const state: TDState = {
            label: stateNum.toString(),
            say: [],
            transitions: [],
        };

        for (const s of (body as Block).getStatements()) {
            processStateStatement(s, state, this.vars, this.funcs);
        }

        const operation: TDReplaceStates = {
            op: TDPatchOp.ReplaceStates,
            filename,
            replacements: new Map([[stateNum, state]]),
        };

        return [{ type: TDConstructType.Patch, operation }];
    }

    /**
     * Check if an object literal has method members (used to distinguish
     * object-form states from options objects).
     */
    private isObjectWithMethods(node: Node): boolean {
        if (!Node.isObjectLiteralExpression(node)) return false;
        return node.getProperties().some(p =>
            Node.isMethodDeclaration(p) || Node.isFunctionExpression(p)
        );
    }

    /**
     * Collect states from argument list.
     * Supports: array literal, rest-args (identifiers), object-with-methods form,
     * and inline state() calls.
     */
    private collectStatesFromArgs(
        stateArgs: Node[],
        states: TDState[],
        funcName: string
    ) {
        for (const arg of stateArgs) {
            if (Node.isArrayLiteralExpression(arg)) {
                // Array of state references: [s1, s2, state("label", () => {...})]
                for (const element of (arg as ArrayLiteralExpression).getElements()) {
                    if (Node.isCallExpression(element) && element.getExpression().getText() === "state") {
                        this.collectInlineState(element, states);
                    } else {
                        this.collectSingleStateRef(element, states, funcName);
                    }
                }
            } else if (Node.isCallExpression(arg) && arg.getExpression().getText() === "state") {
                // Inline state: begin("DLG", state("label", () => {...}))
                this.collectInlineState(arg, states);
            } else if (Node.isIdentifier(arg)) {
                // Rest-args form: begin("DLG", s1, s2, s3)
                this.collectSingleStateRef(arg, states, funcName);
            } else if (Node.isObjectLiteralExpression(arg)) {
                // Object form: begin("DLG", { s1() {...}, s2() {...} })
                for (const prop of arg.getProperties()) {
                    if (Node.isMethodDeclaration(prop)) {
                        const name = prop.getName();
                        const body = prop.getBody();
                        if (!body || !Node.isBlock(body)) continue;

                        const state: TDState = {
                            label: name,
                            say: [],
                            transitions: [],
                        };

                        for (const s of (body as Block).getStatements()) {
                            processStateStatement(s, state, this.vars, this.funcs);
                        }

                        states.push(state);
                    }
                }
            }
        }
    }

    /**
     * Process an inline state() call expression: state("label", () => { ... })
     */
    private collectInlineState(call: CallExpression, states: TDState[]) {
        const args = call.getArguments();
        if (args.length < 2) {
            throw new Error(`state() requires 2 arguments (label, body) at ${call.getStartLineNumber()}`);
        }

        const label = resolveStringExpr(args[0] as Expression, this.vars);
        const bodyArg = args[1];

        if (!Node.isArrowFunction(bodyArg) && !Node.isFunctionExpression(bodyArg)) {
            throw new Error(`state() body must be a function at ${call.getStartLineNumber()}`);
        }

        const body = bodyArg.getBody();
        if (!Node.isBlock(body)) {
            throw new Error(`state() body must be a block at ${call.getStartLineNumber()}`);
        }

        const state: TDState = {
            label,
            say: [],
            transitions: [],
        };

        for (const s of (body as Block).getStatements()) {
            processStateStatement(s, state, this.vars, this.funcs);
        }

        states.push(state);
    }

    /**
     * Resolve a single state reference (identifier) to a TDState and push it.
     */
    private collectSingleStateRef(element: Node, states: TDState[], funcName: string) {
        if (Node.isIdentifier(element)) {
            const refName = element.getText();
            const funcInfo = this.funcs.get(refName);
            if (!funcInfo) {
                throw new Error(`Function "${refName}" not found in ${funcName}() at ${element.getStartLineNumber()}`);
            }
            const state = transformFunctionToState(funcInfo.func, this.vars, this.funcs, funcInfo.trigger);
            if (state) {
                states.push(state);
            }
        }
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
        const safe = type === TDConstructType.InterjectCopyTrans && parseBooleanOption(args[4], "safe");

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
