/**
 * Rename symbol for WeiDU TP2 files.
 * Supports:
 * - Variables (OUTER_SET, OUTER_TEXT_SPRINT, SET, TEXT_SPRINT)
 * - Function parameters (INT_VAR, STR_VAR, RET, RET_ARRAY)
 * - Loop variables (PHP_EACH key/value vars, FOR_EACH vars)
 * - Functions/Macros (DEFINE_*_FUNCTION, DEFINE_*_MACRO)
 *
 * WeiDU variables are globally scoped across files via INCLUDE.
 * This implementation renames within single file only - cross-file references won't be updated.
 */

import { Position, TextEdit, WorkspaceEdit } from "vscode-languageserver/node";
import type { Node as SyntaxNode } from "web-tree-sitter";
import { getParser, isInitialized } from "./parser";
import { SyntaxType } from "./tree-sitter.d";
import {
    VARIABLE_DECL_TYPES,
    STRING_CONTENT_TYPES,
    FUNCTION_DEF_TYPES,
    LOOP_TYPES,
    findContainingFunction,
    findContainingLoop,
    determineVariableScope,
    isLoopVariable,
    findVariableInStringContent,
    matchesSymbol,
} from "./variable-symbols";
import { findNodeAtPosition, findAncestorOfType, isSameNode, stripStringDelimiters } from "./tree-utils";

// ============================================
// Constants
// ============================================

/** Automatic variables that should not be renamed. */
const AUTOMATIC_VARIABLES: ReadonlySet<string> = new Set([
    "SOURCE_FILE",
    "SOURCE_RES",
    "SOURCE_EXT",
    "SOURCE_DIRECTORY",
    "DEST_FILE",
    "DEST_RES",
    "DEST_EXT",
    "DEST_DIRECTORY",
    "COMPONENT_NUMBER",
    "TP2_FILE_NAME",
    "TP2_BASE_NAME",
    "LANGUAGE",
]);

/** Node types for function/macro calls. */
const FUNCTION_CALL_TYPES: ReadonlySet<SyntaxType> = new Set([
    SyntaxType.ActionLaunchFunction,
    SyntaxType.ActionLaunchMacro,
    SyntaxType.PatchLaunchFunction,
    SyntaxType.PatchLaunchMacro,
]);

// ============================================
// Types
// ============================================

interface SymbolInfo {
    name: string;
    kind: "variable" | "function";
    scope: "file" | "function" | "loop";
    functionNode?: SyntaxNode; // For function-scoped variables
    loopNode?: SyntaxNode; // For loop-scoped variables (PHP_EACH, FOR_EACH)
    node: SyntaxNode; // The node where the symbol was found
}

interface SymbolOccurrence {
    node: SyntaxNode;
    isDefinition: boolean;
}

/**
 * Synthetic node created for %var% references found in string content.
 * These are not part of the grammar but are created programmatically
 * to represent variable references within strings for rename operations.
 */
interface SyntheticPercentVarNode {
    type: "synthetic_percent_var";
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    children: [];
    parent: SyntaxNode;
}

// ============================================
// Main entry point
// ============================================

/**
 * Prepares for rename by validating the position and returning the range and placeholder.
 * Returns null if rename is not allowed at this position.
 */
export function prepareRenameSymbol(
    text: string,
    position: Position
): { range: { start: Position; end: Position }; placeholder: string } | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return null;
    }

    // Find the symbol at the cursor position
    const symbolInfo = getSymbolAtPosition(tree.rootNode, position);
    if (!symbolInfo) {
        return null;
    }

    // Check if the symbol can be renamed
    if (!isRenameableSymbol(symbolInfo)) {
        return null;
    }

    // Check if the symbol has a definition in the current file
    // Allow rename from any position (definition or reference), but reject if symbol is external
    const occurrences = findAllReferences(tree.rootNode, symbolInfo);
    const hasLocalDefinition = occurrences.some(occ => occ.isDefinition);
    if (!hasLocalDefinition) {
        return null; // Symbol is not defined in this file
    }

    // Return the range and placeholder
    return {
        range: {
            start: { line: symbolInfo.node.startPosition.row, character: symbolInfo.node.startPosition.column },
            end: { line: symbolInfo.node.endPosition.row, character: symbolInfo.node.endPosition.column },
        },
        placeholder: symbolInfo.name,
    };
}

