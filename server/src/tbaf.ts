import * as fs from "fs";
import * as path from "path";
import {
    Block,
    CallExpression,
    ForStatement,
    FunctionDeclaration,
    IfStatement,
    Project,
    SourceFile,
    Statement,
    SyntaxKind,
    VariableDeclaration
} from 'ts-morph';
import { conlog, tmpDir, uriToPath } from "./common";
import { connection } from "./server";

export const EXT_TBAF = ".tbaf";

// Initialize the TypeScript project
const project = new Project();

/**
 * Convert TBAF to BAF.
 * @param uri 
 * @returns 
 */
export function compile(uri: string) {
    const filePath = uriToPath(uri);
    let ext = path.parse(filePath).ext;
    ext = ext.toLowerCase();
    if (ext != EXT_TBAF) {
        conlog(`${uri} is not a .tbaf file, cannot process!`);
        connection.window.showInformationMessage(`${uri} is not a .tbaf file, cannot process!`);
        return;
    }

    // Re-read the file. Otherwise TSM uses a cached copy.
    const existingFile = project.getSourceFile(filePath);
    if (existingFile) {
        project.removeSourceFile(existingFile);
    }

    const sourceFile = project.addSourceFileAtPath(filePath);
    const tmpFile = path.join(tmpDir, "tmp-baf.ts");

    // Apply transformations
    applyTransformations(sourceFile);
    // Save the transformed file to the specified output file
    project.createSourceFile(tmpFile, sourceFile.getText(), { overwrite: true }).saveSync();
    console.log(`\nTransformed code saved to ${tmpFile}`);

    // Save to BAF file, same directory
    const dirName = path.parse(filePath).dir;
    const baseName = path.parse(filePath).name;
    const bafName = path.join(dirName, `${baseName}.baf`)
    exportBAF(sourceFile, bafName);
}

/**
 * Function to replace parameters with arguments in the function body, supporting default values
 * @param func TS-morph function declaration
 * @param args 
 * @returns body text with substituted arguments
 */
function substituteParameters(func: FunctionDeclaration, args: string[]): string {
    const parameters = func.getParameters();
    let bodyText = func.getBodyText() || '';

    // Replace each parameter with the corresponding argument or default value
    parameters.forEach((param, index) => {
        const paramName = param.getName();
        const argument = args[index];

        // Get the default value, if any
        const defaultValue = param.getInitializer()?.getText() || '';

        // If the argument is undefined, use the default value
        const valueToSubstitute = argument !== undefined ? argument : defaultValue;

        // Word boundary regex to safely replace the parameter name
        const regex = new RegExp(`\\b${paramName}\\b`, 'g');
        bodyText = bodyText.replace(regex, valueToSubstitute);
    });

    return bodyText;
}

/**
 * Helper function to clean up extra trailing semicolons after inlining functions
 */
function removeTrailingSemicolon(inlinedBody: string): string {
    if (inlinedBody.endsWith(";;")) {
        return inlinedBody.slice(0, -1);
    }
    return inlinedBody;
}

/**
 * Function to inline function calls, supporting local imports and default parameter values
 * @param sourceFile 
 */
