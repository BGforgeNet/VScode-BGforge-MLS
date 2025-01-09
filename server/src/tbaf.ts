import * as fs from "fs";
import * as path from "path";
import {
    Block,
    CallExpression,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    IfStatement,
    Project,
    SourceFile,
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
const TMP_COPIED = "tbaf.tmp.ts";

/**
 * Final TS code ends up here
 */
const TMP_FINAL = path.join(tmpDir, "tbaf-final.ts");

/**
 * Convert TBAF to BAF.
 * @param uri 
 * @returns 
 */
export async function compile(uri: string) {
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

    await bundle(filePath);

    const sourceFile = project.addSourceFileAtPath(TMP_BUNDLED);

    // Apply transformations
    applyTransformations(sourceFile);
    // Save the transformed file to the specified output file
    const finalTS = project.createSourceFile(TMP_FINAL, sourceFile.getText(), { overwrite: true });
    finalTS.saveSync();
    console.log(`\nTransformed code saved to ${TMP_FINAL}`);

    // Save to BAF file, same directory
    const dirName = path.parse(filePath).dir;
    const baseName = path.parse(filePath).name;
    const bafName = path.join(dirName, `${baseName}.baf`)
    exportBAF(finalTS, bafName);
}


/**
 * For tracking variable values in context
 */
type varsContext = Map<string, string>;
/**
 * Inline and unroll loops and other constructs.
 * @param sourceFile The source file to modify.
 */
/**
 * Inline and unroll loops and other constructs.
 * @param sourceFile The source file to modify.
 */
function inlineUnroll(sourceFile: SourceFile) {
    const functionDeclarations = sourceFile.getFunctions();
    const variablesContext: varsContext = new Map(); // Track const declarations

    sourceFile.forEachDescendant(node => {
        switch (node.getKind()) {
            // Collect const variables
            case SyntaxKind.VariableDeclaration:
                const variableDeclaration = node as VariableDeclaration;
                const parentDeclarationList = variableDeclaration.getParent() as VariableDeclarationList;

                if (parentDeclarationList.getDeclarationKind() === VariableDeclarationKind.Const) {
                    const name = variableDeclaration.getName();
                    const initializer = variableDeclaration.getInitializer()?.getText() || "undefined";
                    variablesContext.set(name, initializer);
                    console.log(`Collected const variable: ${name} = ${initializer}`);
                }
                break;

            // Unroll for...of loops
            case SyntaxKind.ForOfStatement:
                unrollForOfLoop(node as ForOfStatement, variablesContext);
                break;

            // Unroll for loops
            case SyntaxKind.ForStatement:
                unrollForLoop(node as ForStatement, variablesContext);
                break;

            // Handle function calls
            case SyntaxKind.CallExpression:
                const callExpr = node as CallExpression;
                const functionName = callExpr.getExpression().getText();

                // Check if it's a local function
                if (functionDeclarations.some(func => func.getName() === functionName)) {
                    inlineFunction(callExpr, functionDeclarations, variablesContext);
                } else {
                    substituteVariables(callExpr, variablesContext);
                }
                break;

            default:
                break;
        }
    });
}

/**
 * Substitute variables in non-local function calls using the provided variable context.
 * @param callExpression The call expression to substitute variables in.
 * @param vars The context of variable declarations.
 */
function substituteVariables(callExpression: CallExpression, vars: varsContext) {
    const args = callExpression.getArguments();

    args.forEach(arg => {
        const argText = arg.getText();

        if (vars.has(argText)) {
            const replacementValue = vars.get(argText)!;
            console.log(`Substituting ${argText} with ${replacementValue}`);
            arg.replaceWithText(replacementValue);
        }
    });
}


/**
 * Inline a local function call expression.
 * @param callExpression The call expression to inline.
 * @param functionDeclarations The list of local function declarations in the file.
 * @param vars The context of variable declarations.
 */
function inlineFunction(callExpression: CallExpression, functionDeclarations: FunctionDeclaration[], vars: varsContext) {
    const functionName = callExpression.getExpression().getText();

    // Find the corresponding local function declaration
    const functionDecl = functionDeclarations.find(func => func.getName() === functionName);
    if (!functionDecl) {
        console.log(`Skipping function: ${functionName}, not a local function.`);
        return;
    }

    // Get the function body and parameters
    const functionBody = functionDecl.getBody();
    if (!functionBody) return;

    const statements = functionBody.asKindOrThrow(SyntaxKind.Block).getStatements();

    // Map parameters to arguments
    const parameters = functionDecl.getParameters();
    const args = callExpression.getArguments();
    const paramArgMap = new Map<string, string>();

    parameters.forEach((param, index) => {
        const paramName = param.getName();
        let argText = args[index]?.getText() || param.getInitializer()?.getText() || "undefined";

        // Resolve variable value from context if it's a const variable
        if (vars.has(argText)) {
            argText = vars.get(argText)!;
        }

        paramArgMap.set(paramName, argText);
    });

    // Replace parameters in the function body
    let inlinedCode = statements.map(stmt => stmt.getText()).join("\n");
    paramArgMap.forEach((arg, param) => {
        const regex = new RegExp(`\\b${param}\\b`, "g");
        inlinedCode = inlinedCode.replace(regex, arg);
    });

    // Resolve any const variables in the inlined code
    vars.forEach((value, variable) => {
        const regex = new RegExp(`\\b${variable}\\b`, "g");
        inlinedCode = inlinedCode.replace(regex, value);
    });

    // Replace the parent statement if possible
    const parent = callExpression.getParent();
    if (parent && parent.isKind(SyntaxKind.ExpressionStatement)) {
        try {
            parent.replaceWithText(inlinedCode);
            console.log(`Successfully replaced ${functionName}() with inlined code.`);
        } catch (error) {
            console.error(`Error replacing ${functionName}():`, error);
        }
    } else {
        console.error(`Unable to replace ${functionName}() because it's not part of an expression statement.`);
    }
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

    console.log("Array Expression:", arrayExpression);

    // Check if the resolved array expression is a literal array
    const arrayLiteral = forOfStatement.getSourceFile().getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)
        .find(literal => literal.getText() === arrayExpression);

    if (!arrayLiteral) {
        console.log("Not a literal array, skipping...");
        return;
    }

    // Get loop variable name (e.g., `target` in `for (const target of players)`)
    const loopVariable = forOfStatement.getInitializer().getText().replace(/^const\s+/, '');
    console.log("Loop Variable:", loopVariable);

    // Get body statements inside the loop
    const statement = forOfStatement.getStatement();
    const bodyStatements = statement.isKind(SyntaxKind.Block)
        ? statement.getStatements()
        : [statement];

    console.log("Body Statements:");
    bodyStatements.forEach(stmt => console.log(stmt.getText()));

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

    console.log("Unrolled Statements:");
    console.log(unrolledStatements.join("\n"));

    // Replace the original loop with unrolled statements
    forOfStatement.replaceWithText(unrolledStatements.join("\n"));
}