/**
 * Rename a symbol at the given position.
 * Returns null if the symbol cannot be renamed.
 */
export function renameSymbol(
    text: string,
    position: Position,
    newName: string,
    uri: string
): WorkspaceEdit | null {
    if (!isInitialized()) {
        return null;
    }

    const tree = getParser().parse(text);
    if (!tree) {
        return null;
    }

    // Find the symbol at the cursor position
    const symbolInfo = getSymbolAtPosition(tree.rootNode, position);
    if (!symbolInfo) {
        return null;
    }

    // Check if the symbol can be renamed
    if (!isRenameableSymbol(symbolInfo)) {
        return null;
    }

    // Find all occurrences of the symbol
    const occurrences = findAllReferences(tree.rootNode, symbolInfo);
    if (occurrences.length === 0) {
        return null;
    }

    // Check if the symbol has a definition in the current file
    // Allow rename from any position (definition or reference), but reject if symbol is external
    const hasLocalDefinition = occurrences.some(occ => occ.isDefinition);
    if (!hasLocalDefinition) {
        return null; // Symbol is not defined in this file
    }

    // Create text edits for all occurrences
    const edits: TextEdit[] = occurrences.map((occ) => {
        const node = occ.node;
        // For synthetic %var% nodes in string content, wrap the new name with %
        // For percent_string nodes (%var% in expressions), they already have % so wrap as well
        // Note: synthetic_percent_var is a custom type created for string content parsing, not in grammar
        const SYNTHETIC_PERCENT_VAR = "synthetic_percent_var";
        const isSyntheticPercentVar = node.type === SYNTHETIC_PERCENT_VAR;
        const isPercentString = node.type === SyntaxType.PercentString;
        const needsPercentWrapper = isSyntheticPercentVar || isPercentString;

        // For macro/function names that are strings, preserve the delimiters
        const isStringName = (
            node.type === SyntaxType.String ||
            node.type === SyntaxType.TildeString ||
            node.type === SyntaxType.DoubleString ||
            node.type === SyntaxType.FiveTildeString
        ) && symbolInfo.kind === "function";

        let editText: string;
        if (needsPercentWrapper) {
            editText = `%${newName}%`;
        } else if (isStringName) {
            // Preserve the original string delimiters
            const originalText = node.text;
            const firstChar = originalText[0];
            const lastChar = originalText[originalText.length - 1];
            if (firstChar === "~" && lastChar === "~") {
                editText = `~${newName}~`;
            } else if (firstChar === '"' && lastChar === '"') {
                editText = `"${newName}"`;
            } else {
                editText = originalText; // Keep original format if we can't detect delimiters
            }
        } else {
            editText = newName;
        }

        return {
            range: makeRange(node),
            newText: editText,
        };
    });

    return {
        changes: {
            [uri]: edits,
        },
    };
}

// ============================================
// Symbol finding
// ============================================

/**
 * Get symbol information at the given position.
 */
