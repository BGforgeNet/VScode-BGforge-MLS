import * as fs from "fs";
import * as path from "path";
import {
    ArrayLiteralExpression,
    BinaryExpression,
    Block,
    CallExpression,
    Expression,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    IfStatement,
    Node,
    ParenthesizedExpression,
    PrefixUnaryExpression,
    Project,
    ReturnStatement,
    SourceFile,
    SpreadElement,
    SyntaxKind,
    VariableDeclaration,
    VariableDeclarationKind,
    VariableDeclarationList
} from 'ts-morph';
import { conlog, getRelPath2, tmpDir, uriToPath } from "./common";
import { connection } from "./server";

import typescript from "@rollup/plugin-typescript";
import { cwd } from "process";
import { rollup } from 'rollup';

export const EXT_TBAF = ".tbaf";

/**
 * Initial Rollup bundle is saved here.
 */
const TMP_BUNDLED = path.join(tmpDir, "tbaf-bundled.ts");

/**
 * TS compiler refuses to recognize tbaf, so we have to copy.
 * Located in the same directory as the file being compiled.
 * Cannot be ".tmp.ts", TS/Rollup refuse that too.
 */
const TMP_COPIED = "_tmp.tbaf.ts";

/**
 * Final TS code ends up here
 */
const TMP_FINAL = path.join(tmpDir, "tbaf-final.ts");

/**
 * Convert TBAF to BAF.
 * @param uri 
 * @returns 
 */
export async function compile(uri: string, text: string) {
    const filePath = uriToPath(uri);
    let ext = path.parse(filePath).ext;
    ext = ext.toLowerCase();
    if (ext != EXT_TBAF) {
        conlog(`${uri} is not a .tbaf file, cannot process!`);
        connection.window.showInformationMessage(`${uri} is not a .tbaf file, cannot process!`);
        return;
    }

    // Initialize the TypeScript project
    // Read all files anew to avoid ts-morph caching.
    const project = new Project();

    await bundle(filePath, text);

    const sourceFile = project.addSourceFileAtPath(TMP_BUNDLED);

    // Apply transformations
    applyTransformations(sourceFile);
    // Save the transformed file to the specified output file
    const finalTS = project.createSourceFile(TMP_FINAL, sourceFile.getText(), { overwrite: true });
    finalTS.saveSync();
    conlog(`\nTransformed code saved to ${TMP_FINAL}`);

    // Save to BAF file, same directory
    const dirName = path.parse(filePath).dir;
    const baseName = path.parse(filePath).name;
    const bafName = path.join(dirName, `${baseName}.baf`);
    const fileName = path.basename(filePath);
    exportBAF(finalTS, bafName, fileName);
    connection.window.showInformationMessage(`Transpiled to ${bafName}.`);
}


/**
 * For tracking variable values in context
 */
type varsContext = Map<string, string>;

/**
 * Inline and unroll loops and other constructs.
 * Uses collect-then-transform pattern to avoid AST mutation during traversal.
 * @param sourceFile The source file to modify.
 */
function inlineUnroll(sourceFile: SourceFile) {
    const functionDeclarations = sourceFile.getFunctions();
    const variablesContext: varsContext = new Map();

    // Step 1: Collect const variable declarations (no mutation, just gathering info)
    collectConstVariables(sourceFile, variablesContext);

    // Step 2: Flatten spread elements in array literals (collect then transform)
    const arrayLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression);
    // Process in reverse order to avoid position shifts
    for (let i = arrayLiterals.length - 1; i >= 0; i--) {
        flattenSpreadForNode(arrayLiterals[i], variablesContext);
    }

    // Step 3: Unroll for...of loops (collect then transform)
    const forOfStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ForOfStatement);
    for (let i = forOfStatements.length - 1; i >= 0; i--) {
        unrollForOfLoop(forOfStatements[i], variablesContext);
    }

    // Step 4: Unroll for loops (collect then transform)
    const forStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement);
    for (let i = forStatements.length - 1; i >= 0; i--) {
        unrollForLoop(forStatements[i], variablesContext);
    }

    // Step 5: Handle function calls - substitute variables and inline (collect then transform)
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (let i = callExpressions.length - 1; i >= 0; i--) {
        const callExpr = callExpressions[i];
        // Check if node is still valid (might have been removed by previous inlining)
        if (callExpr.wasForgotten()) continue;

        substituteVariables(callExpr, variablesContext);

        const functionName = callExpr.getExpression().getText();
        if (functionDeclarations.some(func => func.getName() === functionName)) {
            inlineFunction(callExpr, functionDeclarations, variablesContext);
        }
    }
}