/**
 * Bundle functions into temporary file with Rollup
 */
async function bundle(input: string) {
    input = getRelPath2(cwd(), input);  // Otherwise Rollup can't find includes
    const tmpInput = path.join(path.dirname(input), TMP_COPIED);
    fs.copyFileSync(input, tmpInput);
    const bundle = await rollup({
        input: tmpInput,
        external: id => /node_modules/.test(id),  // Exclude node_modules
        plugins: [
            typescript({
                declaration: false,
                tslib: require.resolve('../node_modules/tslib'),    // Otherwise Rollup won't even start
                target: "esnext",   // So that Rollup doesn't change syntax
                // include: "**/*.(ts|tbaf)",   // Doesn't work, TS compiler refuses to recognize tbaf, so we have to copy.
            })
        ]
    });

    await bundle.write({
        file: TMP_BUNDLED,
        format: 'esm',
    });

    console.log('Bundling complete!');
}


/**
 * Convert all ELSE statement to IF statements with inverted conditions, like BAF needs
 * @param sourceFile 
 */
function convertElseToIf(sourceFile: SourceFile) {
    console.log("Starting transformation on source file:", sourceFile.getFilePath());

    // Traverse all descendants to find if-else statements
    sourceFile.forEachDescendant((node) => {
        if (node.isKind(SyntaxKind.IfStatement)) {
            const ifStatement = node as IfStatement;
            const elseStatement = ifStatement.getElseStatement();

            console.log("Found if statement:", ifStatement.getText());
            if (elseStatement) {
                console.log("Found else statement:", elseStatement.getText());

                const ifCondition = ifStatement.getExpression().getText();
                console.log("Original condition:", ifCondition);

                // Create the original `if-0` block (unchanged `if` part)
                const if0Block = `if (${ifCondition}) ${ifStatement.getThenStatement().getText()}`;
                console.log("if-0 block:", if0Block);

                // Invert the `else` condition to create `if-1`
                const invertedCondition = invertCondition(ifCondition);
                console.log("Inverted condition for else block (if-1):", invertedCondition);

                const if1Block = `if (${invertedCondition}) ${elseStatement.getText()}`;
                console.log("if-1 block:", if1Block);

                // Combine `if-0` and `if-1` blocks
                const newIfBlock = `${if0Block}\n${if1Block}`;
                console.log("Combined new if block (if-0 + if-1):\n", newIfBlock);

                // Replace the original if-else block with the new combined block
                ifStatement.replaceWithText(newIfBlock);
                console.log("Replaced original if-else block with new combined if block.");
            }
        }
    });

    console.log("Transformation completed.");
}