function getSymbolAtPosition(root: SyntaxNode, position: Position): SymbolInfo | null {
    // Find the node at the position
    let node = findNodeAtPosition(root, position);
    if (!node) {
        return null;
    }

    // If we found a % token, check if it's part of a percent_string
    // This happens when cursor is right on the % delimiter
    // Note: "%" is a terminal token in the grammar, not a SyntaxType enum value
    const PERCENT_TOKEN = "%";
    if (node.type === PERCENT_TOKEN) {
        const parent = node.parent;
        if (parent && parent.type === SyntaxType.PercentString) {
            node = parent;
        }
    }

    // Check if it's a percent_string or percent_content node inside %var% syntax
    if (node.type === SyntaxType.PercentString) {
        // Get the percent_content child
        const contentNode = node.child(1); // percent_string = "%" + content + "%"
        if (contentNode && contentNode.type === SyntaxType.PercentContent) {
            const name = contentNode.text;
            if (!name) {
                return null;
            }

            // Determine the scope for this variable
            const scopeInfo = determineVariableScope(name, node);

            return {
                name,
                kind: "variable",
                scope: scopeInfo.scope,
                functionNode: scopeInfo.functionNode,
                loopNode: scopeInfo.loopNode,
                node,  // Return the percent_string node
            };
        }
    }

    if (node.type === SyntaxType.PercentContent) {
        const name = node.text; // Already without the % delimiters
        if (!name) {
            return null;
        }

        // Determine the scope for this variable
        const scopeInfo = determineVariableScope(name, node);

        return {
            name,
            kind: "variable",
            scope: scopeInfo.scope,
            functionNode: scopeInfo.functionNode,
            loopNode: scopeInfo.loopNode,
            node: node.parent && node.parent.type === SyntaxType.PercentString ? node.parent : node,
        };
    }

    // String content nodes (tilde_content, double_content, etc.) can contain either:
    // 1. %var% variable references - handled here, returns early if found
    // 2. Function/macro names like ~my_macro~ - handled in the second STRING_CONTENT_TYPES check below
    if (STRING_CONTENT_TYPES.has(node.type as SyntaxType)) {
        const varMatch = findVariableInStringContent(node, position);
        if (varMatch) {
            const scopeInfo = determineVariableScope(varMatch, node);
            return {
                name: varMatch,
                kind: "variable",
                scope: scopeInfo.scope,
                functionNode: scopeInfo.functionNode,
                loopNode: scopeInfo.loopNode,
                node,
            };
        }
        // No %var% found at cursor - fall through to check for function/macro names below
    }

    // Check if it's a variable_ref node (bare identifier in expression like `param + 1`)
    if (node.type === SyntaxType.VariableRef) {
        // variable_ref contains an identifier child
        const identNode = node.child(0);
        const name = identNode?.text;
        if (!name) {
            return null;
        }

        // Determine the scope for this variable
        const scopeInfo = determineVariableScope(name, node);

        return {
            name,
            kind: "variable",
            scope: scopeInfo.scope,
            functionNode: scopeInfo.functionNode,
            loopNode: scopeInfo.loopNode,
            node: identNode,
        };
    }

    // String content that's a function/macro name (e.g., ~my_macro~ in DEFINE_PATCH_MACRO ~my_macro~)
    // Only reached if the earlier STRING_CONTENT_TYPES check found no %var% at cursor
    if (STRING_CONTENT_TYPES.has(node.type as SyntaxType)) {
        const stringNode = node.parent;
        // Parent can be any string type: string, tilde_string, double_string, etc.
        if (stringNode && (
            stringNode.type === SyntaxType.String ||
            stringNode.type === SyntaxType.TildeString ||
            stringNode.type === SyntaxType.DoubleString ||
            stringNode.type === SyntaxType.FiveTildeString
        )) {
            // Check if this string is used as a function/macro name
            const funcDef = findAncestorOfType(stringNode, FUNCTION_DEF_TYPES);
            if (funcDef) {
                const nameNode = funcDef.childForFieldName("name");
                if (nameNode && isSameNode(nameNode, stringNode)) {
                    const name = node.text; // Content without delimiters
                    return {
                        name,
                        kind: "function",
                        scope: "file",
                        node: stringNode, // Return the string node, not the content
                    };
                }
            }

            const funcCall = findAncestorOfType(stringNode, FUNCTION_CALL_TYPES);
            if (funcCall) {
                const nameNode = funcCall.childForFieldName("name");
                if (nameNode && isSameNode(nameNode, stringNode)) {
                    const name = node.text; // Content without delimiters
                    return {
                        name,
                        kind: "function",
                        scope: "file",
                        node: stringNode, // Return the string node, not the content
                    };
                }
            }
        }
    }

    // Check if it's an identifier or string (strings are used for macro names)
    if (node.type === SyntaxType.Identifier || node.type === SyntaxType.String) {
        // Could be a variable name in declaration, function name, or parameter
        const name = node.text;

        // Check if it's part of a function definition or call
        const funcDef = findAncestorOfType(node, FUNCTION_DEF_TYPES);
        if (funcDef) {
            const nameNode = funcDef.childForFieldName("name");
            // Compare by position and text, not object identity
            if (nameNode && isSameNode(nameNode, node)) {
                return {
                    name: stripStringDelimiters(name),
                    kind: "function",
                    scope: "file",
                    node,
                };
            }
        }

        const funcCall = findAncestorOfType(node, FUNCTION_CALL_TYPES);
        if (funcCall) {
            const nameNode = funcCall.childForFieldName("name");
            // Compare by position and text, not object identity
            if (nameNode && isSameNode(nameNode, node)) {
                return {
                    name: stripStringDelimiters(name),
                    kind: "function",
                    scope: "file",
                    node,
                };
            }
        }

        // Check if it's a variable in declaration
        const varDecl = findAncestorOfType(node, VARIABLE_DECL_TYPES);
        if (varDecl) {
            // Reject if this is a parameter name inside a function CALL (not definition)
            // Function calls use INT_VAR/STR_VAR to specify argument values, but the parameter
            // names in the call are not renameable - they refer to the function definition's params
            const callAncestor = findAncestorOfType(node, FUNCTION_CALL_TYPES);
            if (callAncestor) {
                return null; // Function call arguments cannot be renamed
            }

            // Check if this is a loop variable declaration
            if (LOOP_TYPES.has(varDecl.type as SyntaxType)) {
                // Check if node is the loop variable (key_var, value_var for PHP_EACH, or var for FOR_EACH)
                const keyVarNode = varDecl.childForFieldName("key_var");
                const valueVarNode = varDecl.childForFieldName("value_var");
                const forEachVarNode = varDecl.childForFieldName("var");

                const isLoopVar = (keyVarNode && isSameNode(keyVarNode, node)) ||
                                  (valueVarNode && isSameNode(valueVarNode, node)) ||
                                  (forEachVarNode && isSameNode(forEachVarNode, node));

                if (isLoopVar) {
                    return {
                        name,
                        kind: "variable",
                        scope: "loop",
                        loopNode: varDecl,
                        node,
                    };
                }
            }

            // Find the containing function (if any)
            const functionNode = findContainingFunction(node);
            const scope = functionNode ? "function" : "file";

            return {
                name,
                kind: "variable",
                scope,
                functionNode: functionNode ?? undefined,
                node,
            };
        }

        // Check if it's an array name in $array(index) access
        const arrayAccess = findAncestorOfType(node, new Set([SyntaxType.ArrayAccess]));
        if (arrayAccess) {
            const nameNode = arrayAccess.childForFieldName("name");
            if (nameNode && isSameNode(nameNode, node)) {
                const scopeInfo = determineVariableScope(name, node);
                return {
                    name,
                    kind: "variable",
                    scope: scopeInfo.scope,
                    functionNode: scopeInfo.functionNode,
                    loopNode: scopeInfo.loopNode,
                    node,
                };
            }
        }

        // Fallback: identifier used as variable reference in expression (e.g., `c == archer_column`)
        // This handles identifiers that aren't in declarations, function names, or array accesses
        if (node.type === SyntaxType.Identifier) {
            // Reject if this is a parameter name inside a function CALL
            // Function calls use INT_VAR/STR_VAR to specify which parameters to pass values to,
            // but these parameter names are not renameable - they refer to the function's definition
            const callAncestor = findAncestorOfType(node, FUNCTION_CALL_TYPES);
            if (callAncestor) {
                // Check if we're inside an int_var_call_item or similar param specification
                // by checking if a parent up to the call node is one of the call param types
                let current: SyntaxNode | null = node.parent;
                while (current && !isSameNode(current, callAncestor)) {
                    // int_var_call_item, str_var_call_item, ret_call_item, ret_array_call_item
                    // contain the parameter names in function calls
                    if (current.type === SyntaxType.IntVarCallItem ||
                        current.type === SyntaxType.StrVarCallItem ||
                        current.type === SyntaxType.RetCallItem ||
                        current.type === SyntaxType.RetArrayCallItem) {
                        // Only reject if cursor is on the param name (first child),
                        // not on the value part. Grammar: call_item = name [= value]
                        const paramNameNode = current.children[0];
                        if (paramNameNode && node.startIndex >= paramNameNode.startIndex && node.endIndex <= paramNameNode.endIndex) {
                            return null; // Function call parameter names cannot be renamed
                        }
                        break;
                    }
                    current = current.parent;
                }
            }

            const scopeInfo = determineVariableScope(name, node);
            return {
                name,
                kind: "variable",
                scope: scopeInfo.scope,
                functionNode: scopeInfo.functionNode,
                loopNode: scopeInfo.loopNode,
                node,
            };
        }
    }

    return null;
}

