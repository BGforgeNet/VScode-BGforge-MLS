/**
 * TD state and transition processing - transforms TypeScript functions
 * into WeiDU D states and transitions.
 *
 * Supports two syntax forms:
 * - Statement form: reply(); action(); goTo();
 * - Chain form:     reply(text).action(...).goTo(target)
 *
 * Chain parsing extracted to chain-parsing.ts.
 * Chain body processing extracted to chain-processing.ts.
 */

import {
    CallExpression,
    Expression,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    IfStatement,
    Node,
    Statement,
    SyntaxKind,
} from "ts-morph";
import {
    TDTransitionType,
    type TDState,
    type TDTransition,
} from "./types";
import * as utils from "../transpiler-utils";
import type { VarsContext } from "../transpiler-utils";
import {
    resolveStringExpr,
    expressionToActionString,
    validateArgs,
    resolveArrayElements,
    parseBooleanOption,
    parseRequiredNumber,
} from "./parse-helpers";
import {
    expressionToTrigger,
    expressionToText,
} from "./expression-eval";
import {
    isChainExpression,
    parseTransitionChain,
} from "./chain-parsing";

/** Function info including optional entry trigger from if-wrapping */
interface FuncInfo {
    func: FunctionDeclaration;
    trigger?: string;
}

/** Context for user function inlining */
type FuncsContext = Map<string, FuncInfo>;

/** TD say keyword constant */
const SAY_KEYWORD = "say";

/**
 * Merge transition fields from source into target, preserving target's trigger.
 * Used when merging a chain or inlined transition into an existing one
 * that already has its trigger set from the enclosing if block.
 *
 * Note: mutates target in place. This is part of the IR builder pattern used
 * throughout processTransitionStatement/processStateStatement — transitions are
 * created as skeletons and progressively filled. The mutation is contained
 * within a single parse pass and transitions are never shared or read concurrently.
 */
function mergeTransitionFields(target: TDTransition, source: TDTransition): void {
    target.reply = source.reply;
    target.action = source.action;
    target.next = source.next;
    target.journal = source.journal;
    target.solvedJournal = source.solvedJournal;
    target.unsolvedJournal = source.unsolvedJournal;
    if (source.flags !== undefined) target.flags = source.flags;
}

/**
 * Tracks the "pending" transition created by a statement-form `reply()` call.
 * Used so that a subsequent `goTo()/exit()/action()` can modify the correct
 * transition rather than one from an unrelated inlined function or if block.
 */
interface PendingTransition {
    ref: TDTransition | undefined;
}

// =========================================================================
// State Processing
// =========================================================================

/**
 * Transform a function to a STATE.
 */
function transformFunctionToState(
    func: FunctionDeclaration,
    vars: VarsContext,
    funcs: FuncsContext,
    entryTrigger?: string
): TDState | null {
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

    // Track the "pending" reply transition across statements so that
    // goTo()/exit()/action() modify the correct transition, not one from
    // an unrelated inlined function or if block.
    const pending: PendingTransition = { ref: undefined };

    // Process body statements
    for (const stmt of body.getStatements()) {
        processStateStatement(stmt, state, vars, funcs, pending);
    }

    return state;
}

/**
 * Process a statement inside a state function.
 * @param pending Tracks the last transition created by a statement-form reply()
 *   so that goTo()/exit()/action() can modify it. If/inline blocks clear this
 *   reference so subsequent calls don't accidentally modify their transitions.
 */
