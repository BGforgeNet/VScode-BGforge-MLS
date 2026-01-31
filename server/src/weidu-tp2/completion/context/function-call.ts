/**
 * Function and macro call/definition detection for TP2 completion context.
 * Handles LAF/LPF/LAM/LPM calls, DEFINE_*_FUNCTION definitions,
 * parameter name/value position detection, and enriched FuncParamsContext storage.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { SyntaxType } from "../../tree-sitter.d";
import { isAction, isPatch } from "../../format/utils";
import { stripStringDelimiters } from "../../tree-utils";
import { ParamSection, CompletionContext, type FuncParamsContext } from "../types";
import { ALWAYS_PATCH_KEYWORDS } from "./constants";
import { findBeginEndBoundaries, isInValuePosition } from "./position";

// ============================================
// Enriched Context Storage
// ============================================

/**
 * Module-level storage for enriched function params context.
 * Set by detectFunctionCallContext when cursor is in funcParams context.
 * Retrieved by getFuncParamsContext() for parameter completion.
 */
let lastFuncParamsContext: FuncParamsContext | null = null;

/**
 * Get the enriched function params context from the last completion request.
 * Returns null if context is not funcParams or if function info cannot be determined.
 */
export function getFuncParamsContext(): FuncParamsContext | null {
    return lastFuncParamsContext;
}

// ============================================
// Keyword Search
// ============================================

/**
 * Result of searching for section keyword nodes (INT_VAR, STR_VAR, RET, RET_ARRAY)
 * in a function call tree. Returns the last section keyword found before the cursor.
 */
export interface KeywordSearchResult {
    sectionNode: SyntaxNode | null;
    sectionType: ParamSection | null;
    keywordPosition: number;
}

/**
 * Find the ancestor node of a given type for a keyword node.
 * Walks up the tree from the keyword's parent until it finds the expected ancestor type,
 * stopping at the boundary node to prevent escaping the function call.
 */
function findSectionAncestor(
    keywordNode: SyntaxNode,
    ancestorType: string,
    boundaryNode: SyntaxNode,
    fallbackType?: string
): SyntaxNode | null {
    let ancestor: SyntaxNode | null = keywordNode.parent;
    while (ancestor && ancestor !== boundaryNode && ancestor.type !== ancestorType) {
        ancestor = ancestor.parent;
    }
    if (ancestor && ancestor !== boundaryNode) {
        return ancestor;
    }
    // Fallback: try a different ancestor type (e.g., int_var_call when STR_VAR is misparsed inside it)
    if (fallbackType) {
        ancestor = keywordNode.parent;
        while (ancestor && ancestor !== boundaryNode && ancestor.type !== fallbackType) {
            ancestor = ancestor.parent;
        }
        if (ancestor && ancestor !== boundaryNode) {
            return ancestor;
        }
    }
    return null;
}

/**
 * Recursively search for section keyword nodes (INT_VAR, STR_VAR, RET, RET_ARRAY)
 * in a function call tree. Returns the last keyword found before the cursor.
 *
 * With incomplete/erroneous code, tree-sitter may parse keywords as identifiers nested inside
 * value nodes. We look for keyword text matching section names in any node type,
 * then find the appropriate ancestor to extract params from.
 */