/**
 * Check if a node's variable reference is shadowed by an inner loop within the target loop scope.
 * This is used to exclude references that are shadowed by nested loops from rename operations.
 */
function isShadowedByInnerLoop(
    node: SyntaxNode,
    varName: string,
    targetLoopNode: SyntaxNode
): boolean {
    // Find the containing loop for this reference
    const containingLoop = findContainingLoop(node);
    if (!containingLoop) {
        return false;
    }

    // If the containing loop is the target loop, it's not shadowed
    if (isSameNode(containingLoop, targetLoopNode)) {
        return false;
    }

    // Check if the containing loop is nested within the target loop
    // and if it declares a variable with the same name
    let current: SyntaxNode | null = containingLoop;
    while (current) {
        if (isSameNode(current, targetLoopNode)) {
            // We're inside the target loop, check if the immediate containing loop shadows the variable
            if (isLoopVariable(containingLoop, varName)) {
                return true; // Shadowed by inner loop
            }
            return false;
        }
        current = current.parent;
    }

    // Not inside the target loop at all
    return false;
}

/**
 * Check if a variable_ref node is part of a declaration context.
 * This includes FOR_EACH loop variables, PHP_EACH loop variables, etc.
 */
function isVariableRefInDeclarationContext(varRefNode: SyntaxNode): boolean {
    // Check if parent is a FOR_EACH with this as the var field
    const parent = varRefNode.parent;
    if (!parent) {
        return false;
    }

    // For FOR_EACH, the var field is a value node that contains the variable_ref
    // So we need to check the grandparent
    const grandparent = parent.parent;
    if (grandparent && (grandparent.type === SyntaxType.ActionForEach || grandparent.type === SyntaxType.PatchForEach)) {
        const varField = grandparent.childForFieldName("var");
        // Check if the var field (value node) contains this variable_ref
        if (varField && varField === parent) {
            return true;
        }
    }

    if (parent.type === SyntaxType.ActionPhpEach || parent.type === SyntaxType.PatchPhpEach) {
        const keyVarField = parent.childForFieldName("key_var");
        const valueVarField = parent.childForFieldName("value_var");
        if ((keyVarField && isSameNode(keyVarField, varRefNode)) ||
            (valueVarField && isSameNode(valueVarField, varRefNode))) {
            return true;
        }
    }

    return false;
}