function processStateStatement(
    stmt: Statement,
    state: TDState,
    vars: VarsContext,
    funcs: FuncsContext,
    pending: PendingTransition = { ref: undefined },
) {
    if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
        const expr = stmt.getExpression();

        // Check for method-chained transition: reply(x).goTo(y), action(x).exit()
        if (isChainExpression(expr)) {
            const trans = parseTransitionChain(expr as CallExpression, vars);
            state.transitions.push(trans);
            // Chain transitions are complete — clear pending so goTo()/exit()
            // after this don't accidentally modify it.
            pending.ref = undefined;
            return;
        }

        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const args = expr.getArguments();

            // Handle say() - specific to states, supports variadic say(t1, t2, t3)
            if (funcName === SAY_KEYWORD) {
                validateArgs(SAY_KEYWORD, args, 1, expr.getStartLineNumber());
                for (const arg of args) {
                    state.say.push({ text: expressionToText(arg as Expression, vars) });
                }
            }
            // Handle weight() - specific to states
            else if (funcName === "weight") {
                validateArgs("weight", args, 1, expr.getStartLineNumber());
                state.weight = parseRequiredNumber(args[0]!, "weight", expr.getStartLineNumber());
            }
            // Handle copyTrans() at state level
            else if (funcName === "copyTrans") {
                validateArgs("copyTrans", args, 2, expr.getStartLineNumber());
                const filename = resolveStringExpr(args[0] as Expression, vars);
                const target = resolveStringExpr(args[1] as Expression, vars);
                state.transitions.push({
                    next: {
                        type: TDTransitionType.CopyTrans,
                        filename,
                        target,
                        safe: parseBooleanOption(args[2], "safe") || undefined,
                    },
                });
            }
            // Handle transition calls - use unified helper.
            // Use pending.ref so goTo()/exit() only modify a transition created
            // by reply() at this scope, not one from an inlined function or if block.
            else {
                const context = {
                    getLastTransition: () => pending.ref,
                    addTransition: (trans: TDTransition) => {
                        pending.ref = trans;
                        state.transitions.push(trans);
                    },
                };

                const handled = processTransitionCall(funcName, args, expr, context, vars);

                // If not a transition call, check if it's a user function.
                // Inlined functions produce complete transitions, so clear pending.
                if (!handled) {
                    const funcInfo = funcs.get(funcName);
                    if (funcInfo) {
                        pending.ref = undefined;
                        inlineUserFunction(expr, funcInfo.func, state, vars, funcs);
                    }
                }
            }
        }
    } else if (stmt.isKind(SyntaxKind.IfStatement)) {
        // if (trigger) { ... } - transition with trigger.
        // Clear pending since if blocks produce complete transitions.
        pending.ref = undefined;
        processIfTransition(stmt as IfStatement, state, vars, funcs);
    } else if (stmt.isKind(SyntaxKind.ForOfStatement)) {
        // for (const x of arr) { ... } - unroll
        unrollForOf(stmt as ForOfStatement, vars, (s) => processStateStatement(s, state, vars, funcs, pending));
    } else if (stmt.isKind(SyntaxKind.ForStatement)) {
        // for (let i = 0; ...) { ... } - unroll
        unrollFor(stmt as ForStatement, vars, (s) => processStateStatement(s, state, vars, funcs, pending));
    }
}

// =========================================================================
// If/Transition Processing
// =========================================================================

/**
 * Process an if statement as a transition with trigger.
 * Also detects state-level wrapping if (where the if wraps the entire body
 * including say()), in which case it becomes a state trigger.
 */
function processIfTransition(
    ifStmt: IfStatement,
    state: TDState,
    vars: VarsContext,
    funcs: FuncsContext
) {
    const trigger = expressionToTrigger(ifStmt.getExpression(), vars);
    const thenStmts = utils.getBlockStatements(ifStmt.getThenStatement());

    // Detect state-level wrapping if: single if wrapping say() + transitions
    // This becomes a state entry trigger, not a transition condition.
    // Pattern: if (cond) { say(...); transitions } with no prior say/transitions
    if (state.say.length === 0 && state.transitions.length === 0 && !ifStmt.getElseStatement()) {
        const hasSay = thenStmts.some(s => {
            if (!s.isKind(SyntaxKind.ExpressionStatement)) return false;
            const e = s.getExpression();
            if (!Node.isCallExpression(e)) return false;
            const name = e.getExpression().getText();
            return name === SAY_KEYWORD;
        });
        if (hasSay) {
            // This is a state-level trigger wrapping the entire body
            state.trigger = trigger;
            const wrappingPending: PendingTransition = { ref: undefined };
            for (const s of thenStmts) {
                processStateStatement(s, state, vars, funcs, wrappingPending);
            }
            return;
        }
    }

    // Check if the then-block has a single chain expression or user function call
    if (thenStmts.length === 1 && thenStmts[0]?.isKind(SyntaxKind.ExpressionStatement)) {
        const innerExpr = thenStmts[0].getExpression();
        if (isChainExpression(innerExpr)) {
            const trans = parseTransitionChain(innerExpr as CallExpression, vars);
            trans.trigger = trigger;
            state.transitions.push(trans);

            // Handle else branch
            processIfElseBranch(ifStmt, state, vars, funcs);
            return;
        }

        // Check for user function call: if (cond) { userFunc(...) }
        // Inline the function body, then apply the trigger to all transitions it added.
        if (Node.isCallExpression(innerExpr)) {
            const funcName = innerExpr.getExpression().getText();
            const funcInfo = funcs.get(funcName);
            if (funcInfo) {
                const prevCount = state.transitions.length;
                inlineUserFunction(innerExpr, funcInfo.func, state, vars, funcs);
                // Apply trigger to all transitions added by the inlined function
                for (let i = prevCount; i < state.transitions.length; i++) {
                    state.transitions[i]!.trigger = trigger;
                }
                processIfElseBranch(ifStmt, state, vars, funcs);
                return;
            }
        }
    }

    // Create transition with trigger
    const trans: TDTransition = {
        trigger,
        next: { type: TDTransitionType.Exit }, // Default
    };
    state.transitions.push(trans);

    // Process then block to fill in transition details
    for (const s of thenStmts) {
        processTransitionStatement(s, trans, vars, state, funcs);
    }

    // Handle else branch (creates additional transitions)
    processIfElseBranch(ifStmt, state, vars, funcs);
}