/**
 * Collect const variable declarations into the context.
 * This pass only reads, doesn't modify the AST.
 */
function collectConstVariables(sourceFile: SourceFile, variablesContext: varsContext) {
    const varDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

    for (const variableDeclaration of varDeclarations) {
        const parentDeclarationList = variableDeclaration.getParent() as VariableDeclarationList;
        if (parentDeclarationList.getDeclarationKind() === VariableDeclarationKind.Const) {
            const name = variableDeclaration.getName();
            const init = variableDeclaration.getInitializer();
            if (init) {
                const initializerText = getCleanInitializerText(init);
                if (initializerText.includes("...")) {
                    conlog(`Skipping collection for ${name} because initializer still contains spread.`);
                } else {
                    variablesContext.set(name, initializerText);
                    conlog(`Collected const variable: ${name} = ${initializerText}`);
                }
            }
        }
    }
}

// Rebuild an initializer from an array literal (omitting comments)
function getCleanInitializerText(init: Expression): string {
    if (init.getKind() === SyntaxKind.ArrayLiteralExpression) {
        const arr = init as ArrayLiteralExpression;
        return `[ ${arr.getElements().map(el => el.getText()).join(", ")} ]`;
    }
    return init.getText();
}

/**
 * Substitute variables in non-local function calls using the provided variable context.
 * @param callExpression The call expression to substitute variables in.
 * @param vars The context of variable declarations.
 */
function substituteVariables(callExpression: CallExpression, vars: Map<string, string>) {
    callExpression.getArguments().forEach(arg => {
        const argText = arg.getText();
        if (vars.has(argText)) {
            const substitution = vars.get(argText)!;
            conlog(`Substituting variable in argument: ${argText} -> ${substitution}`);
            arg.replaceWithText(substitution);
        }
    });
}

function inlineFunction(callExpression: CallExpression, functionDeclarations: FunctionDeclaration[], vars: varsContext) {
    const functionName = callExpression.getExpression().getText();
    conlog(`Processing function: ${functionName}`);

    const parent = callExpression.getParent();
    // Short-circuit if the function call is inverted with '!'
    if (Node.isPrefixUnaryExpression(parent) && parent.getOperatorToken() === SyntaxKind.ExclamationToken) {
        conlog(`Skipping inlining for inverted call: !${functionName}()`);
        return;
    }

    // Find the corresponding function declaration
    const functionDecl = functionDeclarations.find(func => func.getName() === functionName);
    if (!functionDecl) return;

    const parameters = functionDecl.getParameters();
    const args = callExpression.getArguments();

    // Map parameters to arguments
    const paramArgMap = new Map<string, string>();
    parameters.forEach((param, index) => {
        const paramName = param.getName();
        let argText = args[index]?.getText() || param.getInitializer()?.getText() || "undefined";

        if (vars.has(argText)) argText = vars.get(argText)!;
        paramArgMap.set(paramName, argText);
    });


    // Handle boolean return statements
    const functionBody = functionDecl.getBody()?.asKindOrThrow(SyntaxKind.Block);
    if (!functionBody) return;
    const statements = functionBody.getStatements();
    const returnStmt = statements.find(stmt => stmt.isKind(SyntaxKind.ReturnStatement)) as ReturnStatement | undefined;
    if (returnStmt && isConditionContext(parent)) {
        if (!parent) return;    // Skip if not parent
        let returnText = returnStmt.getExpression()?.getText() || "undefined";
        returnText = substituteParams(returnText, paramArgMap, vars);

        conlog(`return text is ${returnText}`);
        if (needsParentheses(returnText)) returnText = `(${returnText})`;
        parent.replaceWithText(parent.getText().replace(callExpression.getText(), returnText));
        conlog(`Replaced ${functionName}() inside a condition.`);
        return;
    }

    // Handle void functions
    if (!returnStmt && parent?.isKind(SyntaxKind.ExpressionStatement)) {
        let inlinedCode = statements.map(stmt => stmt.getText()).join("\n");
        inlinedCode = substituteParams(inlinedCode, paramArgMap, vars);

        parent.replaceWithText(inlinedCode);
        conlog(`Replaced ${functionName}() with inlined code.`);
    }
}

/**
 * Utility to substitute parameters and variables in the code.
 */
