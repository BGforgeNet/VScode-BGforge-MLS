/**
 * TD state and transition processing - transforms TypeScript functions
 * into WeiDU D states, chains, and transitions.
 *
 * Extracted from TDParser as standalone functions that receive
 * parser context (vars, funcs) as parameters.
 */

import {
    CallExpression,
    Expression,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    FunctionExpression,
    IfStatement,
    Node,
    Statement,
    SyntaxKind,
} from "ts-morph";
import {
    TDTransitionType,
    TDEpilogueType,
    type TDState,
    type TDTransition,
    type TDChain,
    type TDChainEntry,
    type TDChainEpilogue,
    TDConstructType,
} from "./types";
import * as utils from "../transpiler-utils";
import type { VarsContext } from "../transpiler-utils";
import {
    resolveStringExpr,
    expressionToActionString,
    validateArgs,
    resolveArrayElements,
} from "./parse-helpers";
import {
    expressionToTrigger,
    expressionToText,
} from "./expression-eval";

/** Function info including optional entry trigger from if-wrapping */
export interface FuncInfo {
    func: FunctionDeclaration;
    trigger?: string;
}

/** Context for user function inlining */
export type FuncsContext = Map<string, FuncInfo>;

/** TD say keyword constant */
const SAY_KEYWORD = "say";

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

    // Process body statements
    for (const stmt of body.getStatements()) {
        processStateStatement(stmt, state, vars, funcs);
    }

    return state;
}

/**
 * Process a statement inside a state function.
 */
function processStateStatement(
    stmt: Statement,
    state: TDState,
    vars: VarsContext,
    funcs: FuncsContext
) {
    if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
        const expr = stmt.getExpression();
        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const args = expr.getArguments();

            // Handle say() - specific to states
            if (funcName === "say") {
                validateArgs("say", args, 1, expr.getStartLineNumber());
                state.say.push({ text: expressionToText(args[0] as Expression, vars) });
            }
            // Handle weight() - specific to states
            else if (funcName === "weight") {
                validateArgs("weight", args, 1, expr.getStartLineNumber());
                state.weight = Number(args[0]!.getText()); // Guaranteed by validateArgs
            }
            // Handle transition calls - use unified helper
            else {
                const context = {
                    getLastTransition: () => state.transitions[state.transitions.length - 1],
                    addTransition: (trans: TDTransition) => state.transitions.push(trans),
                };

                const handled = processTransitionCall(funcName, args, expr, context, vars);

                // If not a transition call, check if it's a user function
                if (!handled) {
                    const funcInfo = funcs.get(funcName);
                    if (funcInfo) {
                        inlineUserFunction(expr, funcInfo.func, state, vars, funcs);
                    }
                }
            }
        }
    } else if (stmt.isKind(SyntaxKind.IfStatement)) {
        // if (trigger) { ... } - transition with trigger
        processIfTransition(stmt as IfStatement, state, vars, funcs);
    } else if (stmt.isKind(SyntaxKind.ForOfStatement)) {
        // for (const x of arr) { ... } - unroll
        unrollForOf(stmt as ForOfStatement, vars, (s) => processStateStatement(s, state, vars, funcs));
    } else if (stmt.isKind(SyntaxKind.ForStatement)) {
        // for (let i = 0; ...) { ... } - unroll
        unrollFor(stmt as ForStatement, vars, (s) => processStateStatement(s, state, vars, funcs));
    }
}

/**
 * Process an if statement as a transition with trigger.
 */
function processIfTransition(
    ifStmt: IfStatement,
    state: TDState,
    vars: VarsContext,
    funcs: FuncsContext
) {
    const trigger = expressionToTrigger(ifStmt.getExpression(), vars);
    const thenStmts = utils.getBlockStatements(ifStmt.getThenStatement());

    // Create transition with trigger
    const trans: TDTransition = {
        trigger,
        next: { type: TDTransitionType.Exit }, // Default
    };
    state.transitions.push(trans);

    // Process then block to fill in transition details
    for (const s of thenStmts) {
        processTransitionStatement(s, trans, vars);
    }

    // Handle else branch (creates additional transitions)
    const elseStmt = ifStmt.getElseStatement();
    if (elseStmt) {
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
                processTransitionStatement(s, elseTrans, vars);
            }
        }
    }
}

/**
 * Process a statement that fills in transition details.
 */