/**
 * Process else/else-if branches of an if statement.
 */
function processIfElseBranch(
    ifStmt: IfStatement,
    state: TDState,
    vars: VarsContext,
    funcs: FuncsContext
) {
    const elseStmt = ifStmt.getElseStatement();
    if (!elseStmt) return;

    if (Node.isIfStatement(elseStmt)) {
        // else if - recurse
        processIfTransition(elseStmt, state, vars, funcs);
    } else {
        // else block - no trigger transition
        const elseStmts = utils.getBlockStatements(elseStmt);
        const elseTrans: TDTransition = {
            next: { type: TDTransitionType.Exit },
        };
        state.transitions.push(elseTrans);
        for (const s of elseStmts) {
            processTransitionStatement(s, elseTrans, vars, state, funcs);
        }
    }
}

/**
 * Process a statement that fills in transition details.
 * Optionally accepts state/funcs for user function inlining inside if blocks.
 */
function processTransitionStatement(
    stmt: Statement,
    trans: TDTransition,
    vars: VarsContext,
    state?: TDState,
    funcs?: FuncsContext,
) {
    if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
        const expr = stmt.getExpression();

        // Check for chain expression inside if block:
        // if (cond) { reply(x).goTo(y) }
        if (isChainExpression(expr)) {
            const chainTrans = parseTransitionChain(expr as CallExpression, vars);
            mergeTransitionFields(trans, chainTrans);
            return;
        }

        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const args = expr.getArguments();

            // Special handling for reply() in single transition context
            if (funcName === "reply") {
                validateArgs("reply", args, 1, expr.getStartLineNumber());
                trans.reply = expressionToText(args[0] as Expression, vars);
                return;
            }

            // Create context wrapper for single transition.
            // addTransition should never be called here — if blocks already have
            // their transition created by processIfTransition.
            const context = {
                getLastTransition: () => trans,
                addTransition: () => {
                    throw new Error(
                        `Unexpected addTransition() in single-transition context at line ${expr.getStartLineNumber()}`
                    );
                },
            };

            const handled = processTransitionCall(funcName, args, expr, context, vars);

            // If not a transition call, try user function inlining.
            // The inlined body adds transitions to state; we merge the first
            // into the existing transition (preserving trigger) and leave
            // any additional ones on state as siblings.
            if (!handled && state && funcs) {
                const funcInfo = funcs.get(funcName);
                if (funcInfo) {
                    const prevCount = state.transitions.length;
                    inlineUserFunction(expr, funcInfo.func, state, vars, funcs);
                    // Merge the first inlined transition into the current one
                    if (state.transitions.length > prevCount) {
                        const inlined = state.transitions.splice(prevCount, 1)[0]!;
                        mergeTransitionFields(trans, inlined);
                    }
                }
            }
        }
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
function processTransitionCall(
    funcName: string,
    args: Node[],
    expr: CallExpression,
    context: {
        getLastTransition(): TDTransition | undefined;
        addTransition(trans: TDTransition): void;
    },
    vars: VarsContext
) {
    const lineNumber = expr.getStartLineNumber();

    switch (funcName) {
        case "reply":
            validateArgs("reply", args, 1, lineNumber);
            context.addTransition({
                reply: expressionToText(args[0] as Expression, vars),
                next: { type: TDTransitionType.Exit },
            });
            break;

        case "goTo": {
            validateArgs("goTo", args, 1, lineNumber);
            const target = resolveStringExpr(args[0] as Expression, vars);
            const lastTrans = context.getLastTransition();
            if (lastTrans) {
                lastTrans.next = { type: TDTransitionType.Goto, target };
            } else {
                context.addTransition({ next: { type: TDTransitionType.Goto, target } });
            }
            break;
        }

        case "exit": {
            const lastTrans = context.getLastTransition();
            if (lastTrans) {
                lastTrans.next = { type: TDTransitionType.Exit };
            } else {
                context.addTransition({ next: { type: TDTransitionType.Exit } });
            }
            break;
        }

        case "action": {
            validateArgs("action", args, 1, lineNumber);
            const actionStr = args.map(a => expressionToActionString(a as Expression, vars)).join(" ");
            const lastTrans = context.getLastTransition();
            if (lastTrans) {
                lastTrans.action = actionStr;
            } else {
                context.addTransition({ action: actionStr, next: { type: TDTransitionType.Exit } });
            }
            break;
        }

        case "journal":
            setTransitionTextField(context, "journal", args, lineNumber, funcName, vars);
            break;

        case "solvedJournal":
            setTransitionTextField(context, "solvedJournal", args, lineNumber, funcName, vars);
            break;

        case "unsolvedJournal":
            setTransitionTextField(context, "unsolvedJournal", args, lineNumber, funcName, vars);
            break;

        case "flags": {
            validateArgs("flags", args, 1, lineNumber);
            const lastTrans = context.getLastTransition();
            if (!lastTrans) {
                throw new Error(`flags() must come after a transition at ${lineNumber}`);
            }
            lastTrans.flags = parseRequiredNumber(args[0]!, "flags", lineNumber);
            break;
        }

        case "extern": {
            validateArgs("extern", args, 2, lineNumber);
            const externNext: TDTransition["next"] = {
                type: TDTransitionType.Extern,
                filename: utils.stripQuotes(args[0]!.getText()), // Guaranteed by validateArgs
                target: utils.stripQuotes(args[1]!.getText()), // Guaranteed by validateArgs
            };
            const lastTrans = context.getLastTransition();
            if (lastTrans) {
                lastTrans.next = externNext;
            } else {
                context.addTransition({ next: externNext });
            }
            break;
        }

        default:
            return false; // Not handled
    }

    return true; // Handled
}

