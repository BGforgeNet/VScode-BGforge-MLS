/**
 * TD Parser - converts TypeScript AST to TD IR
 *
 * Walks the TypeScript AST (via ts-morph) and produces TDScript IR
 * for emission to WeiDU D format.
 */

import {
    ArrayBindingPattern,
    ArrayLiteralExpression,
    Block,
    CallExpression,
    Expression,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
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
} from "./types";

/** Context for variable substitution during compile-time evaluation */
type VarsContext = Map<string, string>;

/** Function info including optional entry trigger from if-wrapping */
interface FuncInfo {
    func: FunctionDeclaration;
    trigger?: string;
}

/** Context for user function inlining */
type FuncsContext = Map<string, FuncInfo>;

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

        // Handle if-wrapped function (state with entry trigger)
        if (stmt.isKind(SyntaxKind.IfStatement)) {
            return this.transformIfWrappedFunction(stmt as IfStatement);
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
     * Transform an if-wrapped function declaration.
     * Pattern: if (trigger()) { function stateName() { ... } }
     */
    private transformIfWrappedFunction(ifStmt: IfStatement): TDConstruct[] | null {
        const thenStmt = ifStmt.getThenStatement();
        const statements = this.getBlockStatements(thenStmt);

        // Look for function declarations inside
        const results: TDConstruct[] = [];
        for (const s of statements) {
            if (s.isKind(SyntaxKind.FunctionDeclaration)) {
                const func = s as FunctionDeclaration;
                const trigger = this.expressionToTrigger(ifStmt.getExpression());
                const construct = this.transformFunctionToConstruct(func, trigger);
                if (construct) {
                    results.push(construct);
                }
            }
        }

        return results.length > 0 ? results : null;
    }

    /**
     * Transform a top-level call expression.
     */
    private transformTopLevelCall(call: CallExpression): TDConstruct[] | null {
        const funcName = call.getExpression().getText();

        switch (funcName) {
            case "dialog":
                return this.transformDialog(call);
            case "append":
                return this.transformAppend(call);
            case "extendTop":
            case "extendBottom":
                return this.transformExtend(call, funcName === "extendTop");
            default:
                return null;
        }
    }

    /**
     * Transform dialog(filename, [states]) to BEGIN and/or CHAINs.
     * Functions with say(speaker, text) are emitted as CHAINs.
     * Functions with say(text) are emitted as states in BEGIN.
     */
    private transformDialog(call: CallExpression): TDConstruct[] | null {
        const args = call.getArguments();
        if (args.length < 2) {
            throw new Error(`dialog() requires 2 arguments (filename, states) at ${call.getStartLineNumber()}`);
        }

        const filenameArg = args[0];
        const statesArg = args[1];

        if (!filenameArg || !statesArg) {
            throw new Error(`dialog() requires 2 arguments (filename, states) at ${call.getStartLineNumber()}`);
        }

        const filename = this.resolveStringExpr(filenameArg as Expression);

        if (!Node.isArrayLiteralExpression(statesArg)) {
            throw new Error(`dialog() second argument must be an array of state functions at ${call.getStartLineNumber()}`);
        }

        const constructs: TDConstruct[] = [];
        const states: TDState[] = [];

        for (const element of (statesArg as ArrayLiteralExpression).getElements()) {
            if (Node.isIdentifier(element)) {
                const funcName = element.getText();
                const funcInfo = this.funcs.get(funcName);
                if (!funcInfo) {
                    throw new Error(`Function "${funcName}" not found in dialog() at ${element.getStartLineNumber()}`);
                }
                const body = funcInfo.func.getBody()?.asKind(SyntaxKind.Block);
                if (body && this.isChainFunction(body)) {
                    // Emit as CHAIN (standalone construct)
                    const chain = this.transformFunctionToChain(funcInfo.func, funcInfo.trigger);
                    if (chain) {
                        // Set the filename from dialog() for the chain
                        chain.filename = filename;
                        constructs.push(chain);
                    }
                } else {
                    // Emit as state in BEGIN (with entry trigger if if-wrapped)
                    const state = this.transformFunctionToState(funcInfo.func, funcInfo.trigger);
                    if (state) {
                        states.push(state);
                    }
                }
            }
        }

        // Add BEGIN if there are any states
        if (states.length > 0) {
            const begin: TDBegin = {
                type: "begin",
                filename,
                states,
            };
            constructs.unshift(begin);
        }

        return constructs.length > 0 ? constructs : null;
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
     * Transform a function declaration to a TD construct.
     * Only CHAINs can be top-level constructs; states must be inside BEGIN/APPEND.
     */
    private transformFunctionToConstruct(func: FunctionDeclaration, entryTrigger?: string): TDConstruct | null {
        const body = func.getBody()?.asKind(SyntaxKind.Block);
        if (!body) return null;

        // Check if this is a CHAIN (has say(speaker, text) pattern)
        if (this.isChainFunction(body)) {
            return this.transformFunctionToChain(func, entryTrigger);
        }

        // States can't be top-level constructs - they need to be in BEGIN/APPEND
        // Standalone if-wrapped functions without dialog() are not supported
        return null;
    }

    /**
     * Check if a function body represents a CHAIN (has speaker arguments in say()).
     */
    private isChainFunction(body: Block): boolean {
        for (const stmt of body.getStatements()) {
            if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
                const expr = stmt.getExpression();
                if (Node.isCallExpression(expr)) {
                    const funcName = expr.getExpression().getText();
                    if (funcName === "say" && expr.getArguments().length >= 2) {
                        return true;
                    }
                }
            }
        }
        return false;
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
                    state.weight = Number(args[0].getText());
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
        const thenStmts = this.getBlockStatements(ifStmt.getThenStatement());

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
                const elseStmts = this.getBlockStatements(elseStmt);
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
    private transformFunctionToChain(func: FunctionDeclaration, entryTrigger?: string): TDChain | null {
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

                    if (funcName === "say") {
                        if (args.length >= 2 && args[0] && args[1]) {
                            // say(speaker, text) - new entry with speaker
                            const speaker = this.stripQuotes(args[0].getText());
                            if (!filename) filename = speaker;

                            if (currentEntry) {
                                entries.push(currentEntry);
                            }
                            currentEntry = {
                                speaker,
                                texts: [this.expressionToText(args[1] as Expression)],
                            };
                        } else if (args.length >= 1 && args[0]) {
                            // say(text) - continuation of current speaker (multisay)
                            if (!currentEntry) {
                                throw new Error(`say(text) without speaker - must use say(speaker, text) first at ${expr.getStartLineNumber()}`);
                            }
                            currentEntry.texts.push(this.expressionToText(args[0] as Expression));
                        } else {
                            throw new Error(`say() requires at least 1 argument at ${expr.getStartLineNumber()}`);
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
                        epilogue = { type: "exit" };
                    } else if (funcName === "goto") {
                        if (args.length < 1 || !args[0]) {
                            throw new Error(`goto() requires at least 1 argument at ${expr.getStartLineNumber()}`);
                        }
                        epilogue = {
                            type: "end",
                            filename,
                            target: args[0].getText(),
                        };
                    }
                }
            } else if (stmt.isKind(SyntaxKind.IfStatement)) {
                // Conditional in chain
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
        const thenStmts = this.getBlockStatements(ifStmt.getThenStatement());

        for (const s of thenStmts) {
            if (s.isKind(SyntaxKind.ExpressionStatement)) {
                const expr = s.getExpression();
                if (Node.isCallExpression(expr)) {
                    const funcName = expr.getExpression().getText();
                    const args = expr.getArguments();

                    if (funcName === "say" && args.length >= 2 && args[0] && args[1]) {
                        // Conditional say with speaker
                        const entry: TDChainEntry = {
                            speaker: this.stripQuotes(args[0].getText()),
                            trigger,
                            texts: [this.expressionToText(args[1] as Expression)],
                        };
                        entries.push(entry);
                    }
                }
            }
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
                const thenStmts = this.getBlockStatements(ifStmt.getThenStatement());

                const trans: TDTransition = {
                    trigger,
                    next: { type: "exit" },
                };

                for (const s of thenStmts) {
                    this.processTransitionStatement(s, trans);
                }

                transitions.push(trans);
            } else if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
                // Expression statement - could be reply(), goto(), action(), etc.
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

        const paramMap = this.buildParamMap(call, func);

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

        return this.substituteVars(expr.getText());
    }

    /**
     * Convert an expression to TDText.
     */
    private expressionToText(expr: Expression): TDText {
        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const args = expr.getArguments();

            if (funcName === "tra" && args.length >= 1 && args[0]) {
                // Substitute variables in argument (for loop unrolling)
                const argText = this.substituteVars(args[0].getText());
                return {
                    type: "tra",
                    value: Number(argText),
                };
            }

            if (funcName === "tlk" && args.length >= 1 && args[0]) {
                const argText = this.substituteVars(args[0].getText());
                return {
                    type: "tlk",
                    value: Number(argText),
                };
            }
        }

        if (Node.isStringLiteral(expr)) {
            return {
                type: "literal",
                value: this.stripQuotes(expr.getText()),
            };
        }

        // Fallback to literal
        return {
            type: "literal",
            value: this.substituteVars(expr.getText()),
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
        const bodyStmts = this.getBlockStatements(forOf.getStatement());

        // Check for array destructuring pattern: const [a, b, c] of array
        const bindingPattern = initializer.getDescendantsOfKind(SyntaxKind.ArrayBindingPattern)[0];

        if (bindingPattern) {
            // Destructuring: extract binding element names
            const bindingNames = this.getBindingNames(bindingPattern);

            for (const element of elements) {
                const values = this.parseArrayLiteral(element);
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
     * Extract binding element names from an array binding pattern.
     * E.g., [a, b, c] -> ["a", "b", "c"]
     */
    private getBindingNames(pattern: ArrayBindingPattern): (string | null)[] {
        return pattern.getElements().map((el) => {
            if (el.isKind(SyntaxKind.BindingElement)) {
                return el.getName();
            }
            // OmittedExpression (skipped element, e.g., [a, , c])
            return null;
        });
    }

    /**
     * Parse a string representation of an array literal into individual values.
     * E.g., '["foo", 123, "bar"]' -> ['"foo"', '123', '"bar"']
     */
    private parseArrayLiteral(text: string): string[] | null {
        const trimmed = text.trim();
        if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
            return null;
        }

        const inner = trimmed.slice(1, -1).trim();
        if (!inner) {
            return [];
        }

        // Parse respecting quoted strings and nested brackets
        const values: string[] = [];
        let current = "";
        let depth = 0;
        let inString = false;
        let stringChar = "";

        for (let i = 0; i < inner.length; i++) {
            const char = inner[i]!;
            const prevChar = inner[i - 1];

            if (inString) {
                current += char;
                if (char === stringChar && prevChar !== "\\") {
                    inString = false;
                }
            } else if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                current += char;
            } else if (char === "[") {
                depth++;
                current += char;
            } else if (char === "]") {
                depth--;
                current += char;
            } else if (char === "," && depth === 0) {
                values.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            values.push(current.trim());
        }

        return values;
    }

    /** Maximum iterations to prevent infinite loops */
    private static readonly MAX_ITERATIONS = 1000;

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
        const initValue = this.evaluateNumeric(firstDecl.getInitializer());
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

        const increment = this.parseIncrement(incrementor.getText());
        const bodyStmts = this.getBlockStatements(forStmt.getStatement());

        let current = initValue;
        let iterations = 0;

        while (this.evaluateCondition(condition.getText(), loopVar, current)) {
            if (iterations >= TDParser.MAX_ITERATIONS) {
                throw new Error(`Loop exceeded ${TDParser.MAX_ITERATIONS} iterations`);
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

    private getBlockStatements(stmt: Statement): Statement[] {
        if (stmt.isKind(SyntaxKind.Block)) {
            return (stmt as Block).getStatements();
        }
        return [stmt];
    }

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

    private evaluateNumeric(expr: Expression | undefined): number | undefined {
        if (!expr) return undefined;
        const text = this.substituteVars(expr.getText());
        const num = Number(text);
        return isNaN(num) ? undefined : num;
    }

    private parseIncrement(text: string): number {
        if (text.includes("++")) return 1;
        if (text.includes("--")) return -1;
        if (text.includes("+=")) return Number(text.split("+=")[1]) || 1;
        if (text.includes("-=")) return -(Number(text.split("-=")[1]) || 1);
        return 1;
    }

    private evaluateCondition(condition: string, loopVar: string, value: number): boolean {
        let substituted = condition.replace(new RegExp(`\\b${loopVar}\\b`, "g"), value.toString());
        substituted = this.substituteVars(substituted);
        try {
            const fn = new Function(`return (${substituted});`);
            return fn();
        } catch {
            throw new Error(`Cannot evaluate condition: ${condition}`);
        }
    }

    private resolveArrayElements(expr: Expression): string[] | null {
        if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
            return (expr as ArrayLiteralExpression)
                .getElements()
                .map(e => this.substituteVars(e.getText()));
        }

        if (expr.isKind(SyntaxKind.Identifier)) {
            const name = expr.getText();
            const value = this.vars.get(name);
            if (value && value.startsWith("[") && value.endsWith("]")) {
                // Use parseArrayLiteral to handle nested arrays correctly
                return this.parseArrayLiteral(value);
            }
        }

        return null;
    }

    private substituteVars(text: string): string {
        let result = text;
        this.vars.forEach((value, key) => {
            result = result.replace(new RegExp(`\\b${key}\\b`, "g"), value);
        });
        return result;
    }

    private buildParamMap(call: CallExpression, func: FunctionDeclaration): Map<string, string> {
        const params = func.getParameters();
        const args = call.getArguments();
        const map = new Map<string, string>();

        params.forEach((param, i) => {
            const name = param.getName();
            const arg = args[i];
            const value = arg?.getText() || param.getInitializer()?.getText() || "";
            map.set(name, this.substituteVars(value));
        });

        return map;
    }

    private stripQuotes(text: string): string {
        return text.replace(/^["'`]|["'`]$/g, "");
    }

    /**
     * Resolve an expression to its string value.
     * Handles string literals and variable references.
     */
    private resolveStringExpr(expr: Expression): string {
        if (Node.isStringLiteral(expr)) {
            return this.stripQuotes(expr.getText());
        }
        if (Node.isIdentifier(expr)) {
            const name = expr.getText();
            const value = this.vars.get(name);
            if (value !== undefined) {
                return this.stripQuotes(value);
            }
            return name;
        }
        return this.stripQuotes(expr.getText());
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
        return this.substituteVars(expr.getText());
    }

    // =============================================================================
    // Refactored Helpers - Validation and Transition Processing
    // =============================================================================

    /**
     * Validate function call has required number of arguments.
     */
    private validateArgs(funcName: string, args: any[], minArgs: number, lineNumber: number) {
        if (args.length < minArgs || !args.slice(0, minArgs).every(a => a)) {
            const argWord = minArgs === 1 ? "argument" : "arguments";
            throw new Error(`${funcName}() requires at least ${minArgs} ${argWord} at ${lineNumber}`);
        }
    }

    /**
     * Process a transition-modifying call (reply, goto, action, journal, etc.)
     * Works with state, single transition, or extend context.
     *
     * Context interface:
     *   - getLastTransition(): returns the last transition or undefined
     *   - addTransition(trans): adds a new transition
     */
    private processTransitionCall(
        funcName: string,
        args: any[],
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

            case "goto": {
                this.validateArgs("goto", args, 1, lineNumber);
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
                lastTrans.flags = Number(args[0].getText());
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
                    filename: this.stripQuotes(args[0].getText()),
                    target: this.stripQuotes(args[1].getText()),
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
        args: any[],
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
}