function processTransitionStatement(stmt: Statement, trans: TDTransition, vars: VarsContext) {
    if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
        const expr = stmt.getExpression();
        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const args = expr.getArguments();

            // Special handling for reply() in single transition context
            if (funcName === "reply") {
                validateArgs("reply", args, 1, expr.getStartLineNumber());
                trans.reply = expressionToText(args[0] as Expression, vars);
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

            processTransitionCall(funcName, args, expr, context, vars);
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
            lastTrans.flags = Number(args[0]!.getText()); // Guaranteed by validateArgs
            break;
        }

        case "extern": {
            validateArgs("extern", args, 2, lineNumber);
            const lastTrans = context.getLastTransition();
            if (!lastTrans) {
                throw new Error(`extern() must come after a transition at ${lineNumber}`);
            }
            lastTrans.next = {
                type: TDTransitionType.Extern,
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

/**
 * Transform a function to a CHAIN.
 */
function transformFunctionToChain(
    func: FunctionDeclaration | FunctionExpression,
    vars: VarsContext,
    entryTrigger?: string
): TDChain | null {
    const name = func.getName();
    if (!name) return null;

    const body = func.getBody()?.asKind(SyntaxKind.Block);
    if (!body) return null;

    // Get first speaker from first say(speaker, text)
    let filename = "";
    const entries: TDChainEntry[] = [];
    let currentEntry: TDChainEntry | null = null;
    let epilogue: TDChainEpilogue = { type: TDEpilogueType.Exit };

    for (const stmt of body.getStatements()) {
        if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                const funcName = expr.getExpression().getText();
                const args = expr.getArguments();

                if (funcName === SAY_KEYWORD) {
                    currentEntry = processSayInChain(args, expr, currentEntry, entries, vars);
                    // Extract filename from first speaker
                    if (!filename && currentEntry?.speaker) {
                        filename = currentEntry.speaker;
                    }
                } else if (funcName === "action") {
                    // Action after current entry
                    if (args.length === 0) {
                        throw new Error(`action() requires at least 1 argument at ${expr.getStartLineNumber()}`);
                    }
                    if (!currentEntry) {
                        throw new Error(`action() must come after a say() statement at ${expr.getStartLineNumber()}`);
                    }
                    currentEntry.action = args.map(a => a.getText()).join(" ");
                } else if (funcName === "exit") {
                    epilogue = { type: TDEpilogueType.Exit };
                } else if (funcName === "goTo") {
                    if (args.length < 1 || !args[0]) {
                        throw new Error(`goTo() requires at least 1 argument at ${expr.getStartLineNumber()}`);
                    }
                    epilogue = {
                        type: TDEpilogueType.End,
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
            processChainIf(stmt as IfStatement, entries, currentEntry, vars);
        }
    }

    // Push final entry
    if (currentEntry) {
        entries.push(currentEntry);
    }

    return {
        type: TDConstructType.Chain,
        filename,
        label: name,
        trigger: entryTrigger,
        entries,
        epilogue,
    };
}

/**
 * Process say() call within chain context.
 * Handles say(speaker, text) vs say(text) multisay pattern.
 */
function processSayInChain(
    args: Node[],
    expr: CallExpression,
    currentEntry: TDChainEntry | null,
    entries: TDChainEntry[],
    vars: VarsContext,
    options?: { trigger?: string }
): TDChainEntry | null {
    if (args.length >= 2 && args[0] && args[1]) {
        // say(speaker, text) - new entry with speaker
        if (currentEntry) {
            entries.push(currentEntry);
        }
        const newEntry: TDChainEntry = {
            speaker: utils.stripQuotes(args[0].getText()),
            texts: [expressionToText(args[1] as Expression, vars)],
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
        currentEntry.texts.push(expressionToText(args[0] as Expression, vars));
        return currentEntry;
    } else {
        throw new Error(`say() requires at least 1 argument at ${expr.getStartLineNumber()}`);
    }
}

/**
 * Process chain function body statements to extract entries.
 * Handles say(speaker, text), say(text) multisay, and conditionals.
 */
function processChainStatements(
    statements: Statement[],
    entries: TDChainEntry[],
    currentEntry: TDChainEntry | null,
    vars: VarsContext,
    options?: { trigger?: string }
): TDChainEntry | null {
    for (const stmt of statements) {
        if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                const funcName = expr.getExpression().getText();
                const args = expr.getArguments();

                if (funcName === SAY_KEYWORD) {
                    currentEntry = processSayInChain(
                        args,
                        expr,
                        currentEntry,
                        entries,
                        vars,
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
            processChainIf(stmt as IfStatement, entries, currentEntry, vars);
        }
    }

    return currentEntry;
}

/**
 * Process an if statement inside a chain (conditional text).
 */
function processChainIf(
    ifStmt: IfStatement,
    entries: TDChainEntry[],
    _currentEntry: TDChainEntry | null,
    vars: VarsContext
) {
    const trigger = expressionToTrigger(ifStmt.getExpression(), vars);
    const thenStmts = utils.getBlockStatements(ifStmt.getThenStatement());

    const conditionalEntry = processChainStatements(
        thenStmts,
        entries,
        null,
        vars,
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

            const trans: TDTransition = {
                trigger,
                next: { type: TDTransitionType.Exit },
            };

            for (const s of thenStmts) {
                processTransitionStatement(s, trans, vars);
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

    // Save current vars
    const savedVars = new Map(vars);
    paramMap.forEach((value, key) => vars.set(key, value));

    // Process function body
    for (const stmt of body.getStatements()) {
        processStateStatement(stmt, state, vars, funcs);
    }

    // Restore vars - clear and repopulate to maintain same reference
    vars.clear();
    savedVars.forEach((value, key) => vars.set(key, value));
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
    transformFunctionToChain,
    processChainStatements,
    processExtendStatements,
};