/**
 * Invert logical condition. Only supports simple conditions, without nesting.
 * @param condition Logical condition from an IF statement
 * @returns inverted condition text
 */
function invertCondition(condition: string): string {
    console.log("Inverting condition:", condition);

    // Handle cases with '&&' and '||' (De Morgan's law)
    if (condition.includes('&&')) {
        return condition
            .split('&&')
            .map(part => `!(${part.trim()})`)
            .join(' || ');
    }

    if (condition.includes('||')) {
        return condition
            .split('||')
            .map(part => `!(${part.trim()})`)
            .join(' && ');
    }

    // For simple conditions (without && or ||), just negate it
    return `!(${condition.trim()})`;
}

/**
 * Single function to flatten all nested if statements in the source file
 * @param sourceFile 
 */
function flattenIfStatements(sourceFile: SourceFile) {
    // Iterate over all statements in the source file
    sourceFile.getStatements().forEach(statement => {
        if (statement.isKind(SyntaxKind.IfStatement)) {
            const ifStatement = statement as IfStatement;

            // Flatten the nested if statements recursively
            const flattenIf = (ifStatement: IfStatement, parentCondition = ""): string => {
                const thenStatement = ifStatement.getThenStatement();
                const currentCondition = ifStatement.getExpression().getText();

                const combinedCondition = parentCondition
                    ? `${parentCondition} && ${currentCondition}`
                    : currentCondition;

                const nestedIfs: string[] = [];

                if (thenStatement.getKind() === SyntaxKind.Block) {
                    const block = thenStatement as Block;
                    const blockStatements = block.getStatements();

                    blockStatements.forEach(statement => {
                        if (statement.getKind() === SyntaxKind.IfStatement) {
                            const nestedIf = statement as IfStatement;
                            // Recursively flatten nested if statements
                            nestedIfs.push(flattenIf(nestedIf, combinedCondition));
                        }
                    });
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
    });
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
        console.log("Skipping complex initializer.");
        return;
    }

    const declarations = initializer.getDeclarations();
    if (declarations.length !== 1) {
        console.log("Skipping multi-variable initializer.");
        return;
    }

    // Get the variable name and initial value
    const loopVar = declarations[0].getName();
    let initialValue = declarations[0].getInitializer()?.getText() || "0";

    // Resolve initial value from context if it's a variable
    if (vars.has(initialValue)) {
        initialValue = vars.get(initialValue)!;
    }

    if (isNaN(Number(initialValue))) {
        console.log(`Skipping non-numeric initializer: ${initialValue}`);
        return;
    }

    let currentValue = Number(initialValue);

    // Get the loop condition (e.g., `i < 10`)
    const condition = forStatement.getCondition();
    if (!condition) {
        console.log("Skipping loop with no condition.");
        return;
    }

    // Get the incrementor (e.g., `i++`, `i += 2`)
    const incrementor = forStatement.getIncrementor();
    if (!incrementor) {
        console.log("Skipping loop with no incrementor.");
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
        console.log("Skipping unsupported incrementor.");
        return;
    }

    // Get body statements
    const statement = forStatement.getStatement();
    const bodyStatements = statement.isKind(SyntaxKind.Block)
        ? statement.getStatements()
        : [statement];

    console.log("Unrolling loop:", forStatement.getText());
    console.log("Loop Variable:", loopVar);
    console.log("Initial Value:", currentValue);
    console.log("Condition:", condition.getText());
    console.log("Incrementor:", incrementText);

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

    console.log("Unrolled Statements:");
    console.log(unrolledStatements.join("\n"));

    // Replace the original loop with unrolled statements
    forStatement.replaceWithText(unrolledStatements.join("\n"));
}

/**
 * Evaluate the loop condition by replacing the loop variable with its current value.
 */
function evaluateCondition(condition: string, loopVar: string, currentValue: number): boolean {
    const replacedCondition = condition.replace(new RegExp(`\\b${loopVar}\\b`, "g"), currentValue.toString());
    try {
        return eval(replacedCondition);
    } catch {
        console.error("Error evaluating condition:", replacedCondition);
        return false;
    }
}


/**
 * Export typescript code as BAF
 */
function exportBAF(sourceFile: SourceFile, filePath: string): void {
    let exportContent = "";

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
    fs.writeFileSync(filePath, exportContent, 'utf-8'); // Remove any extra trailing newlines
    console.log(`Content saved to ${filePath}`);
}

/**
 * Apply final BAF hacks: GLOBAL, LOCALS, obj() replacement.
 */
function applyBAFhacks(text: string): string {
    let result = text.replace(/, LOCALS/g, ', "LOCALS"');
    result = result.replace(/, GLOBAL,/g, ', "GLOBAL"');
    // obj specifier replacement: obj("[ANYONE]") => [ANYONE]
    result = result.replace(/obj\("\[(.*?)\]"\)/g, '[$1]');
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

        // Step 2: Remove wrapping parentheses if the condition starts and ends with parentheses
        if (andCond.startsWith('(') && andCond.endsWith(')')) {
            andCond = andCond.slice(1, -1).trim(); // Remove outer parentheses
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

    // Ensure no nested if or unsupported blocks
    if (body.includes('if')) {
        throw new Error("Nested if statements are not allowed.");
    }

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
 * Apply the transformations. Progressize inlining and unrolling, then else inversion and if flattening.
 */
function applyTransformations(sourceFile: SourceFile) {
    // Progressive unroll and inline
    const MAX_INTERATIONS = 100;
    for (let i = 0; i <= MAX_INTERATIONS; i++) {
        const previousCode = sourceFile.getFullText();

        // Progressive unroll and inline
        inlineUnroll(sourceFile);

        const currentCode = sourceFile.getFullText();
        if (currentCode === previousCode) break;

        if (i == MAX_INTERATIONS) {
            console.log("ERROR: reached max interactions, aborting!");
        }
    }

    // Convert else blocks to if statements with inverted conditions
    convertElseToIf(sourceFile);

    // Flatten nested if conditions
    flattenIfStatements(sourceFile);

    // Prettify code
    sourceFile.formatText();
}