/**
 * Set a text field (journal/solvedJournal/unsolvedJournal) on last transition.
 * Inlined version that calls expressionToText directly with vars.
 */
function setTransitionTextField(
    context: { getLastTransition(): TDTransition | undefined },
    field: "journal" | "solvedJournal" | "unsolvedJournal",
    args: Node[],
    lineNumber: number,
    funcName: string,
    vars: VarsContext
) {
    validateArgs(funcName, args, 1, lineNumber);
    const lastTrans = context.getLastTransition();
    if (!lastTrans) {
        throw new Error(`${funcName}() must come after a transition at ${lineNumber}`);
    }
    lastTrans[field] = expressionToText(args[0] as Expression, vars);
}

// =========================================================================
// Extend Processing
// =========================================================================

/**
 * Process statements in extend block to build transitions.
 * Similar to processStateStatement but builds transitions directly.
 */
function processExtendStatements(
    statements: Statement[],
    transitions: TDTransition[],
    vars: VarsContext
) {
    for (const stmt of statements) {
        if (stmt.isKind(SyntaxKind.IfStatement)) {
            // if (trigger) { ... } - transition with trigger
            const ifStmt = stmt as IfStatement;
            const trigger = expressionToTrigger(ifStmt.getExpression(), vars);
            const thenStmts = utils.getBlockStatements(ifStmt.getThenStatement());

            // Check if the then-block has a single chain expression
            if (thenStmts.length === 1 && thenStmts[0]?.isKind(SyntaxKind.ExpressionStatement)) {
                const innerExpr = thenStmts[0].getExpression();
                if (isChainExpression(innerExpr)) {
                    const trans = parseTransitionChain(innerExpr as CallExpression, vars);
                    trans.trigger = trigger;
                    transitions.push(trans);
                    continue;
                }
            }

            // Multi-statement then block or non-chain expression
            const trans: TDTransition = {
                trigger,
                next: { type: TDTransitionType.Exit },
            };

            for (const s of thenStmts) {
                processTransitionStatement(s, trans, vars);
            }

            transitions.push(trans);
        } else if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = stmt.getExpression();

            // Check for method-chained transition
            if (isChainExpression(expr)) {
                const trans = parseTransitionChain(expr as CallExpression, vars);
                transitions.push(trans);
                continue;
            }

            // Expression statement - could be reply(), goTo(), action(), etc.
            if (Node.isCallExpression(expr)) {
                const funcName = expr.getExpression().getText();
                const args = expr.getArguments();

                // Create context for transitions array
                const context = {
                    getLastTransition: () => transitions[transitions.length - 1],
                    addTransition: (trans: TDTransition) => transitions.push(trans),
                };

                processTransitionCall(funcName, args, expr, context, vars);
            }
        } else if (stmt.isKind(SyntaxKind.ForOfStatement)) {
            // Unroll loop
            unrollForOf(stmt as ForOfStatement, vars, (s) => {
                processExtendStatements([s], transitions, vars);
            });
        } else if (stmt.isKind(SyntaxKind.ForStatement)) {
            // Unroll loop
            unrollFor(stmt as ForStatement, vars, (s) => {
                processExtendStatements([s], transitions, vars);
            });
        }
    }
}

