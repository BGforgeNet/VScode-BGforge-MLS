/**
 * TBAF Transformer
 *
 * Single-pass AST to BAF IR transformer.
 * Replaces the iterative multi-transform approach.
 */

import {
    ArrayLiteralExpression,
    Block,
    CallExpression,
    Expression,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    IfStatement,
    Node,
    PrefixUnaryExpression,
    Project,
    ReturnStatement,
    SourceFile,
    SpreadElement,
    Statement,
    SyntaxKind,
} from "ts-morph";
import { BAFAction, BAFBlock, BAFCondition, BAFOrGroup, BAFScript, BAFTopCondition } from "./ir";

/** Context for variable substitution */
type VarsContext = Map<string, string>;

/** Context for function inlining */
type FuncsContext = Map<string, FunctionDeclaration>;

export class TBAFTransformer {
    private vars: VarsContext = new Map();
    private funcs: FuncsContext = new Map();
    private blocks: BAFBlock[] = [];
    private sourceFile!: SourceFile;

    /**
     * Transform a bundled TypeScript source file to BAF IR.
     */
    transform(sourceFile: SourceFile): BAFScript {
        this.sourceFile = sourceFile;
        this.blocks = [];
        this.vars.clear();
        this.funcs.clear();

        // Pass 1: Collect declarations (read-only)
        this.collectDeclarations();

        // Pass 2: Transform top-level statements to BAF blocks
        for (const stmt of sourceFile.getStatements()) {
            this.transformStatement(stmt, []);
        }

        return {
            sourceFile: sourceFile.getFilePath(),
            blocks: this.blocks,
        };
    }

    /**
     * Collect variable declarations (const/var/let) and function declarations.
     * Note: esbuild converts const to var, so we collect all variable declarations.
     */
    private collectDeclarations() {
        // Collect all variable declarations (esbuild converts const to var)
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

        // Collect function declarations
        for (const func of this.sourceFile.getFunctions()) {
            const name = func.getName();
            if (name) {
                this.funcs.set(name, func);
            }
        }
    }