function findKeywordNodes(funcCallNode: SyntaxNode, cursorOffset: number): KeywordSearchResult {
    let result: KeywordSearchResult = { sectionNode: null, sectionType: null, keywordPosition: -1 };

    function search(searchNode: SyntaxNode): void {
        const text = searchNode.text;

        // Check if this node looks like a keyword before the cursor
        if (searchNode.startIndex < cursorOffset) {
            const isKeywordText = text === "INT_VAR" || text === "STR_VAR" || text === "RET" || text === "RET_ARRAY";

            if (isKeywordText) {
                if (text === "INT_VAR") {
                    result = {
                        sectionType: ParamSection.IntVar,
                        keywordPosition: searchNode.endIndex,
                        sectionNode: findSectionAncestor(searchNode, SyntaxType.IntVarCall, funcCallNode)
                            ?? result.sectionNode,
                    };
                } else if (text === "STR_VAR") {
                    // Bug fix: With error recovery, STR_VAR might not have a str_var_call ancestor yet.
                    // Fall back to int_var_call (which erroneously contains it).
                    result = {
                        sectionType: ParamSection.StrVar,
                        keywordPosition: searchNode.endIndex,
                        sectionNode: findSectionAncestor(
                            searchNode, SyntaxType.StrVarCall, funcCallNode, SyntaxType.IntVarCall
                        ) ?? result.sectionNode,
                    };
                } else if (text === "RET") {
                    result = {
                        sectionType: ParamSection.Ret,
                        keywordPosition: searchNode.endIndex,
                        sectionNode: findSectionAncestor(searchNode, SyntaxType.RetCall, funcCallNode)
                            ?? result.sectionNode,
                    };
                } else {
                    result = {
                        sectionType: ParamSection.RetArray,
                        keywordPosition: searchNode.endIndex,
                        sectionNode: findSectionAncestor(searchNode, SyntaxType.RetArrayCall, funcCallNode)
                            ?? result.sectionNode,
                    };
                }
            }
        }

        // Recurse to children
        for (const child of searchNode.children) {
            search(child);
        }
    }

    search(funcCallNode);
    return result;
}

/**
 * Extract enriched context from a function call node (LAF/LPF).
 * Determines parameter section, used params, and function name.
 * Stores result in module-level lastFuncParamsContext.
 */
function extractFuncParamsContext(node: SyntaxNode, cursorOffset: number): void {
    // Clear previous context
    lastFuncParamsContext = null;

    // Get function name from "name" field
    const nameNode = node.childForFieldName("name");
    if (!nameNode) {
        return;
    }

    // Strip WeiDU string delimiters (tildes, quotes, percent signs)
    const functionName = stripStringDelimiters(nameNode.text);

    // Find the last section keyword that starts before the cursor
    // Bug fix: With incomplete code (e.g., "bonus =" without value), tree-sitter error recovery
    // can extend INT_VAR section node bounds past STR_VAR, merging both into one int_var_call node.
    // Instead of using node bounds, we recursively search for actual keyword nodes ("INT_VAR",
    // "STR_VAR", etc.) and track the last one before cursor, which correctly identifies the current section.
    const { sectionType, sectionNode, keywordPosition } = findKeywordNodes(node, cursorOffset);

    if (sectionType !== null && sectionNode !== null) {
        // Extract params, filtering by keyword position if needed
        // Bug fix: When STR_VAR is inside int_var_call (error recovery), we need to extract
        // only params that appear after the STR_VAR keyword position
        const usedParams = extractUsedParamsAfter(sectionNode, keywordPosition);
        lastFuncParamsContext = {
            functionName,
            paramSection: sectionType,
            usedParams,
        };
    }
}

/**
 * Extract parameter names that appear after a given position in a section node.
 * Used when keywords are misparsed due to error recovery.
 */
function extractUsedParamsAfter(sectionNode: SyntaxNode, afterPosition: number): string[] {
    const params: string[] = [];

    for (const child of sectionNode.children) {
        // Only consider children that start after the keyword position
        if (child.startIndex <= afterPosition) {
            continue;
        }

        const type = child.type;

        // INT_VAR/STR_VAR have call_item children
        if (type === SyntaxType.IntVarCallItem || type === SyntaxType.StrVarCallItem) {
            const firstChild = child.children[0];
            if (firstChild && (firstChild.type === SyntaxType.Identifier || firstChild.type === SyntaxType.String)) {
                params.push(firstChild.text);
            }
        }
        // RET/RET_ARRAY have direct identifier children
        else if (type === SyntaxType.Identifier) {
            params.push(child.text);
        }
        // Also check for RET_CALL_ITEM and RET_ARRAY_CALL_ITEM
        else if (type === SyntaxType.RetCallItem || type === SyntaxType.RetArrayCallItem) {
            const firstChild = child.children[0];
            if (firstChild && firstChild.type === SyntaxType.Identifier) {
                params.push(firstChild.text);
            }
        }
    }

    return params;
}