function substituteParams(code: string, paramArgMap: Map<string, string>, vars: varsContext): string {
    paramArgMap.forEach((arg, param) => {
        const regex = new RegExp(`\\b${param}\\b`, "g");
        code = code.replace(regex, arg);
    });
    vars.forEach((value, variable) => {
        const regex = new RegExp(`\\b${variable}\\b`, "g");
        code = code.replace(regex, value);
    });
    return code;
}

/**
 * Utility to determine if a return text needs parentheses.
 */
function needsParentheses(text: string): boolean {
    return (text.includes("&&") || text.includes("||") && !(text.startsWith('(') && text.endsWith(')')));
}

/**
 * Checks if the parent node is part of a condition (if statement, binary expression, etc.).
 */
function isConditionContext(parent: Node | undefined): boolean {
    return !!(
        parent &&
        (parent.isKind(SyntaxKind.IfStatement) ||
            parent.isKind(SyntaxKind.BinaryExpression) ||
            parent.isKind(SyntaxKind.PrefixUnaryExpression))
    );
}

/**
 * Unroll a single for...of loop.
 * @param forOfStatement The for...of statement to unroll.
 * @param vars The context of variable declarations.
 */
function unrollForOfLoop(forOfStatement: ForOfStatement, vars: varsContext) {
    // Get array expression (e.g., `players` in `for (const player of players)`)
    let arrayExpression = forOfStatement.getExpression().getText();

    // Resolve the array expression if it's a const variable
    if (vars.has(arrayExpression)) {
        arrayExpression = vars.get(arrayExpression)!;
    }

    conlog("Array Expression:", arrayExpression);

    // Check if the resolved array expression is a literal array
    const arrayLiteral = forOfStatement.getSourceFile().getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)
        .find(literal => literal.getText() === arrayExpression);

    if (!arrayLiteral) {
        conlog("Not a literal array, skipping...");
        return;
    }

    // Get loop variable name (e.g., `target` in `for (const target of players)`)
    const loopVariable = forOfStatement.getInitializer().getText().replace(/^const\s+/, '');
    conlog("Loop Variable:", loopVariable);

    // Get body statements inside the loop
    const statement = forOfStatement.getStatement();
    const bodyStatements = statement.isKind(SyntaxKind.Block)
        ? statement.getStatements()
        : [statement];

    conlog("Body Statements:");
    bodyStatements.forEach(stmt => conlog(stmt.getText()));

    // Unroll the loop
    const unrolledStatements = arrayLiteral.getElements().map(element => {
        return bodyStatements.map(statement => {
            let statementText = statement.getText();

            // Replace the loop variable with the indexed array element
            statementText = statementText.replace(new RegExp(`\\b${loopVariable}\\b`, "g"), element.getText());

            // Resolve any const variables used in the statement
            vars.forEach((value, variable) => {
                statementText = statementText.replace(new RegExp(`\\b${variable}\\b`, "g"), value);
            });

            return statementText;
        }).join("\n");
    });

    conlog("Unrolled Statements:");
    conlog(unrolledStatements.join("\n"));

    // Replace the original loop with unrolled statements
    forOfStatement.replaceWithText(unrolledStatements.join("\n"));
}

/**
 * Bundle functions into temporary file with Rollup
 */
async function bundle(input: string, text: string) {
    input = getRelPath2(cwd(), input);  // Otherwise Rollup can't find includes
    const tmpInput = path.join(path.dirname(input), TMP_COPIED);
    fs.writeFileSync(tmpInput, text);
    const bundle = await rollup({
        input: tmpInput,
        external: id => /node_modules/.test(id),  // Exclude node_modules
        plugins: [
            typescript({
                declaration: false,
                tslib: 'tslib',    // Otherwise Rollup won't even start
                target: "esnext",   // So that Rollup doesn't change syntax
                // include: "**/*.(ts|tbaf)",   // Doesn't work, TS compiler refuses to recognize tbaf, so we have to copy.
            })
        ]
    });

    await bundle.write({
        file: TMP_BUNDLED,
        format: 'esm',
    });

    conlog('Bundling complete!');
}


/**
 * Convert all ELSE statement to IF statements with inverted conditions, like BAF needs.
 * Uses collect-then-transform pattern to avoid AST mutation during traversal.
 * @param sourceFile
 */