// =========================================================================
// User Function Inlining
// =========================================================================

/**
 * Inline a user function call into a state.
 */
function inlineUserFunction(
    call: CallExpression,
    func: FunctionDeclaration,
    state: TDState,
    vars: VarsContext,
    funcs: FuncsContext
) {
    const body = func.getBody()?.asKind(SyntaxKind.Block);
    if (!body) return;

    const paramMap = utils.buildParamMap(call, func, vars);

    // Create scoped vars with params overlaid on current scope.
    // We mutate `vars` in-place because downstream code (loop unrolling)
    // holds a reference to it. Save and restore around the inlined body.
    const savedVars = new Map(vars);
    for (const [key, value] of paramMap) {
        vars.set(key, value);
    }

    // Process function body with its own pending scope so reply()/goTo()
    // within the inlined body track correctly and don't leak to the caller.
    const innerPending: PendingTransition = { ref: undefined };
    for (const stmt of body.getStatements()) {
        processStateStatement(stmt, state, vars, funcs, innerPending);
    }

    // Restore vars - clear and repopulate to maintain same reference
    vars.clear();
    for (const [key, value] of savedVars) {
        vars.set(key, value);
    }
}

// =========================================================================
// Loop Unrolling
// =========================================================================

/**
 * Unroll a for-of loop.
 * Supports both simple variables and array destructuring patterns.
 */
function unrollForOf(
    forOf: ForOfStatement,
    vars: VarsContext,
    onStatement: (s: Statement) => void
) {
    const arrayExpr = forOf.getExpression();
    const elements = resolveArrayElements(arrayExpr, vars);

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
                    vars.set(name, values[i] ?? "undefined");
                }
            }

            for (const stmt of bodyStmts) {
                onStatement(stmt);
            }
        }

        // Clean up all destructured variables
        for (const name of bindingNames) {
            if (name) {
                vars.delete(name);
            }
        }
    } else {
        // Simple variable: const item of array
        const loopVar = initializer.getText().replace(/^const\s+/, "").replace(/^let\s+/, "");

        for (const element of elements) {
            vars.set(loopVar, element);
            for (const stmt of bodyStmts) {
                onStatement(stmt);
            }
        }

        vars.delete(loopVar);
    }
}

/**
 * Unroll a for loop.
 */
function unrollFor(
    forStmt: ForStatement,
    vars: VarsContext,
    onStatement: (s: Statement) => void
) {
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
    const initValue = utils.evaluateNumeric(firstDecl.getInitializer(), vars);
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

    while (utils.evaluateCondition(condition.getText(), loopVar, current, vars)) {
        if (iterations >= utils.MAX_LOOP_ITERATIONS) {
            throw new Error(`Loop exceeded ${utils.MAX_LOOP_ITERATIONS} iterations`);
        }

        vars.set(loopVar, current.toString());
        for (const stmt of bodyStmts) {
            onStatement(stmt);
        }

        current += increment;
        iterations++;
    }

    vars.delete(loopVar);
}

export {
    transformFunctionToState,
    processExtendStatements,
    processStateStatement,
    type FuncInfo,
    type FuncsContext,
};