function inlineFunctionCalls(sourceFile: SourceFile) {
    const functionDeclarations = sourceFile.getFunctions(); // Local functions
    const importDeclarations = sourceFile.getImportDeclarations(); // Imported functions

    // Step 1: Resolve all local named imports
    const importedFunctions: { [key: string]: FunctionDeclaration } = {};

    importDeclarations.forEach(importDecl => {
        let importPath = importDecl.getModuleSpecifier().getText().replace(/['"]/g, ''); // Clean up import path

        // Skip non-local (e.g., `node_modules`) imports
        // Check if the import is a local file (starts with './' or '../')
        if (!importPath.startsWith('.')) {
            return;
        }

        // Ensure the file extension is added if it's missing
        if (!importPath.endsWith('.ts')) {
            importPath += '.ts';
        }

        // Construct the absolute path using the sourceFile's directory
        const sourceDir = sourceFile.getDirectoryPath();
        const resolvedImportPath = path.resolve(sourceDir, importPath); // Resolve the full path

        console.log(`Attempting to resolve: ${resolvedImportPath}`); // Log the resolved path

        // Try to add the file to the project if it's not already present
        let importedFile: SourceFile | undefined = sourceFile.getProject().getSourceFile(resolvedImportPath);
        if (!importedFile) {
            try {
                // Add the file to the project
                importedFile = sourceFile.getProject().addSourceFileAtPath(resolvedImportPath);
            } catch (error) {
                conlog(`Failed to open file: ${resolvedImportPath}. Error: ${error}`);
                connection.window.showInformationMessage(`Failed to open file: ${resolvedImportPath}. Error: ${error}`);
                return;
            }
        }

        // Process the named imports
        const namedImports = importDecl.getNamedImports();
        namedImports.forEach(namedImport => {
            const functionName = namedImport.getName();

            // Try to find the function in the imported file
            const importedFunc = importedFile.getFunction(functionName);
            if (!importedFunc) {
                conlog(`Failed to find function declaration for ${functionName} in ${resolvedImportPath}`);
                connection.window.showInformationMessage(`Failed to find function declaration for ${functionName} in ${resolvedImportPath}`);
                return;
            }

            // Store the imported function for later inlining
            importedFunctions[functionName] = importedFunc;
        });
    });

    // Step 2: For each call expression, inline only if the function is local or imported
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
        const callExpression = callExpr as CallExpression;
        const functionName = callExpression.getExpression().getText();

        // Check if the function is locally defined or imported
        let functionDecl = functionDeclarations.find(func => func.getName() === functionName);
        if (!functionDecl) {
            functionDecl = importedFunctions[functionName]; // Check for imported function
        }

        // Inline only if the function is defined or imported
        if (functionDecl) {
            const args = callExpression.getArguments().map(arg => arg.getText());
            let inlinedBody = substituteParameters(functionDecl, args);
            inlinedBody = removeTrailingSemicolon(inlinedBody);

            const parent = callExpression.getParent();
            if (parent && parent.getKind() === SyntaxKind.ExpressionStatement) {
                parent.replaceWithText(inlinedBody);
            } else {
                callExpression.replaceWithText(inlinedBody);
            }
        } else {
            // Skip global or undefined functions (like "See", "Spell", etc.)
            console.log(`Skipping function: ${functionName}, not defined or imported.`);
        }
    });

    // Step 3: Remove all function declarations after inlining
    functionDeclarations.forEach(func => func.remove());

    // Step 4: Remove import declarations if all imported functions are inlined
    importDeclarations.forEach(importDecl => {
        const namedImports = importDecl.getNamedImports();
        const allFunctionsInlined = namedImports.every(namedImport => !!importedFunctions[namedImport.getName()]);

        if (allFunctionsInlined) {
            importDecl.remove();
        }
    });
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
 * Helper function to process a for loop and generate unrolled code
 * @param forStatement 
 * @returns 
 */
function processForLoop(forStatement: ForStatement): string | null {
    const initializer = forStatement.getInitializer();
    const condition = forStatement.getCondition();
    const incrementor = forStatement.getIncrementor();
    const loopBody = forStatement.getStatement();

    if (initializer && condition && incrementor) {
        const initText = initializer.getText();
        const conditionText = condition.getText();
        const incrementorText = incrementor.getText();

        // Match variable declaration like `let i = 0`
        const loopVarMatch = /let\s+(\w+)\s*=\s*(\d+)/.exec(initText);
        const conditionMatch = /(\w+)\s*<\s*(\d+)/.exec(conditionText); // For `i < 10`

        if (loopVarMatch && conditionMatch) {
            const loopVar = loopVarMatch[1];
            const startValue = parseInt(loopVarMatch[2]);
            const endValue = parseInt(conditionMatch[2]);

            // Determine the increment (supports i++, i--, i += 2, etc.)
            const step = getStepFromIncrementor(incrementorText);

            if (step !== null) {
                return generateUnrolledCode(loopVar, startValue, endValue, step, loopBody);
            }
        }
    }

    return null;
}

/**
 * Function to determine the step of the loop (i++, i--, i += 2, etc.)
 * @param incrementorText 
 * @returns 
 */
function getStepFromIncrementor(incrementorText: string): number | null {
    if (incrementorText.includes('++')) {
        return 1;
    } else if (incrementorText.includes('--')) {
        return -1;
    } else {
        const incrementMatch = /\w+\s*\+=\s*(\d+)/.exec(incrementorText);
        if (incrementMatch) {
            return parseInt(incrementMatch[1]);
        }
    }
    return null; // No valid step found
}

/**
 * Function to generate unrolled code from a loop
 * @param loopVar 
 * @param startValue 
 * @param endValue 
 * @param step 
 * @param loopBody 
 * @returns 
 */
function generateUnrolledCode(loopVar: string, startValue: number, endValue: number, step: number, loopBody: Statement): string {
    let unrolledCode = '';

    for (let i = startValue; (step > 0 ? i < endValue : i > endValue); i += step) {
        if (loopBody instanceof Block) {
            // If loop body is a block, handle the statements inside it
            loopBody.getStatements().forEach(innerStatement => {
                if (innerStatement.isKind(SyntaxKind.ForStatement)) {
                    // Recursively unroll nested loops
                    const innerUnrolled = processForLoop(innerStatement as ForStatement);
                    if (innerUnrolled) {
                        unrolledCode += innerUnrolled.replace(new RegExp(`\\b${loopVar}\\b`, 'g'), i.toString()) + '\n';
                    }
                } else {
                    // Replace loop variable in the loop body
                    const newBodyText = innerStatement.getText().replace(new RegExp(`\\b${loopVar}\\b`, 'g'), i.toString());
                    unrolledCode += newBodyText + '\n';
                }
            });
        } else {
            // If loop body is a single statement, replace loop variable directly
            const newBodyText = loopBody.getText().replace(new RegExp(`\\b${loopVar}\\b`, 'g'), i.toString());
            unrolledCode += newBodyText + '\n';
        }
    }

    return unrolledCode.trim();
}

/**
 *  Function to substitute variable values in function calls and for loops conditions (right side only).
 * @param sourceFile 
 */
function substituteVariables(sourceFile: SourceFile) {
    // Step 1: Collect all constant variable declarations and store in a map
    const constValuesMap: Map<string, string> = new Map();

    // Find all `const` declarations and store their values in the map
    sourceFile.forEachDescendant((node) => {
        if (node.isKind(SyntaxKind.VariableDeclaration)) {
            const declaration = node as VariableDeclaration;
            const declarationList = declaration.getParentIfKind(SyntaxKind.VariableDeclarationList);

            // Check if the variable is declared as 'const'
            if (declarationList && declarationList.getDeclarationKind() === "const") {
                const identifier = declaration.getName();
                const initializer = declaration.getInitializer()?.getText();

                if (initializer) {
                    constValuesMap.set(identifier, initializer);
                }
                declaration.remove();
            }
        }
    });

    // Step 2: Traverse for loops and substitute variables in conditions
    sourceFile.forEachDescendant((node) => {
        if (node.isKind(SyntaxKind.ForStatement)) {
            const forStatement = node as ForStatement;

            // Get the condition of the for loop (e.g. i < iterations)
            const condition = forStatement.getCondition();
            if (condition && condition.isKind(SyntaxKind.BinaryExpression)) {
                const rightSide = condition.getRight();

                // Check if the right side is an identifier and replace if found in the map
                if (rightSide.isKind(SyntaxKind.Identifier)) {
                    const rightSideText = rightSide.getText();
                    if (constValuesMap.has(rightSideText)) {
                        const value = constValuesMap.get(rightSideText);
                        // shouldn't be necessary, but for some reason TS complains about undefined.
                        if (value) {
                            // Replace the identifier with the constant value
                            rightSide.replaceWithText(value);
                        }
                    }
                }
            }
        }
    });

    // Step 3: Traverse function calls and substitute variables in arguments
    sourceFile.forEachDescendant((node) => {
        if (node.isKind(SyntaxKind.CallExpression)) {
            const callExpression = node as CallExpression;

            // Get all the arguments in the function call
            const args = callExpression.getArguments();

            args.forEach((arg) => {
                if (arg.isKind(SyntaxKind.Identifier)) {
                    const argText = arg.getText();

                    // Check if the argument is a variable in constValuesMap
                    if (constValuesMap.has(argText)) {
                        const value = constValuesMap.get(argText);
                        // Shouldn't be necessary, but for some reason TS complains about undefined.
                        if (value) {
                            // Replace the argument with the constant value
                            arg.replaceWithText(value);

                        }
                    }
                }
            });
        }
    });
}

/**
 * Unroll all for loops.
 * @param sourceFile 
 */
function unrollForLoops(sourceFile: SourceFile) {
    sourceFile.forEachDescendant((node) => {
        if (node.isKind(SyntaxKind.ForStatement)) {
            // Call the recursive function to unroll the loop
            console.log("Unrolling outer loop:", node.getText());
            unrollForLoop(node as ForStatement);
        }
    });
}

/**
 * Unroll a for loop recursively.
 * @param forStatement 
 */
function unrollForLoop(forStatement: ForStatement) {
    const initializer = forStatement.getInitializer();
    const condition = forStatement.getCondition();
    const incrementor = forStatement.getIncrementor();
    const statementBody = forStatement.getStatement();

    // Ensure this is a simple for loop with a constant limit and i++ or i--
    if (initializer?.isKind(SyntaxKind.VariableDeclarationList) &&
        condition?.isKind(SyntaxKind.BinaryExpression) &&
        incrementor?.isKind(SyntaxKind.PostfixUnaryExpression)) {

        const variableDeclaration = initializer.getDeclarations()[0];
        const loopVar = variableDeclaration.getName(); // The loop variable (e.g., i)
        const startValue = variableDeclaration.getInitializer()?.getText(); // The starting value (e.g., 0)
        const endCondition = condition.getRight().getText(); // The end condition value (e.g., 3)
        const incrementOperator = incrementor.getOperatorToken(); // Check if it's ++ or --

        console.log(`Unrolling loop for variable ${loopVar}, from ${startValue} to ${endCondition}`);

        if (startValue !== undefined && !isNaN(Number(startValue)) && !isNaN(Number(endCondition))) {
            const start = Number(startValue);
            const end = Number(endCondition);

            // Generate unrolled loop body
            let unrolledBody = '';

            // Check if the loop body contains another for loop
            statementBody.forEachDescendant((innerNode) => {
                if (innerNode.isKind(SyntaxKind.ForStatement)) {
                    console.log("Found nested loop:", innerNode.getText());
                    // Recursively unroll the inner loop
                    unrollForLoop(innerNode as ForStatement);
                }
            });

            const loopStatements = statementBody.getText().replace(/^{|}$/g, '').trim();
            console.log("Loop body to unroll (before replacement):", loopStatements);

            // Handle i++ case
            if (incrementOperator === SyntaxKind.PlusPlusToken) {
                for (let i = start; i < end; i++) {
                    // Replace the loop variable (e.g., i) with the current value (e.g., 0, 1, 2)
                    const iterationBody = loopStatements.replace(new RegExp(`\\b${loopVar}\\b`, 'g'), i.toString());
                    console.log(`Unrolled iteration for ${loopVar} = ${i}:`, iterationBody);
                    unrolledBody += iterationBody + '\n'; // No extra indentation
                }
            }
            // Handle i-- case
            else if (incrementOperator === SyntaxKind.MinusMinusToken) {
                for (let i = start; i > end; i--) {
                    // Replace the loop variable (e.g., i) with the current value (e.g., 2, 1, 0)
                    const iterationBody = loopStatements.replace(new RegExp(`\\b${loopVar}\\b`, 'g'), i.toString());
                    console.log(`Unrolled iteration for ${loopVar} = ${i}:`, iterationBody);
                    unrolledBody += iterationBody + '\n'; // No extra indentation
                }
            }

            console.log("Final unrolled body:", unrolledBody);
            // Replace the original for loop with the unrolled body
            forStatement.replaceWithText(unrolledBody.trim());
        }
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
 * Apply the transformations (inlining, flattening, and unrolling) in order.
 */
function applyTransformations(sourceFile: SourceFile) {
    substituteVariables(sourceFile);

    // Inline function calls
    inlineFunctionCalls(sourceFile);

    // Convert else blocks to if statements with inverted conditions
    convertElseToIf(sourceFile);

    // Flatten nested if conditions
    flattenIfStatements(sourceFile);

    // Process for loops
    unrollForLoops(sourceFile);

    // Prettify code
    sourceFile.formatText();
}