function convertElseToIf(sourceFile: SourceFile) {
    conlog("Starting transformation on source file:", sourceFile.getFilePath());

    // Collect all if statements with else blocks
    const ifStatements = sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)
        .filter(ifStmt => ifStmt.getElseStatement() !== undefined);

    // Process in reverse order to avoid position shifts
    for (let i = ifStatements.length - 1; i >= 0; i--) {
        const ifStatement = ifStatements[i];
        if (ifStatement.wasForgotten()) continue;

        const elseStatement = ifStatement.getElseStatement();
        if (!elseStatement) continue;

        conlog("Found if statement:", ifStatement.getText());
        conlog("Found else statement:", elseStatement.getText());

        const ifCondition = ifStatement.getExpression().getText();
        conlog("Original condition:", ifCondition);

        // Create the original `if-0` block (unchanged `if` part)
        const if0Block = `if (${ifCondition}) ${ifStatement.getThenStatement().getText()}`;
        conlog("if-0 block:", if0Block);

        // Invert the `else` condition to create `if-1`
        const invertedCondition = invertCondition(ifCondition);
        conlog("Inverted condition for else block (if-1):", invertedCondition);

        const if1Block = `if (${invertedCondition}) ${elseStatement.getText()}`;
        conlog("if-1 block:", if1Block);

        // Combine `if-0` and `if-1` blocks
        const newIfBlock = `${if0Block}\n${if1Block}`;
        conlog("Combined new if block (if-0 + if-1):\n", newIfBlock);

        // Replace the original if-else block with the new combined block
        ifStatement.replaceWithText(newIfBlock);
        conlog("Replaced original if-else block with new combined if block.");
    }

    conlog("Transformation completed.");
}

/**
 * Invert logical condition using AST-based De Morgan's law transformation.
 * Properly handles nested conditions like (a && b) || c.
 *
 * Note: BAF requires CNF (Conjunctive Normal Form): AND of (ORs or atoms).
 * Inverting some valid CNF conditions produces non-CNF results that BAF can't represent.
 * For example: (a || b) && c → (!a && !b) || !c (DNF, not CNF)
 *
 * @param condition Logical condition from an IF statement
 * @returns inverted condition text
 */
function invertCondition(condition: string): string {
    conlog("Inverting condition:", condition);

    // Parse the condition as an expression using ts-morph
    const project = new Project({ useInMemoryFileSystem: true });
    const tempFile = project.createSourceFile("temp.ts", `const _x_ = ${condition};`);
    const varDecl = tempFile.getVariableDeclarations()[0];
    const expr = varDecl.getInitializerOrThrow();

    const result = invertExpression(expr);

    // Validate result is valid CNF for BAF
    if (!isValidCNF(result)) {
        throw new Error(
            `Cannot invert condition for BAF: "${condition}" → "${result}"\n` +
            `The inverted condition is not valid CNF (Conjunctive Normal Form).\n` +
            `BAF requires: AND of (atoms or OR-groups). Got OR containing AND.\n` +
            `Consider simplifying or restructuring your if/else to avoid this pattern.`
        );
    }

    return result;
}

/**
 * Check if a condition string is valid CNF for BAF.
 * Valid: AND of (atoms or OR-groups), where OR-groups contain only atoms.
 * Invalid: OR at top level containing AND, nested parens, etc.
 */
function isValidCNF(condition: string): boolean {
    // Parse and check structure
    try {
        const project = new Project({ useInMemoryFileSystem: true });
        const tempFile = project.createSourceFile("temp2.ts", `const _x_ = ${condition};`);
        const varDecl = tempFile.getVariableDeclarations()[0];
        const expr = varDecl.getInitializerOrThrow();

        return checkCNF(expr, false);
    } catch {
        return false;
    }
}

/**
 * Recursively check if expression is valid CNF.
 * @param expr The expression to check
 * @param insideOr Whether we're inside an OR group (AND not allowed inside OR)
 */
function checkCNF(expr: Expression, insideOr: boolean): boolean {
    if (Node.isBinaryExpression(expr)) {
        const opKind = expr.getOperatorToken().getKind();

        if (opKind === SyntaxKind.AmpersandAmpersandToken) {
            // AND is not allowed inside OR groups
            if (insideOr) return false;
            return checkCNF(expr.getLeft(), false) && checkCNF(expr.getRight(), false);
        }

        if (opKind === SyntaxKind.BarBarToken) {
            // OR is allowed, but contents must not have AND
            return checkCNF(expr.getLeft(), true) && checkCNF(expr.getRight(), true);
        }
    }

    if (Node.isParenthesizedExpression(expr)) {
        return checkCNF(expr.getExpression(), insideOr);
    }

    if (Node.isPrefixUnaryExpression(expr)) {
        // Negation of atom is fine, negation of complex expression is not
        const operand = (expr as PrefixUnaryExpression).getOperand();
        return !Node.isBinaryExpression(operand);
    }

    // Atoms (identifiers, calls, etc.) are always valid
    return true;
}