/**
 * Determine if cursor is in parameter name or value position within a call_item.
 * Returns "funcParamName" if left of = or no =, "funcParamValue" if right of =.
 *
 * Logic:
 * 1. If no = in call_item -> funcParamName (implicit parameter)
 * 2. If cursor is left of = -> funcParamName (typing parameter name)
 * 3. If cursor is right of = -> funcParamValue (typing value)
 * 4. If uncertain, prefer funcParamName
 */
function detectParamNameOrValue(node: SyntaxNode, cursorOffset: number): CompletionContext {
    // Look for = token in the node and its children
    let equalsPosition = -1;

    function findEquals(searchNode: SyntaxNode): void {
        if (searchNode.text === "=" && searchNode.type === "=") {
            equalsPosition = searchNode.startIndex;
            return;
        }
        for (const child of searchNode.children) {
            findEquals(child);
            if (equalsPosition >= 0) return;
        }
    }

    findEquals(node);

    // No = found -> funcParamName (implicit parameter)
    if (equalsPosition < 0) {
        return CompletionContext.FuncParamName;
    }

    // Cursor is left of or at = -> funcParamName
    if (cursorOffset <= equalsPosition) {
        return CompletionContext.FuncParamName;
    }

    // Cursor is right of = -> funcParamValue
    return CompletionContext.FuncParamValue;
}

/**
 * Find the call_item or parameter declaration node that contains the cursor.
 * Returns the node if found, null otherwise.
 *
 * Handles both function calls (call_item nodes) and function definitions (decl nodes).
 *
 * Boundary handling: Cursor AT the endIndex (right after the last character) is considered
 * inside the node ONLY if the next character is NOT whitespace. This allows:
 * - "= s|" (next char is newline/space) -> inside node (still typing value)
 * - "= 5| " (next char is space, cursor in whitespace) -> NOT inside (starting new param)
 * - "= 5|\n" (next char is newline, cursor at EOL) -> NOT inside (starting new param)
 */
function findCallItemAtCursor(funcCallNode: SyntaxNode, cursorOffset: number): SyntaxNode | null {
    // Search through all descendants for call_item or decl nodes
    function search(node: SyntaxNode): SyntaxNode | null {
        const type = node.type;

        // Check if this is a call_item or decl type
        const isParamNode = type === SyntaxType.IntVarCallItem || type === SyntaxType.StrVarCallItem ||
            type === SyntaxType.RetCallItem || type === SyntaxType.RetArrayCallItem ||
            type === SyntaxType.IntVarDecl || type === SyntaxType.StrVarDecl ||
            type === SyntaxType.RetDecl || type === SyntaxType.RetArrayDecl;

        if (isParamNode) {
            // Check if cursor is within this node (inclusive of endIndex boundary)
            // At endIndex, cursor is right after the last char - still in value context
            if (cursorOffset >= node.startIndex && cursorOffset <= node.endIndex) {
                return node;
            }
        }

        // Recurse to children
        for (const child of node.children) {
            const result = search(child);
            if (result) return result;
        }

        return null;
    }

    return search(funcCallNode);
}

/**
 * Check if cursor is at function call name position (LAF/LPF).
 * Returns context array if detected, null otherwise.
 */