// ============================================
// Validation
// ============================================

/**
 * Check if a symbol can be renamed.
 */
function isRenameableSymbol(symbolInfo: SymbolInfo): boolean {
    // Reject automatic variables
    if (AUTOMATIC_VARIABLES.has(symbolInfo.name)) {
        return false;
    }

    return true;
}


// ============================================
// Reference finding
// ============================================

/**
 * Find all references to the given symbol, including whether each is a definition.
 */
function findAllReferences(root: SyntaxNode, symbolInfo: SymbolInfo): SymbolOccurrence[] {
    const occurrences: SymbolOccurrence[] = [];

    if (symbolInfo.kind === "variable") {
        findVariableReferences(root, symbolInfo, occurrences);
    } else {
        // symbolInfo.kind === "function"
        findFunctionReferences(root, symbolInfo, occurrences);
    }

    // Deduplicate by position (same start/end = same occurrence)
    const seen = new Set<string>();
    return occurrences.filter((occ) => {
        const key = `${occ.node.startPosition.row}:${occ.node.startPosition.column}-${occ.node.endPosition.row}:${occ.node.endPosition.column}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Find all references to a variable.
 */
function findVariableReferences(
    root: SyntaxNode,
    symbolInfo: SymbolInfo,
    occurrences: SymbolOccurrence[]
): void {
    // Determine search scope: loop > function > file
    let searchScope: SyntaxNode = root;
    if (symbolInfo.scope === "loop" && symbolInfo.loopNode) {
        searchScope = symbolInfo.loopNode;
    } else if (symbolInfo.scope === "function" && symbolInfo.functionNode) {
        searchScope = symbolInfo.functionNode;
    }

    function visit(node: SyntaxNode): void {

        // Check percent_content nodes inside %var% syntax
        if (node.type === SyntaxType.PercentContent) {
            const name = node.text; // Already without the % delimiters
            if (name && matchesSymbol(name, symbolInfo.name)) {
                // For loop-scoped variables, check if this reference is shadowed by an inner loop
                if (symbolInfo.loopNode && isShadowedByInnerLoop(node, symbolInfo.name, symbolInfo.loopNode)) {
                    return; // Skip shadowed reference
                }
                // Push the parent percent_string node for proper range
                // This is always a reference, not a definition
                if (node.parent && node.parent.type === SyntaxType.PercentString) {
                    occurrences.push({ node: node.parent, isDefinition: false });
                }
            }
        }

        // Check string content nodes for %var% patterns
        if (STRING_CONTENT_TYPES.has(node.type as SyntaxType)) {
            const varRefs = findAllVariableReferencesInStringContent(node, symbolInfo.name);
            // These are always references, not definitions
            // For loop-scoped variables, filter out shadowed references
            const filteredRefs = symbolInfo.loopNode
                ? varRefs.filter(n => !isShadowedByInnerLoop(n, symbolInfo.name, symbolInfo.loopNode!))
                : varRefs;
            occurrences.push(...filteredRefs.map(n => ({ node: n, isDefinition: false })));
        }

        // Check variable_ref nodes (bare identifiers in expressions)
        if (node.type === SyntaxType.VariableRef) {
            const identNode = node.child(0);
            const name = identNode?.text;
            if (name && matchesSymbol(name, symbolInfo.name)) {
                // Check if this variable_ref is part of a declaration context
                // If so, skip it here - it will be handled by the declaration-specific code below
                const isPartOfDeclaration = isVariableRefInDeclarationContext(node);
                if (!isPartOfDeclaration) {
                    // For loop-scoped variables, check if this reference is shadowed by an inner loop
                    if (symbolInfo.loopNode && isShadowedByInnerLoop(node, symbolInfo.name, symbolInfo.loopNode)) {
                        return; // Skip shadowed reference
                    }
                    // Push the identifier node, not the variable_ref wrapper
                    // This is always a reference, not a definition
                    occurrences.push({ node: identNode, isDefinition: false });
                }
            }
        }

        // Workaround for grammar bug: FOR_EACH loops are sometimes parsed as patch_assignment
        // Grammar incorrectly parses "FOR_EACH item IN items" as two separate assignments:
        // "FOR_EACH = item" and "IN = items"
        if (node.type === SyntaxType.PatchAssignment) {
            // patch_assignment has structure: identifier = value
            const identNode = node.child(0);
            if (identNode && identNode.type === SyntaxType.Identifier) {
                const identText = identNode.text;
                if (identText === "FOR_EACH") {
                    // This is a FOR_EACH loop variable declaration
                    // The value field contains the loop variable
                    const valueNode = node.child(2); // child(0) = identifier, child(1) = =, child(2) = value
                    if (valueNode) {
                        let varNode: SyntaxNode | null = valueNode;
                        // value wraps variable_ref, which wraps identifier
                        if (varNode.type === SyntaxType.Value) {
                            varNode = varNode.child(0);
                        }
                        if (varNode && varNode.type === SyntaxType.VariableRef) {
                            varNode = varNode.child(0);
                        }
                        if (varNode && varNode.type === SyntaxType.Identifier && matchesSymbol(varNode.text, symbolInfo.name)) {
                            // This is a definition
                            occurrences.push({ node: varNode, isDefinition: true });
                        }
                    }
                }
            }
        }

        // Check identifiers in variable declarations/assignments
        // Cast to SyntaxType because tree-sitter node.type is string
        if (VARIABLE_DECL_TYPES.has(node.type as SyntaxType)) {
            // For SET/TEXT_SPRINT statements, field is "var"
            // But skip loop types - they are handled separately below
            const isLoop = LOOP_TYPES.has(node.type as SyntaxType);
            if (!isLoop) {
                const varNode = node.childForFieldName("var");
                if (varNode && matchesSymbol(varNode.text, symbolInfo.name)) {
                    // This is a definition
                    occurrences.push({ node: varNode, isDefinition: true });
                }
            }

            // For READ_* patches, field is "varNodes" (array of var targets)
            // Tree-sitter exposes array fields via childrenForFieldName
            const varNodes = node.childrenForFieldName("var");
            for (const vn of varNodes) {
                if (vn.type === SyntaxType.Identifier && matchesSymbol(vn.text, symbolInfo.name)) {
                    // This is a definition
                    occurrences.push({ node: vn, isDefinition: true });
                }
            }

            // For DEFINE_ARRAY etc., field is "name"
            // The name field is a value/simple_value node, which wraps the actual expression
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                // The name field is value/simple_value, which is a wrapper. Get the actual expression child.
                // value node has one child: the actual expression (variable_ref, string, number, etc.)
                let exprNode = nameNode.child(0);

                // If it's a variable_ref, unwrap to get the identifier
                if (exprNode && exprNode.type === SyntaxType.VariableRef) {
                    exprNode = exprNode.child(0);
                }

                if (exprNode && exprNode.type === SyntaxType.Identifier && matchesSymbol(exprNode.text, symbolInfo.name)) {
                    // This is a definition - push the identifier node
                    occurrences.push({ node: exprNode, isDefinition: true });
                }
            }

            // For PHP_EACH loops, handle key_var, value_var, and array fields
            if (node.type === SyntaxType.ActionPhpEach || node.type === SyntaxType.PatchPhpEach) {
                // If this is a loop-scoped variable, only process this loop's declaration if it's the target loop
                const isTargetLoop = !symbolInfo.loopNode || isSameNode(symbolInfo.loopNode, node);

                const keyVarNode = node.childForFieldName("key_var");
                if (keyVarNode) {
                    let identNode: SyntaxNode | null = keyVarNode;
                    if (keyVarNode.type === SyntaxType.VariableRef) {
                        identNode = keyVarNode.child(0);
                    }
                    if (identNode && identNode.type === SyntaxType.Identifier && matchesSymbol(identNode.text, symbolInfo.name)) {
                        // This is a definition only if it's from the target loop
                        if (isTargetLoop) {
                            occurrences.push({ node: identNode, isDefinition: true });
                        }
                    }
                }

                const valueVarNode = node.childForFieldName("value_var");
                if (valueVarNode) {
                    let identNode: SyntaxNode | null = valueVarNode;
                    if (valueVarNode.type === SyntaxType.VariableRef) {
                        identNode = valueVarNode.child(0);
                    }
                    if (identNode && identNode.type === SyntaxType.Identifier && matchesSymbol(identNode.text, symbolInfo.name)) {
                        // This is a definition only if it's from the target loop
                        if (isTargetLoop) {
                            occurrences.push({ node: identNode, isDefinition: true });
                        }
                    }
                }

                const arrayNode = node.childForFieldName("array");
                if (arrayNode) {
                    let identNode: SyntaxNode | null = arrayNode;
                    if (arrayNode.type === SyntaxType.VariableRef) {
                        identNode = arrayNode.child(0);
                    }
                    if (identNode && identNode.type === SyntaxType.Identifier && matchesSymbol(identNode.text, symbolInfo.name)) {
                        // Array reference in PHP_EACH is a usage, not a definition
                        occurrences.push({ node: identNode, isDefinition: false });
                    }
                }
            }

            // For FOR_EACH loops, handle var field
            if (node.type === SyntaxType.ActionForEach || node.type === SyntaxType.PatchForEach) {
                // If this is a loop-scoped variable, only process this loop's declaration if it's the target loop
                const isTargetLoop = !symbolInfo.loopNode || isSameNode(symbolInfo.loopNode, node);

                const forEachVarNode = node.childForFieldName("var");
                if (forEachVarNode) {
                    // The var field is a value node, get its first child (variable_ref or identifier)
                    let identNode: SyntaxNode | null = forEachVarNode.child(0);
                    if (identNode && identNode.type === SyntaxType.VariableRef) {
                        identNode = identNode.child(0);
                    }
                    if (identNode && identNode.type === SyntaxType.Identifier && matchesSymbol(identNode.text, symbolInfo.name)) {
                        // This is a definition only if it's from the target loop
                        if (isTargetLoop) {
                            occurrences.push({ node: identNode, isDefinition: true });
                        }
                    }
                }
            }

            // For parameter declarations, identifiers are direct children
            if (node.type === SyntaxType.IntVarDecl ||
                node.type === SyntaxType.StrVarDecl ||
                node.type === SyntaxType.RetDecl ||
                node.type === SyntaxType.RetArrayDecl) {
                for (const child of node.children) {
                    if (child.type === SyntaxType.Identifier && matchesSymbol(child.text, symbolInfo.name)) {
                        // This is a definition
                        occurrences.push({ node: child, isDefinition: true });
                    }
                }
            }
        }

        // Check array access nodes ($array_name(index))
        if (node.type === SyntaxType.ArrayAccess) {
            const nameNode = node.childForFieldName("name");
            if (nameNode && nameNode.type === SyntaxType.Identifier && matchesSymbol(nameNode.text, symbolInfo.name)) {
                // This is a reference, not a definition
                occurrences.push({ node: nameNode, isDefinition: false });
            }
        }

        // Recurse to children
        for (const child of node.children) {
            visit(child);
        }
    }

    visit(searchScope);
}

/**
 * Find all references to a function/macro.
 */
function findFunctionReferences(
    root: SyntaxNode,
    symbolInfo: SymbolInfo,
    occurrences: SymbolOccurrence[]
): void {
    function visit(node: SyntaxNode): void {
        // Check function definitions
        // Cast to SyntaxType because tree-sitter node.type is string
        if (FUNCTION_DEF_TYPES.has(node.type as SyntaxType)) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const name = stripStringDelimiters(nameNode.text);
                if (matchesSymbol(name, symbolInfo.name)) {
                    // This is a definition
                    occurrences.push({ node: nameNode, isDefinition: true });
                }
            }
        }

        // Check function calls
        // Cast to SyntaxType because tree-sitter node.type is string
        if (FUNCTION_CALL_TYPES.has(node.type as SyntaxType)) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                const name = stripStringDelimiters(nameNode.text);
                if (matchesSymbol(name, symbolInfo.name)) {
                    // This is a reference
                    occurrences.push({ node: nameNode, isDefinition: false });
                }
            }
        }

        // Recurse to children
        for (const child of node.children) {
            visit(child);
        }
    }

    visit(root);
}

// ============================================
// Utilities
// ============================================

/**
 * Create a range from a tree-sitter node.
 */
function makeRange(node: SyntaxNode) {
    return {
        start: { line: node.startPosition.row, character: node.startPosition.column },
        end: { line: node.endPosition.row, character: node.endPosition.column },
    };
}

/**
 * Convert a byte offset within text to a Position relative to basePosition.
 * Handles multiline strings correctly.
 */
function byteOffsetToPosition(text: string, offset: number, basePosition: { row: number; column: number }): Position {
    let currentLine = basePosition.row;
    let currentCol = basePosition.column;

    for (let i = 0; i < offset; i++) {
        if (text[i] === '\n') {
            currentLine++;
            currentCol = 0;
        } else {
            currentCol++;
        }
    }

    return { line: currentLine, character: currentCol };
}

/**
 * Find all references to a specific variable within string content.
 * Returns synthetic nodes representing each %var% occurrence.
 */
function findAllVariableReferencesInStringContent(
    node: SyntaxNode,
    varName: string
): SyntaxNode[] {
    const text = node.text;
    const references: SyntaxNode[] = [];

    // Find all %varName% patterns (case-insensitive)
    const varPattern = /%([a-zA-Z_][a-zA-Z0-9_]*)%/g;
    let match: RegExpExecArray | null;

    while ((match = varPattern.exec(text)) !== null) {
        const foundVarName = match[1];
        if (foundVarName !== undefined && matchesSymbol(foundVarName, varName)) {
            // Create a synthetic node for this %var% reference
            const matchStart = match.index;
            const matchEnd = match.index + match[0].length;

            // Calculate absolute position by converting byte offset to (line, column)
            // String content can be multiline (e.g., five-tilde strings), so we need to
            // traverse the text to find the correct line and column for the match
            const startPos = byteOffsetToPosition(text, matchStart, node.startPosition);
            const endPos = byteOffsetToPosition(text, matchEnd, node.startPosition);

            // Create a synthetic node-like object
            // Type assertion is required because we're creating a custom node structure
            // that mimics SyntaxNode but isn't actually from the tree-sitter parser.
            const syntheticNode: SyntheticPercentVarNode = {
                type: "synthetic_percent_var",
                text: match[0], // The full %var% including %
                startPosition: { row: startPos.line, column: startPos.character },
                endPosition: { row: endPos.line, column: endPos.character },
                children: [],
                parent: node,
            };

            // Cast to SyntaxNode for compatibility with the rest of the codebase
            references.push(syntheticNode as unknown as SyntaxNode);
        }
    }

    return references;
}