/**
 * Recursively invert an expression using De Morgan's law.
 * - a && b → !a || !b
 * - a || b → !a && !b
 * - !a → a
 * - (expr) → (inverted expr) with parens preserved where needed
 * - other → !(other)
 */
function invertExpression(expr: Expression): string {
    // Handle binary expressions (&&, ||)
    if (Node.isBinaryExpression(expr)) {
        const left = expr.getLeft();
        const right = expr.getRight();
        const opKind = expr.getOperatorToken().getKind();

        if (opKind === SyntaxKind.AmpersandAmpersandToken) {
            // a && b → !a || !b
            return `${invertExpression(left)} || ${invertExpression(right)}`;
        }
        if (opKind === SyntaxKind.BarBarToken) {
            // a || b → !a && !b
            return `${invertExpression(left)} && ${invertExpression(right)}`;
        }
    }

    // Handle prefix unary ! (double negation elimination)
    if (Node.isPrefixUnaryExpression(expr)) {
        const prefixExpr = expr as PrefixUnaryExpression;
        if (prefixExpr.getOperatorToken() === SyntaxKind.ExclamationToken) {
            // !a → a
            return prefixExpr.getOperand().getText();
        }
    }

    // Handle parenthesized expressions
    if (Node.isParenthesizedExpression(expr)) {
        const inner = expr.getExpression();
        const inverted = invertExpression(inner);
        // Keep parens if the inner expression is a binary expression (for clarity)
        if (Node.isBinaryExpression(inner)) {
            return `(${inverted})`;
        }
        return inverted;
    }

    // Default: wrap with !()
    return `!(${expr.getText()})`;
}

/**
 * Flatten spread elements in an array literal node.
 * If a spread element is a literal array or an identifier found in vars,
 * its elements are inlined.
 */
function flattenSpreadForNode(arrayLiteral: ArrayLiteralExpression, vars?: Map<string, string>) {
    // Use flatMap to replace spread elements with their flattened items.
    const flattened = arrayLiteral.getElements().flatMap((element) => {
        if (element.getKind() === SyntaxKind.SpreadElement) {
            const spreadExpr = (element as SpreadElement).getExpression();
            // Case 1: The spread expression is a literal array.
            if (spreadExpr.getKind() === SyntaxKind.ArrayLiteralExpression) {
                const innerArray = spreadExpr as ArrayLiteralExpression;
                return innerArray.getElements().map((innerEl) => innerEl.getText());
            }
            // Case 2: The spread expression is an identifier present in vars.
            else if (spreadExpr.getKind() === SyntaxKind.Identifier && vars) {
                const id = spreadExpr.getText();
                if (vars.has(id)) {
                    const literal = vars.get(id)!;
                    // Remove outer brackets and split by comma.
                    const inner = literal.slice(1, -1).trim();
                    if (inner) {
                        return inner.split(",").map((s) => s.trim()).filter((s) => s);
                    }
                }
            }
            // If no flattening possible, return the original text.
            return [element.getText()];
        }
        return [element.getText()];
    });

    const newArrayText = `[ ${flattened.join(", ")} ]`;
    // Only replace if the flattened version is different.
    if (newArrayText !== arrayLiteral.getText()) {
        conlog(
            "Replacing array literal:",
            arrayLiteral.getText(),
            "with flattened version:",
            newArrayText
        );
        arrayLiteral.replaceWithText(newArrayText);
    }
}

/**
 * Single function to flatten all nested if statements in the source file.
 * Uses collect-then-transform pattern to avoid AST mutation during traversal.
 * @param sourceFile
 */