export function detectFunctionCallContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // Action function call (LAF)
    if (type === SyntaxType.ActionLaunchFunction) {
        if (isAtFunctionName(cursorOffset, node)) {
            return [CompletionContext.LafName];
        }
        // After function name -> check for funcParamName vs funcParamValue
        // Bug fix #2: LAF inside patches context is invalid
        // Check if we're inside a COPY action (which has patch context) by walking up the tree
        let parent = node.parent;
        while (parent) {
            // LAF inside patches block -> use patch context
            if (parent.type === SyntaxType.Patches) {
                return null;
            }
            // LAF inside COPY action -> use patch context (even if not in proper patches node due to parse errors)
            // Pattern match: action_copy, action_copy_existing, etc. have multiple
            // SyntaxType values so startsWith is intentional here.
            if (parent.type && parent.type.startsWith("action_copy")) {
                return null;
            }
            // Check if we're at component level with a preceding COPY action (lexically inside COPY)
            if (parent.type === SyntaxType.Component) {
                // Look for a COPY action sibling before this LAF node
                for (const sibling of parent.children) {
                    // Pattern match: action_copy* covers action_copy, action_copy_existing, etc.
                    if (sibling.startIndex < node.startIndex &&
                        sibling.type && sibling.type.startsWith("action_copy")) {
                        // Found COPY before LAF -> LAF is lexically inside COPY's patch area
                        // Return patch context directly (don't return null, as that would delegate to COPY
                        // which doesn't see LAF as its child and returns wrong context)
                        return [CompletionContext.Patch];
                    }
                }
            }
            parent = parent.parent;
        }
        // Extract enriched context for parameter completion
        extractFuncParamsContext(node, cursorOffset);

        // Check if cursor is in a call_item to determine name vs value context
        const callItem = findCallItemAtCursor(node, cursorOffset);
        if (callItem) {
            return [detectParamNameOrValue(callItem, cursorOffset)];
        }

        // Not in a call_item yet -> funcParamName (typing new parameter)
        return [CompletionContext.FuncParamName];
    }

    // Action macro call (LAM)
    if (type === SyntaxType.ActionLaunchMacro) {
        if (isAtMacroName(cursorOffset, node)) {
            return [CompletionContext.LamName];
        }
        // LAM has no parameters beyond the macro name
        return null;
    }

    // Patch macro call (LPM)
    if (type === SyntaxType.PatchLaunchMacro) {
        if (isAtMacroName(cursorOffset, node)) {
            return [CompletionContext.LpmName];
        }
        // LPM has no parameters beyond the macro name
        return null;
    }

    // Patch function call (LPF)
    if (type === SyntaxType.PatchLaunchFunction) {
        if (isAtFunctionName(cursorOffset, node)) {
            return [CompletionContext.LpfName];
        }
        // After function name -> check for funcParamName vs funcParamValue
        // LPF is valid inside patches blocks
        // Extract enriched context for parameter completion
        extractFuncParamsContext(node, cursorOffset);

        // Check if cursor is in a call_item to determine name vs value context
        const callItem = findCallItemAtCursor(node, cursorOffset);
        if (callItem) {
            return [detectParamNameOrValue(callItem, cursorOffset)];
        }

        // Not in a call_item yet -> funcParamName (typing new parameter)
        return [CompletionContext.FuncParamName];
    }

    return null;
}

/**
 * Check if cursor is inside a function definition (DEFINE_*_FUNCTION).
 * Returns context array if detected, null otherwise.
 */
export function detectFunctionDefContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // DEFINE_PATCH_FUNCTION body is patch context
    if (type === SyntaxType.ActionDefinePatchFunction || type === SyntaxType.ActionDefinePatchMacro) {
        return detectFunctionDefinitionContext(node, cursorOffset, "patch", isPatch);
    }

    // DEFINE_ACTION_FUNCTION body is action context
    if (type === SyntaxType.ActionDefineFunction || type === SyntaxType.ActionDefineMacro) {
        return detectFunctionDefinitionContext(node, cursorOffset, "action", isAction);
    }

    return null;
}