    /**
     * Transform a statement, accumulating parent conditions for nested ifs.
     */
    private transformStatement(stmt: Statement, parentConditions: BAFTopCondition[]) {
        // Skip variable and function declarations
        if (stmt.isKind(SyntaxKind.VariableStatement) || stmt.isKind(SyntaxKind.FunctionDeclaration)) {
            return;
        }

        if (stmt.isKind(SyntaxKind.IfStatement)) {
            this.transformIfStatement(stmt as IfStatement, parentConditions);
        } else if (stmt.isKind(SyntaxKind.ForOfStatement)) {
            this.transformForOfStatement(stmt as ForOfStatement, parentConditions);
        } else if (stmt.isKind(SyntaxKind.ForStatement)) {
            this.transformForStatement(stmt as ForStatement, parentConditions);
        } else if (stmt.isKind(SyntaxKind.Block)) {
            for (const s of (stmt as Block).getStatements()) {
                this.transformStatement(s, parentConditions);
            }
        } else if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                const funcName = expr.getExpression().getText();

                // Skip esbuild helper calls
                if (funcName === "__name" || funcName === "__defProp") {
                    return;
                }

                const funcDecl = this.funcs.get(funcName);

                if (funcDecl) {
                    // User-defined function - inline its body
                    this.inlineVoidFunctionCall(expr, funcDecl, parentConditions);
                } else {
                    // Built-in action call
                    const action = this.transformCallToAction(expr);
                    this.blocks.push({
                        conditions: parentConditions.length > 0 ? parentConditions : [this.trueCondition()],
                        actions: [action],
                        response: 100,
                    });
                }
            }
        }
    }

    /**
     * Transform an if statement to BAF blocks.
     */
    private transformIfStatement(ifStmt: IfStatement, parentConditions: BAFTopCondition[]) {
        const condExpr = ifStmt.getExpression();
        const conditions = [...parentConditions, ...this.transformConditionExpr(condExpr)];

        const thenStmt = ifStmt.getThenStatement();
        const elseStmt = ifStmt.getElseStatement();

        // Process then block
        this.processBlock(this.getBlockStatements(thenStmt), conditions);

        // Handle else block
        if (elseStmt) {
            const invertedConditions = this.invertConditions(parentConditions, condExpr);
            if (elseStmt.isKind(SyntaxKind.IfStatement)) {
                // else if - recurse
                this.transformIfStatement(elseStmt as IfStatement, invertedConditions);
            } else {
                // else block
                this.processBlock(this.getBlockStatements(elseStmt), invertedConditions);
            }
        }
    }

    /**
     * Process a block of statements - either recurse for nested ifs or emit actions.
     */
    private processBlock(statements: Statement[], conditions: BAFTopCondition[]) {
        const hasNestedIf = statements.some(s => s.isKind(SyntaxKind.IfStatement));

        if (hasNestedIf) {
            for (const s of statements) {
                this.transformStatement(s, conditions);
            }
        } else {
            const actions = this.transformActionsFromStatements(statements);
            if (actions.length > 0) {
                this.blocks.push({ conditions, actions, response: 100 });
            }
        }
    }

    /**
     * Transform a for-of loop by unrolling.
     */
    private transformForOfStatement(forOf: ForOfStatement, parentConditions: BAFTopCondition[]) {
        const body = forOf.getStatement();
        this.unrollForOf(forOf, () => {
            this.transformStatement(body, parentConditions);
        });
    }

    /**
     * Transform a for loop by unrolling.
     */
    private transformForStatement(forStmt: ForStatement, parentConditions: BAFTopCondition[]) {
        const body = forStmt.getStatement();
        this.unrollFor(forStmt, () => {
            this.transformStatement(body, parentConditions);
        });
    }

    /**
     * Transform a condition expression to BAFTopCondition[].
     * Handles &&, ||, !, and function calls.
     */
    private transformConditionExpr(expr: Expression): BAFTopCondition[] {
        // Handle binary && - split into multiple top conditions
        if (Node.isBinaryExpression(expr)) {
            const opKind = expr.getOperatorToken().getKind();

            if (opKind === SyntaxKind.AmpersandAmpersandToken) {
                // AND: combine conditions
                return [
                    ...this.transformConditionExpr(expr.getLeft()),
                    ...this.transformConditionExpr(expr.getRight()),
                ];
            }

            if (opKind === SyntaxKind.BarBarToken) {
                // OR: create an OR group
                const orGroup = this.buildOrGroup(expr);
                return [orGroup];
            }
        }

        // Handle parenthesized expression
        if (Node.isParenthesizedExpression(expr)) {
            return this.transformConditionExpr(expr.getExpression());
        }

        // Handle negation
        if (Node.isPrefixUnaryExpression(expr)) {
            const prefixExpr = expr as PrefixUnaryExpression;
            if (prefixExpr.getOperatorToken() === SyntaxKind.ExclamationToken) {
                const operand = prefixExpr.getOperand();
                // Check if it's a negated call
                if (Node.isCallExpression(operand)) {
                    const funcName = operand.getExpression().getText();
                    const funcDecl = this.funcs.get(funcName);

                    if (funcDecl) {
                        // User function - negate each inlined condition
                        const conditions = this.inlineFunctionConditions(operand, funcDecl);
                        return this.negateConditions(conditions);
                    }

                    const cond = this.transformCallToCondition(operand);
                    return [{ ...cond, negated: true }];
                }
                // Check if it's a negated parenthesized expression with OR
                if (Node.isParenthesizedExpression(operand)) {
                    const inner = operand.getExpression();
                    if (Node.isBinaryExpression(inner) && inner.getOperatorToken().getKind() === SyntaxKind.BarBarToken) {
                        // !(a || b) → !a && !b - apply De Morgan
                        throw new Error(
                            `Cannot represent "!(${inner.getText()})" in BAF.\n` +
                            `Negation of OR groups is not supported. Refactor to avoid this pattern.`
                        );
                    }
                }
            }
        }

        // Handle call expression
        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const funcDecl = this.funcs.get(funcName);

            if (funcDecl) {
                // User-defined function - inline its return expression as conditions
                return this.inlineFunctionConditions(expr, funcDecl);
            }

            // Built-in BAF condition
            return [this.transformCallToCondition(expr)];
        }

        // Fallback: treat as opaque condition
        return [this.opaqueCondition(expr.getText(), false)];
    }

    /**
     * Build an OR group from a binary || expression.
     */
    private buildOrGroup(expr: Expression): BAFOrGroup {
        const conditions: BAFCondition[] = [];

        const collect = (e: Expression) => {
            if (Node.isBinaryExpression(e) && e.getOperatorToken().getKind() === SyntaxKind.BarBarToken) {
                collect(e.getLeft());
                collect(e.getRight());
            } else if (Node.isParenthesizedExpression(e)) {
                collect(e.getExpression());
            } else {
                // Must be an atom (call or negated call)
                const cond = this.exprToCondition(e);
                conditions.push(cond);
            }
        };

        collect(expr);
        return { conditions };
    }

    /**
     * Convert an expression to a single BAFCondition (used for OR group elements).
     */
    private exprToCondition(expr: Expression): BAFCondition {
        if (Node.isPrefixUnaryExpression(expr)) {
            const prefixExpr = expr as PrefixUnaryExpression;
            if (prefixExpr.getOperatorToken() === SyntaxKind.ExclamationToken) {
                const operand = prefixExpr.getOperand();
                if (Node.isCallExpression(operand)) {
                    const funcName = operand.getExpression().getText();
                    const funcDecl = this.funcs.get(funcName);

                    if (funcDecl) {
                        const cond = this.inlineFunctionAsSingleCondition(operand, funcDecl);
                        return { ...cond, negated: !cond.negated };
                    }

                    const cond = this.transformCallToCondition(operand);
                    return { ...cond, negated: true };
                }
            }
        }

        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const funcDecl = this.funcs.get(funcName);

            if (funcDecl) {
                return this.inlineFunctionAsSingleCondition(expr, funcDecl);
            }

            return this.transformCallToCondition(expr);
        }

        return this.opaqueCondition(expr.getText(), false);
    }

    /**
     * Transform a call expression to a BAFCondition (for built-in BAF conditions only).
     * For user functions, use inlineFunctionConditions instead.
     */
    private transformCallToCondition(call: CallExpression): BAFCondition {
        const funcName = call.getExpression().getText();
        const args = call.getArguments().map(a => this.substituteVars(a.getText()));
        return { negated: false, name: funcName, args };
    }

    /**
     * Inline a user function call, returning its conditions.
     * Handles complex return expressions like "A() && B() && C()".
     */
    private inlineFunctionConditions(call: CallExpression, funcDecl: FunctionDeclaration): BAFTopCondition[] {
        const body = funcDecl.getBody()?.asKindOrThrow(SyntaxKind.Block);
        if (!body) return [this.trueCondition()];

        const returnStmt = body.getStatements().find(s => s.isKind(SyntaxKind.ReturnStatement));
        if (!returnStmt) return [this.trueCondition()];

        const returnExpr = (returnStmt as ReturnStatement).getExpression();
        if (!returnExpr) return [this.trueCondition()];

        // Substitute params in return expression text
        const paramMap = this.buildParamMap(call, funcDecl);
        let returnText = returnExpr.getText();
        paramMap.forEach((value, key) => {
            returnText = returnText.replace(new RegExp(`\\b${key}\\b`, "g"), value);
        });

        // Parse the substituted return expression
        const project = new Project({ useInMemoryFileSystem: true });
        const tempFile = project.createSourceFile("temp.ts", `const _x_ = ${returnText};`);
        const varDecl = tempFile.getVariableDeclarations()[0];
        const expr = varDecl.getInitializerOrThrow();

        // Transform the parsed expression using the full condition transformer
        return this.transformConditionExpr(expr);
    }

    /**
     * Inline a user function call as a single condition (for OR groups).
     * Throws if the function returns multiple conditions.
     */
    private inlineFunctionAsSingleCondition(call: CallExpression, funcDecl: FunctionDeclaration): BAFCondition {
        const conditions = this.inlineFunctionConditions(call, funcDecl);

        if (conditions.length !== 1) {
            throw new Error(
                `Cannot use function "${funcDecl.getName()}" inside OR group: ` +
                `it returns ${conditions.length} conditions, but OR elements must be single conditions.`
            );
        }

        const cond = conditions[0];
        if ("conditions" in cond) {
            throw new Error(
                `Cannot use function "${funcDecl.getName()}" inside OR group: ` +
                `it returns an OR group, which cannot be nested inside another OR.`
            );
        }

        return cond;
    }

    /**
     * Transform a call expression to a BAFAction.
     */
    private transformCallToAction(call: CallExpression): BAFAction {
        const funcName = call.getExpression().getText();
        const args = call.getArguments().map(a => this.substituteVars(a.getText()));
        return { name: funcName, args };
    }

    /**
     * Transform statements to BAFActions.
     */
    private transformActionsFromStatements(statements: Statement[]): BAFAction[] {
        const actions: BAFAction[] = [];

        for (const stmt of statements) {
            if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
                const expr = stmt.getExpression();
                if (Node.isCallExpression(expr)) {
                    const funcName = expr.getExpression().getText();
                    const funcDecl = this.funcs.get(funcName);

                    if (funcDecl) {
                        // Inline void function: get its body statements as actions
                        const inlinedActions = this.inlineVoidFunction(expr, funcDecl);
                        actions.push(...inlinedActions);
                    } else {
                        actions.push(this.transformCallToAction(expr));
                    }
                }
            } else if (stmt.isKind(SyntaxKind.ForOfStatement)) {
                // Unroll for-of loop into actions
                const unrolledActions = this.unrollForOfAsActions(stmt as ForOfStatement);
                actions.push(...unrolledActions);
            } else if (stmt.isKind(SyntaxKind.ForStatement)) {
                // Unroll for loop into actions
                const unrolledActions = this.unrollForAsActions(stmt as ForStatement);
                actions.push(...unrolledActions);
            }
        }

        return actions;
    }

    /**
     * Unroll a for-of loop into actions.
     */
    private unrollForOfAsActions(forOf: ForOfStatement): BAFAction[] {
        const bodyStatements = this.getBlockStatements(forOf.getStatement());
        const actions: BAFAction[] = [];
        this.unrollForOf(forOf, () => {
            actions.push(...this.transformActionsFromStatements(bodyStatements));
        });
        return actions;
    }

    /**
     * Unroll a for loop into actions.
     */
    private unrollForAsActions(forStmt: ForStatement): BAFAction[] {
        const bodyStatements = this.getBlockStatements(forStmt.getStatement());
        const actions: BAFAction[] = [];
        this.unrollFor(forStmt, () => {
            actions.push(...this.transformActionsFromStatements(bodyStatements));
        });
        return actions;
    }

    /**
     * Unroll a for-of loop, calling the callback for each element.
     * Sets the loop variable in vars context during each iteration.
     */
    private unrollForOf(forOf: ForOfStatement, onIteration: () => void): void {
        const arrayExpr = forOf.getExpression();
        const elements = this.resolveArrayElements(arrayExpr);

        if (!elements) {
            throw new Error(`Cannot unroll for-of: array expression "${arrayExpr.getText()}" is not resolvable`);
        }

        const loopVar = forOf.getInitializer().getText().replace(/^const\s+/, "").replace(/^let\s+/, "");

        for (const element of elements) {
            this.vars.set(loopVar, element);
            onIteration();
        }

        this.vars.delete(loopVar);
    }

    /** Maximum iterations for loop unrolling to prevent infinite loops */
    private static readonly MAX_LOOP_ITERATIONS = 1000;

    /**
     * Unroll a for loop, calling the callback for each iteration.
     * Sets the loop variable in vars context during each iteration.
     */
    private unrollFor(forStmt: ForStatement, onIteration: () => void): void {
        const initializer = forStmt.getInitializer();
        if (!initializer || !initializer.isKind(SyntaxKind.VariableDeclarationList)) {
            throw new Error("Cannot unroll for loop: complex initializer");
        }

        const decls = initializer.getDeclarations();
        if (decls.length !== 1) {
            throw new Error("Cannot unroll for loop: multi-variable initializer");
        }

        const loopVar = decls[0].getName();
        const initValue = this.evaluateNumeric(decls[0].getInitializer());
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
        let current = initValue;
        let iterations = 0;

        while (this.evaluateLoopCondition(condition.getText(), loopVar, current) && iterations < TBAFTransformer.MAX_LOOP_ITERATIONS) {
            this.vars.set(loopVar, current.toString());
            onIteration();
            current += increment;
            iterations++;
        }

        this.vars.delete(loopVar);
    }

    /**
     * Inline a void function call at top level, transforming its body statements.
     * This handles functions containing if statements, loops, etc.
     */
    private inlineVoidFunctionCall(call: CallExpression, funcDecl: FunctionDeclaration, parentConditions: BAFTopCondition[]) {
        const body = funcDecl.getBody()?.asKindOrThrow(SyntaxKind.Block);
        if (!body) return;

        this.withParamContext(call, funcDecl, () => {
            for (const stmt of body.getStatements()) {
                this.transformStatement(stmt, parentConditions);
            }
        });
    }

    /**
     * Inline a void function call, returning its actions.
     * Used when inlining inside an if block's action list.
     */
    private inlineVoidFunction(call: CallExpression, funcDecl: FunctionDeclaration): BAFAction[] {
        const body = funcDecl.getBody()?.asKindOrThrow(SyntaxKind.Block);
        if (!body) return [];

        let actions: BAFAction[] = [];
        this.withParamContext(call, funcDecl, () => {
            actions = this.transformActionsFromStatements(body.getStatements());
        });
        return actions;
    }

    /**
     * Execute a function with parameter substitutions in the vars context.
     * Saves and restores the vars context around the callback.
     */
    private withParamContext(call: CallExpression, funcDecl: FunctionDeclaration, fn: () => void): void {
        const paramMap = this.buildParamMap(call, funcDecl);

        const savedVars = new Map(this.vars);
        paramMap.forEach((value, key) => this.vars.set(key, value));

        fn();

        this.vars = savedVars;
    }

    /**
     * Build a map of parameter names to substituted argument values.
     */
    private buildParamMap(call: CallExpression, funcDecl: FunctionDeclaration): Map<string, string> {
        const params = funcDecl.getParameters();
        const args = call.getArguments();
        const paramMap = new Map<string, string>();

        params.forEach((param, i) => {
            const paramName = param.getName();
            const argText = args[i]?.getText() || param.getInitializer()?.getText() || "";
            paramMap.set(paramName, this.substituteVars(argText));
        });

        return paramMap;
    }

    /**
     * Invert conditions for else block.
     */
    private invertConditions(parentConditions: BAFTopCondition[], condExpr: Expression): BAFTopCondition[] {
        // For else, we need: parentConditions AND NOT(condExpr)
        const inverted = this.invertExpression(condExpr);
        return [...parentConditions, ...inverted];
    }

    /**
     * Invert an expression using De Morgan's law.
     * Returns BAFTopCondition[] since inversion of AND produces OR.
     */
    private invertExpression(expr: Expression): BAFTopCondition[] {
        if (Node.isBinaryExpression(expr)) {
            const opKind = expr.getOperatorToken().getKind();

            if (opKind === SyntaxKind.AmpersandAmpersandToken) {
                // !(a && b) → !a || !b - creates an OR group
                const leftConds = this.invertExpression(expr.getLeft());
                const rightConds = this.invertExpression(expr.getRight());

                // Flatten into single OR group
                const allConditions: BAFCondition[] = [];
                for (const c of [...leftConds, ...rightConds]) {
                    if ("conditions" in c) {
                        // Already an OR group - this means nested AND inside OR, which is invalid CNF
                        throw new Error(
                            `Cannot invert condition for BAF: result would not be valid CNF.\n` +
                            `Expression: ${expr.getText()}`
                        );
                    } else {
                        allConditions.push(c);
                    }
                }

                return [{ conditions: allConditions }];
            }

            if (opKind === SyntaxKind.BarBarToken) {
                // !(a || b) → !a && !b - produces multiple ANDed conditions
                const leftConds = this.invertExpression(expr.getLeft());
                const rightConds = this.invertExpression(expr.getRight());
                return [...leftConds, ...rightConds];
            }
        }

        if (Node.isParenthesizedExpression(expr)) {
            return this.invertExpression(expr.getExpression());
        }

        if (Node.isPrefixUnaryExpression(expr)) {
            const prefixExpr = expr as PrefixUnaryExpression;
            if (prefixExpr.getOperatorToken() === SyntaxKind.ExclamationToken) {
                // !!a → a (double negation)
                const operand = prefixExpr.getOperand();
                if (Node.isCallExpression(operand)) {
                    const funcName = operand.getExpression().getText();
                    const funcDecl = this.funcs.get(funcName);

                    if (funcDecl) {
                        // Un-negate user function conditions
                        return this.inlineFunctionConditions(operand, funcDecl);
                    }

                    const cond = this.transformCallToCondition(operand);
                    return [{ ...cond, negated: false }];
                }
                return this.transformConditionExpr(operand);
            }
        }

        if (Node.isCallExpression(expr)) {
            const funcName = expr.getExpression().getText();
            const funcDecl = this.funcs.get(funcName);

            if (funcDecl) {
                // Negate each condition from the user function
                const conditions = this.inlineFunctionConditions(expr, funcDecl);
                return this.negateConditions(conditions);
            }

            const cond = this.transformCallToCondition(expr);
            return [{ ...cond, negated: true }];
        }

        return [this.opaqueCondition(expr.getText(), true)];
    }

    /**
     * Negate all conditions in a list, toggling their negated flags.
     */
    private negateConditions(conditions: BAFTopCondition[]): BAFTopCondition[] {
        return conditions.map(c => {
            if ("conditions" in c) {
                // OR group - negate all its conditions
                return {
                    conditions: c.conditions.map(inner => ({ ...inner, negated: !inner.negated })),
                };
            }
            return { ...c, negated: !c.negated };
        });
    }

    /**
     * Get statements from a block or single statement.
     */
    private getBlockStatements(stmt: Statement): Statement[] {
        if (stmt.isKind(SyntaxKind.Block)) {
            return (stmt as Block).getStatements();
        }
        return [stmt];
    }

    /**
     * Evaluate an expression to a string value if possible.
     */
    private evaluateExpression(expr: Expression): string | undefined {
        if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
            const arr = expr as ArrayLiteralExpression;
            const elements = this.flattenArrayElements(arr);
            return `[${elements.join(", ")}]`;
        }

        if (expr.isKind(SyntaxKind.StringLiteral) || expr.isKind(SyntaxKind.NumericLiteral)) {
            return expr.getText();
        }

        if (expr.isKind(SyntaxKind.Identifier)) {
            const name = expr.getText();
            if (this.vars.has(name)) {
                return this.vars.get(name);
            }
        }

        return expr.getText();
    }

    /**
     * Flatten array elements, resolving spreads.
     */
    private flattenArrayElements(arr: ArrayLiteralExpression): string[] {
        const result: string[] = [];

        for (const el of arr.getElements()) {
            if (el.isKind(SyntaxKind.SpreadElement)) {
                const spreadExpr = (el as SpreadElement).getExpression();
                if (spreadExpr.isKind(SyntaxKind.ArrayLiteralExpression)) {
                    result.push(...this.flattenArrayElements(spreadExpr as ArrayLiteralExpression));
                } else if (spreadExpr.isKind(SyntaxKind.Identifier)) {
                    const name = spreadExpr.getText();
                    if (this.vars.has(name)) {
                        const value = this.vars.get(name)!;
                        // Parse array literal
                        const inner = value.slice(1, -1).trim();
                        if (inner) {
                            result.push(...inner.split(",").map(s => s.trim()));
                        }
                    }
                }
            } else {
                result.push(this.substituteVars(el.getText()));
            }
        }

        return result;
    }

    /**
     * Resolve array elements from an expression.
     */
    private resolveArrayElements(expr: Expression): string[] | null {
        if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
            return this.flattenArrayElements(expr as ArrayLiteralExpression);
        }

        if (expr.isKind(SyntaxKind.Identifier)) {
            const name = expr.getText();
            if (this.vars.has(name)) {
                const value = this.vars.get(name)!;
                if (value.startsWith("[") && value.endsWith("]")) {
                    const inner = value.slice(1, -1).trim();
                    if (inner) {
                        return inner.split(",").map(s => s.trim());
                    }
                    return [];
                }
            }
        }

        return null;
    }

    /**
     * Evaluate a numeric expression.
     */
    private evaluateNumeric(expr: Expression | undefined): number | undefined {
        if (!expr) return undefined;

        const text = this.substituteVars(expr.getText());
        const num = Number(text);
        return isNaN(num) ? undefined : num;
    }

    /**
     * Parse increment from for loop.
     */
    private parseIncrement(text: string): number {
        if (text.includes("++")) return 1;
        if (text.includes("--")) return -1;
        if (text.includes("+=")) return Number(text.split("+=")[1]) || 1;
        if (text.includes("-=")) return -(Number(text.split("-=")[1]) || 1);
        return 1;
    }

    /**
     * Evaluate loop condition.
     */
    private evaluateLoopCondition(condition: string, loopVar: string, value: number): boolean {
        // Substitute loop variable
        let substituted = condition.replace(new RegExp(`\\b${loopVar}\\b`, "g"), value.toString());
        // Substitute other variables (like iterations)
        substituted = this.substituteVars(substituted);
        try {
            const fn = new Function(`return (${substituted});`);
            return fn();
        } catch {
            return false;
        }
    }

    /**
     * Substitute variables in text.
     */
    private substituteVars(text: string): string {
        let result = text;
        this.vars.forEach((value, key) => {
            result = result.replace(new RegExp(`\\b${key}\\b`, "g"), value);
        });
        return result;
    }

    /**
     * Create an opaque condition (for expressions we can't parse).
     */
    private opaqueCondition(text: string, negated: boolean): BAFCondition {
        // Try to parse as a function call
        const match = text.match(/^(\w+)\((.*)\)$/);
        if (match) {
            return {
                negated,
                name: match[1],
                args: match[2] ? match[2].split(",").map(s => s.trim()) : [],
            };
        }

        // Fallback: use True() or False() wrapper
        return {
            negated,
            name: "True",
            args: [],
        };
    }

    /**
     * Create a True() condition placeholder.
     */
    private trueCondition(): BAFCondition {
        return {
            negated: false,
            name: "True",
            args: [],
        };
    }
}