function flattenIfStatements(sourceFile: SourceFile) {
    // Collect top-level if statements
    const ifStatements = sourceFile.getStatements()
        .filter(stmt => stmt.isKind(SyntaxKind.IfStatement)) as IfStatement[];

    // Process in reverse order to avoid position shifts
    for (let i = ifStatements.length - 1; i >= 0; i--) {
        const ifStatement = ifStatements[i];
        if (ifStatement.wasForgotten()) continue;

        // Flatten the nested if statements recursively
        const flattenIf = (ifStmt: IfStatement, parentCondition = ""): string => {
            const thenStatement = ifStmt.getThenStatement();
            const currentCondition = ifStmt.getExpression().getText();

            const combinedCondition = parentCondition
                ? `${parentCondition} && ${currentCondition}`
                : currentCondition;

            const nestedIfs: string[] = [];

            if (thenStatement.getKind() === SyntaxKind.Block) {
                const block = thenStatement as Block;
                const blockStatements = block.getStatements();

                for (const statement of blockStatements) {
                    if (statement.getKind() === SyntaxKind.IfStatement) {
                        const nestedIf = statement as IfStatement;
                        // Recursively flatten nested if statements
                        nestedIfs.push(flattenIf(nestedIf, combinedCondition));
                    }
                }
            }

            if (nestedIfs.length === 0) {
                return `if (${combinedCondition}) ${thenStatement.getText()}`;
            }

            return nestedIfs.join("\n");
        };

        // Call the inner flattening function and replace the original statement
        const flattenedIf = flattenIf(ifStatement);
        ifStatement.replaceWithText(flattenedIf);
    }
}


/**
 * Unroll a simple for loop.
 * @param forStatement The for loop to unroll.
 * @param vars The context of variable declarations.
 */
function unrollForLoop(forStatement: ForStatement, vars: varsContext) {
    // Get the loop initializer (e.g., `let i = 0`)
    const initializer = forStatement.getInitializer();
    if (!initializer || !initializer.isKind(SyntaxKind.VariableDeclarationList)) {
        conlog("Skipping complex initializer.");
        return;
    }

    const declarations = initializer.getDeclarations();
    if (declarations.length !== 1) {
        conlog("Skipping multi-variable initializer.");
        return;
    }

    // Get the variable name and initial value
    const loopVar = declarations[0].getName();
    let initialValue = declarations[0].getInitializer()?.getText() || "0";

    // Resolve initial value from context if it's a variable
    if (vars.has(initialValue)) {

        initialValue = vars.get(initialValue)!;
        // We explicitly check var.has. Eslint is wrong.
    }

    if (isNaN(Number(initialValue))) {
        conlog(`Skipping non-numeric initializer: ${initialValue}`);
        return;
    }

    let currentValue = Number(initialValue);

    // Get the loop condition (e.g., `i < 10`)
    const condition = forStatement.getCondition();
    if (!condition) {
        conlog("Skipping loop with no condition.");
        return;
    }

    // Ensure the loop boundary is numeric
    if (Node.isBinaryExpression(condition)) {
        const conditionValue = condition.getRight().getText();
        if (isNaN(Number(conditionValue))) {
            conlog(`Skipping loop with non-numeric boundary: ${conditionValue}`);
            return;
        }
    } else {
        conlog("Skipping loop with unsupported condition type.");
        return;
    }

    // Get the incrementor (e.g., `i++`, `i += 2`)
    const incrementor = forStatement.getIncrementor();
    if (!incrementor) {
        conlog("Skipping loop with no incrementor.");
        return;
    }

    const incrementText = incrementor.getText();
    let incrementValue = 1;

    if (incrementText.includes("++")) {
        incrementValue = 1;
    } else if (incrementText.includes("--")) {
        incrementValue = -1;
    } else if (incrementText.includes("+=")) {
        incrementValue = Number(incrementText.split("+=")[1]);
    } else if (incrementText.includes("-=")) {
        incrementValue = -Number(incrementText.split("-=")[1]);
    } else {
        conlog("Skipping unsupported incrementor.");
        return;
    }

    // Get body statements
    const statement = forStatement.getStatement();
    const bodyStatements = statement.isKind(SyntaxKind.Block)
        ? statement.getStatements()
        : [statement];

    conlog("Unrolling loop:", forStatement.getText());
    conlog("Loop Variable:", loopVar);
    conlog("Initial Value:", currentValue);
    conlog("Condition:", condition.getText());
    conlog("Incrementor:", incrementText);

    // Generate unrolled statements
    const unrolledStatements: string[] = [];

    // Evaluate the loop condition and unroll
    while (evaluateCondition(condition.getText(), loopVar, currentValue)) {
        bodyStatements.forEach(statement => {
            let statementText = statement.getText();

            // Replace the loop variable with its current value
            statementText = statementText.replace(new RegExp(`\\b${loopVar}\\b`, "g"), currentValue.toString());

            // Resolve any const variables in the statement
            vars.forEach((value, variable) => {
                statementText = statementText.replace(new RegExp(`\\b${variable}\\b`, "g"), value);
            });

            unrolledStatements.push(statementText);
        });

        // Increment the loop variable
        currentValue += incrementValue;
    }

    conlog("Unrolled Statements:");
    conlog(unrolledStatements.join("\n"));

    // Replace the original loop with unrolled statements
    forStatement.replaceWithText(unrolledStatements.join("\n"));
}