/**
 * Detect context inside a function definition (action or patch).
 * Handles both complete parses (action_define_*_function nodes) and incomplete parses
 * (flattened structure in ERROR nodes).
 *
 * @param node Function definition node
 * @param cursorOffset Byte offset of cursor
 * @param funcType "patch" or "action" - determines context type
 * @param statementChecker Function to check if a node is a statement of the appropriate type
 * @returns Context array if cursor is in relevant position, null otherwise
 */
function detectFunctionDefinitionContext(
    node: SyntaxNode,
    cursorOffset: number,
    funcType: "patch" | "action",
    statementChecker: (type: string) => boolean
): CompletionContext[] | null {
    const boundaries = findBeginEndBoundaries(node, true);
    const { beginEnd, endStart, functionNameEnd } = boundaries;

    // If cursor is AFTER function name but BEFORE BEGIN -> funcParamName/funcParamValue context
    if (functionNameEnd && functionNameEnd > 0 && cursorOffset > functionNameEnd && (beginEnd < 0 || cursorOffset < beginEnd)) {
        // Check if cursor is in a call_item (parameter declaration) to determine name vs value context
        const callItem = findCallItemAtCursor(node, cursorOffset);
        if (callItem) {
            return [detectParamNameOrValue(callItem, cursorOffset)];
        }

        // Not in a call_item yet -> funcParamName (typing new parameter)
        return [CompletionContext.FuncParamName];
    }

    // If cursor is between BEGIN and END, we're in the function body
    // Note: endStart will be -1 for incomplete code (no END yet), so only check beginEnd
    if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
        // Walk down from function node to find if cursor is at a statement node
        let statement: SyntaxNode | null = null;
        for (const child of node.children) {
            if (statementChecker(child.type) && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                statement = child;
                break;
            }
        }

        // Bug fix #3: Check for ERROR nodes containing invalid statements
        // If no statement found and cursor is in ERROR node, check keyword text
        if (!statement) {
            for (const child of node.children) {
                if (child.type === SyntaxType.ERROR && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                    // Look for identifier child that might be a misplaced command
                    const identifier = child.children.find(c => c.type === SyntaxType.Identifier && cursorOffset >= c.startIndex && cursorOffset <= c.endIndex);
                    if (identifier) {
                        const keywordText = identifier.text.toUpperCase();
                        // Check if it's an action command in a patch function or vice versa
                        if (funcType === "patch" && (keywordText.startsWith("OUTER_") || keywordText.startsWith("ACTION_"))) {
                            // Action command in patch function - return action context
                            return [CompletionContext.ActionKeyword];
                        }
                        if (funcType === "action" && (keywordText.startsWith("PATCH_") || ALWAYS_PATCH_KEYWORDS.has(keywordText))) {
                            // Patch command in action function - return patch context
                            return [CompletionContext.PatchKeyword];
                        }
                    }
                    break;
                }
            }
        }

        // If at a statement, determine command vs value position
        if (statement) {
            if (isInValuePosition(cursorOffset, statement)) {
                return [funcType === "patch" ? CompletionContext.Patch : CompletionContext.Action];
            }
            return [funcType === "patch" ? CompletionContext.PatchKeyword : CompletionContext.ActionKeyword];
        }
        // Not at a specific statement node yet - return keyword context (command position)
        return [funcType === "patch" ? CompletionContext.PatchKeyword : CompletionContext.ActionKeyword];
    }

    // Cursor is in the function header or outside the function body
    return null;
}

/**
 * Determine function definition context when inside ERROR node with incomplete code.
 * In incomplete parses, function definitions may be flattened (keyword, params, BEGIN, body
 * all as siblings under ERROR), rather than wrapped in action_define_*_function node.
 *
 * Returns "patch" or "action" if inside function body, null otherwise.
 */