/**
 * Evaluate the loop condition by replacing the loop variable with its current value.
 *
 * Note: Uses `new Function()` which is similar to eval. This is acceptable here because:
 * - TBAF is a development tool that transpiles the user's own code
 * - Users already have full control over their development environment
 * - No untrusted input is being processed
 *
 * @param condition The loop condition as a string.
 * @param loopVar The loop variable.
 * @param currentValue The current value of the loop variable.
 * @returns Whether the condition evaluates to true.
 */
function evaluateCondition(condition: string, loopVar: string, currentValue: number): boolean {
    const sanitizedCondition = condition.replace(new RegExp(`\\b${loopVar}\\b`, "g"), currentValue.toString());
    try {
        const fn = new Function(`return (${sanitizedCondition});`);
        return fn();
    } catch (error) {
        conlog("Error evaluating condition:", sanitizedCondition, error);
        return false;
    }
}


/**
 * Export typescript code as BAF
 * @param sourceFile ts-morph source file
 * @param bafPath output BAF path
 * @param sourceName TBAF source name, to put into comment
 */
function exportBAF(sourceFile: SourceFile, bafPath: string, sourceName: string): void {
    let exportContent = `/* Do not edit. This file is generated from ${sourceName}. Make your changes there and regenerate this file. */\n\n`;

    // Traverse all IfStatements in the source file
    sourceFile.forEachDescendant((node) => {
        if (node.isKind(SyntaxKind.IfStatement)) {
            const ifStatement = node as IfStatement;
            const condition = ifStatement.getExpression().getText();
            const thenBlock = ifStatement.getThenStatement();

            // Handle the IF block
            exportContent += exportIfCondition(condition);

            // Handle the THEN block
            exportContent += "THEN\n";
            exportContent += "  RESPONSE #100\n";
            exportContent += exportThenBlock(thenBlock.getText());
            exportContent += "END\n\n"; // Newline after END
        }
    });

    exportContent = applyBAFhacks(exportContent);
    // Write the content to the specified file
    fs.writeFileSync(bafPath, exportContent, 'utf-8'); // Remove any extra trailing newlines
    conlog(`Content saved to ${bafPath}`);
}

/**
 * Apply final BAF hacks: GLOBAL, LOCALS, obj() replacement.
 */
function applyBAFhacks(text: string): string {
    let result = text.replace(/,\s*LOCALS/g, ', "LOCALS"');
    result = result.replace(/,\s*GLOBAL/g, ', "GLOBAL"');
    // obj specifier replacement: $obj("[ANYONE]") => [ANYONE]
    result = result.replace(/\$obj\("\[(.*?)\]"\)/g, '[$1]');
    // Also should work for death vars, so any string is accepted.
    result = result.replace(/\$obj\("(.*?)"\)/g, '"$1"');
    // $tra specifier replacement: $tra(number) => @number
    result = result.replace(/\$tra\((\d+)\)/g, '@$1');
    result = result.trim() + "\n";
    return result;
}


/**
 * Convert "if" condition to BAF format.
 * Remove &&, convert || to OR.
 */
function exportIfCondition(condition: string): string {
    let result = "IF\n";

    // Split on AND conditions first
    const andConditions = condition.split('&&');

    // Process each AND condition part
    andConditions.forEach((andCond) => {
        andCond = andCond.trim();

        // Handle negation (remove wrapping parentheses if negated condition has parentheses)
        // Shouldn't have complex conditions here... I think.
        if (andCond.startsWith('!') && andCond[1] === '(' && andCond.endsWith(')')) {
            andCond = `!${andCond.slice(2, -1).trim()}`;
        }

        // Step 2: Remove wrapping parentheses if the condition starts and ends with parentheses
        else if (andCond.startsWith('(') && andCond.endsWith(')')) {
            andCond = andCond.slice(1, -1).trim();
        }

        // Process OR block if the condition contains ||
        if (andCond.includes('||')) {
            const orConditions = andCond.split('||').map(cond => cond.trim());
            result += `  OR(${orConditions.length})\n`;
            orConditions.forEach((orCond) => {
                result += `    ${orCond}\n`; // No parentheses in OR block
            });
        } else {
            // Single condition case (no OR)
            result += `  ${andCond}\n`;
        }
    });

    return result;
}


/**
 * Convert "then" block to BAF format.
 * Remove curly braces and split statements.
 */
function exportThenBlock(body: string): string {
    let result = "";

    // Remove curly braces and split statements
    const cleanBody = body.replace(/[{}]/g, '').trim();
    const statements = cleanBody.split(';');

    // Process the statements in the THEN block
    statements.forEach(statement => {
        const trimmedStatement = statement.trim();
        if (trimmedStatement) {
            result += `    ${trimmedStatement}\n`; // No semicolon at the end
        }
    });

    return result;
}

/**
 * Simplifies conditions in the given source file by removing unnecessary parentheses.
 * Uses collect-then-transform pattern to avoid AST mutation during traversal.
 * @param sourceFile The source file to process.
 */
export function simplifyConditions(sourceFile: SourceFile) {
    // Collect all parenthesized expressions
    const parenExprs = sourceFile.getDescendantsOfKind(SyntaxKind.ParenthesizedExpression);

    // Process in reverse order to avoid position shifts
    for (let i = parenExprs.length - 1; i >= 0; i--) {
        const parenExpr = parenExprs[i];
        if (parenExpr.wasForgotten()) continue;
        tryRemoveParentheses(parenExpr);
    }
}

/**
 * Attempts to remove parentheses if they don't affect expression meaning.
 * @param parenExpr The parenthesized expression to examine.
 */
function tryRemoveParentheses(parenExpr: ParenthesizedExpression) {
    const innerExpr = parenExpr.getExpression();

    if (canSafelyRemoveParen(innerExpr, parenExpr)) {
        parenExpr.replaceWithText(innerExpr.getText());
    }
}

/**
 * Determines if parentheses around the expression can safely be removed.
 * Parentheses around expressions containing OR (`||`) must be kept.
 * Parentheses around expressions containing only AND (`&&`) can be removed.
 * Parentheses immediately under a prefix unary expression (`!`) must be kept.
 */
function canSafelyRemoveParen(expr: Node, parenExpr: ParenthesizedExpression): boolean {
    const parent = parenExpr.getParent();

    if (parent && Node.isPrefixUnaryExpression(parent)) {
        return false;
    }

    if (!Node.isBinaryExpression(expr)) return true;
    return !containsOrOperator(expr);
}

/**
 * Checks recursively if the binary expression contains any OR (`||`) operators.
 */
function containsOrOperator(expr: BinaryExpression): boolean {
    if (expr.getOperatorToken().getKind() === SyntaxKind.BarBarToken) return true;

    const left = expr.getLeft();
    const right = expr.getRight();

    return (
        (Node.isBinaryExpression(left) && containsOrOperator(left)) ||
        (Node.isBinaryExpression(right) && containsOrOperator(right))
    );
}

/**
 * Apply the transformations. Progressize inlining and unrolling, then else inversion and if flattening.
 */
function applyTransformations(sourceFile: SourceFile) {
    // Progressive unroll and inline
    const MAX_INTERATIONS = 100;
    for (let i = 0; i <= MAX_INTERATIONS; i++) {
        const previousCode = sourceFile.getFullText();


        // Open parentheses if possible
        simplifyConditions(sourceFile);

        // Progressive unroll and inline
        inlineUnroll(sourceFile);


        const currentCode = sourceFile.getFullText();
        if (currentCode === previousCode) break;

        if (i == MAX_INTERATIONS) {
            conlog("ERROR: reached max interactions, aborting!");
        }
    }

    // Convert else blocks to if statements with inverted conditions
    convertElseToIf(sourceFile);

    // Flatten nested if conditions
    flattenIfStatements(sourceFile);

    // So that BAF exporter does not see function bodies.
    removeFunctionDeclarations(sourceFile);

    // Prettify code
    sourceFile.formatText();
}


/**
 * Removes all function declarations from the given source file.
 * @param sourceFile The source file to modify.
 */
function removeFunctionDeclarations(sourceFile: SourceFile) {
    const functionDeclarations = sourceFile.getFunctions();

    functionDeclarations.forEach(func => {
        try {
            conlog(`Removing function: ${func.getName() || "anonymous"} at ${func.getStartLineNumber()}`);
            func.remove();
        } catch (error) {
            conlog(`Error removing function: ${func.getName() || "anonymous"}`, error);
        }
    });

    conlog(`Removed ${functionDeclarations.length} function(s).`);
}