export function getFunctionContextInError(startNode: SyntaxNode, cursorOffset: number): "patch" | "action" | null {
    // Walk up to find ERROR node
    let errorNode: SyntaxNode | null = startNode;
    while (errorNode && errorNode.type !== SyntaxType.ERROR) {
        errorNode = errorNode.parent;
    }

    if (!errorNode) {
        return null;
    }

    // Check ERROR node's children for function definition pattern:
    // DEFINE_*_FUNCTION keyword before cursor, BEGIN before cursor, cursor after BEGIN
    let foundFuncType: "patch" | "action" | null = null;
    let beginEnd = -1;
    let endStart = -1;

    for (const child of errorNode.children) {
        // Check for function definition keywords before cursor
        if (child.endIndex <= cursorOffset) {
            const text = child.text.toUpperCase();
            if (text === "DEFINE_PATCH_FUNCTION" || text === "DEFINE_PATCH_MACRO") {
                foundFuncType = "patch";
            } else if (text === "DEFINE_ACTION_FUNCTION" || text === "DEFINE_ACTION_MACRO") {
                foundFuncType = "action";
            } else if (text === "BEGIN" && child.type === "BEGIN") {
                beginEnd = child.endIndex;
            }
        }

        // Check for END keyword
        if (child.type === "END") {
            endStart = child.startIndex;
        }
    }

    // If we found a function definition and BEGIN, and cursor is after BEGIN (and before END if present)
    if (foundFuncType && beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
        return foundFuncType;
    }

    return null;
}

/**
 * Check if cursor is at the function name position in a function call.
 * Uses positional heuristics for incomplete code where identifier may not exist.
 */
function isAtFunctionName(cursorOffset: number, funcCall: SyntaxNode): boolean {
    let keywordEnd = -1;
    let firstArgStart = -1;

    for (const child of funcCall.children) {
        const text = child.text.toUpperCase();

        // Track keyword position (LAF, LPF, LAUNCH_ACTION_FUNCTION, LAUNCH_PATCH_FUNCTION)
        if (text === "LAF" || text === "LPF" || text === "LAUNCH_ACTION_FUNCTION" || text === "LAUNCH_PATCH_FUNCTION") {
            keywordEnd = child.endIndex;
            continue;
        }

        // If cursor is within an identifier (the function name), return true
        if (child.type === SyntaxType.Identifier) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return true;
            }
            // Past the identifier - not at function name position
            if (cursorOffset > child.endIndex) {
                return false;
            }
        }

        // Track first argument keyword (INT_VAR, STR_VAR, RET, END)
        if (text === "INT_VAR" || text === "STR_VAR" || text === "RET" || text === "RET_ARRAY" || text === "END") {
            if (firstArgStart < 0) {
                firstArgStart = child.startIndex;
            }
        }
    }

    // Positional heuristic: cursor is after keyword but before any arguments
    if (keywordEnd > 0 && cursorOffset > keywordEnd) {
        if (firstArgStart < 0 || cursorOffset < firstArgStart) {
            return true;
        }
    }

    return false;
}

/**
 * Check if cursor is at the macro name position in a macro call (LAM/LPM).
 * Macros have simpler syntax than functions: just keyword + name, no parameters.
 */
function isAtMacroName(cursorOffset: number, macroCall: SyntaxNode): boolean {
    let keywordEnd = -1;

    for (const child of macroCall.children) {
        const text = child.text.toUpperCase();

        // Track keyword position (LAM, LPM, LAUNCH_ACTION_MACRO, LAUNCH_PATCH_MACRO)
        if (text === "LAM" || text === "LPM" || text === "LAUNCH_ACTION_MACRO" || text === "LAUNCH_PATCH_MACRO") {
            keywordEnd = child.endIndex;
            continue;
        }

        // If cursor is within an identifier (the macro name), return true
        if (child.type === SyntaxType.Identifier || child.type === SyntaxType.String) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return true;
            }
            // Past the identifier — not at macro name position
            if (cursorOffset > child.endIndex) {
                return false;
            }
        }
    }

    // Positional heuristic: cursor is after keyword (typing macro name)
    if (keywordEnd > 0 && cursorOffset > keywordEnd) {
        return true;
    }

    return false;
}
