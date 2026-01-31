/**
 * Context-aware completion for WeiDU TP2 files.
 * Detects cursor context using tree-sitter and filters completions accordingly.
 *
 * Types and filtering logic are in separate files:
 * - types.ts: FuncParamsContext, CompletionContext, CompletionCategory
 * - filter.ts: filterItemsByContext, CATEGORY_EXCLUSIONS
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { SyntaxType } from "../tree-sitter.d";
import { getUtf8ByteOffset } from "../../shared/completion-context";
import { getParser, isInitialized } from "../parser";
import { isAction, isPatch } from "../format/utils";
import { stripStringDelimiters } from "../tree-utils";

import { ParamSection, CompletionContext, type FuncParamsContext } from "./types";

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
// Context Detection
// ============================================

/** LAF/LPF/LAM/LPM keywords that indicate function/macro name position. */
const FUNC_CALL_KEYWORDS = /^\s*(LAF|LPF|LAM|LPM|LAUNCH_ACTION_FUNCTION|LAUNCH_PATCH_FUNCTION|LAUNCH_ACTION_MACRO|LAUNCH_PATCH_MACRO)\s+\S*$/i;

/**
 * Text-based fallback for detecting lafName/lpfName/lamName/lpmName context.
 * Used when tree-sitter can't parse incomplete function/macro calls.
 * Returns the context or null if not at a function/macro name position.
 */
function detectFuncNameFromLineText(text: string, line: number, character: number): CompletionContext | null {
    // Get the current line text up to cursor
    const lines = text.split("\n");
    if (line >= lines.length) return null;
    const currentLine = lines[line];
    if (!currentLine) return null;
    const lineText = currentLine.substring(0, character);

    const match = lineText.match(FUNC_CALL_KEYWORDS);
    if (!match || !match[1]) return null;

    const keyword = match[1].toUpperCase();
    switch (keyword) {
        case "LAF":
        case "LAUNCH_ACTION_FUNCTION":
            return CompletionContext.LafName;
        case "LPF":
        case "LAUNCH_PATCH_FUNCTION":
            return CompletionContext.LpfName;
        case "LAM":
        case "LAUNCH_ACTION_MACRO":
            return CompletionContext.LamName;
        case "LPM":
        case "LAUNCH_PATCH_MACRO":
            return CompletionContext.LpmName;
        default:
            return null;
    }
}

/**
 * Determine the completion context at a given position.
 * Uses tree-sitter to parse the text and walk up from cursor position.
 *
 * Returns an array of contexts because multiple contexts can be active simultaneously
 * (e.g., after BEGIN with no actions, both componentFlag and action are valid).
 *
 * @param text Document text
 * @param line 0-based line number
 * @param character 0-based character offset
 * @param fileExtension File extension (e.g., ".tp2", ".tpa", ".tpp")
 * @returns Array of detected contexts, or [CompletionContext.Unknown] if detection fails
 */
export function getContextAtPosition(
    text: string,
    line: number,
    character: number,
    fileExtension: string
): CompletionContext[] {
    // Fallback based on file extension
    const extLower = fileExtension.toLowerCase();
    const defaultContext = getDefaultContext(extLower);

    if (!isInitialized()) {
        return [defaultContext];
    }

    const parser = getParser();
    const tree = parser.parse(text);
    if (!tree) {
        return [defaultContext];
    }

    // Compute cursor byte offset from line/character (UTF-8 safe)
    const cursorOffset = getUtf8ByteOffset(text, line, character);

    // Find node at cursor position
    const node = tree.rootNode.descendantForPosition({ row: line, column: character });
    if (!node) {
        return [defaultContext];
    }

    // No code completions inside comments; offer JSDoc tags inside /** */ comments
    if (node.type === SyntaxType.Comment) {
        const commentText = node.text.trimStart();
        if (commentText.startsWith("/**")) {
            return [CompletionContext.Jsdoc];
        }
        return [CompletionContext.Comment];
    }
    if (node.type === SyntaxType.LineComment) {
        return [CompletionContext.Comment];
    }

    // Walk up the tree to find context-defining ancestor
    const contexts = detectContextFromNode(node, extLower, cursorOffset);

    // Text-based fallback: detect lafName/lpfName for incomplete function calls
    // When tree-sitter can't parse incomplete function calls, it may return various generic
    // contexts depending on file type and position. Check for function call keywords in line text.
    // Only override when we're reasonably sure tree-sitter missed the function call
    // (single generic context that allows function calls).
    const canHaveFunctionCalls = contexts.length === 1 && (
        contexts[0] === CompletionContext.Patch ||
        contexts[0] === CompletionContext.Action ||
        contexts[0] === CompletionContext.PatchKeyword ||
        contexts[0] === CompletionContext.ActionKeyword ||
        contexts[0] === CompletionContext.Flag  // Top-level .tp2 with incomplete structure
    );

    if (canHaveFunctionCalls) {
        const funcNameContext = detectFuncNameFromLineText(text, line, character);
        if (funcNameContext !== null) {
            return [funcNameContext];
        }
    }

    return contexts;
}


/**
 * Get default context based on file extension.
 */
function getDefaultContext(ext: string): CompletionContext {
    switch (ext) {
        case ".tpp":
            return CompletionContext.Patch;
        case ".tpa":
        case ".tph":
            return CompletionContext.Action;
        case ".tp2":
            return CompletionContext.Prologue;
        default:
            return CompletionContext.Unknown;
    }
}

/** Prologue-only directive types (BACKUP and AUTHOR/SUPPORT are required first). */
const PROLOGUE_DIRECTIVE_TYPES = new Set<string>([
    SyntaxType.BackupDirective,
    SyntaxType.AuthorDirective,
    SyntaxType.SupportDirective,  // Alias for AUTHOR
]);

/** Flag directive/statement types (can appear after prologue, before components). */
const FLAG_TYPES = new Set<string>([
    SyntaxType.VersionFlag,
    SyntaxType.NoIfEvalBugFlag,
    SyntaxType.AutoEvalStringsFlag,
    SyntaxType.ReadmeDirective,
    SyntaxType.AllowMissingDirective,
    SyntaxType.AutoTraDirective,
    SyntaxType.AlwaysBlock,
    SyntaxType.InlinedFile,
    // Add other flag types as needed
]);

/** Patch control flow constructs with BEGIN...END bodies (command position inside body). */
const PATCH_CONTROL_FLOW_CONSTRUCTS = new Set<string>([
    SyntaxType.PatchIf,
    SyntaxType.PatchMatch,
    SyntaxType.PatchFor,
    SyntaxType.PatchWhile,
    SyntaxType.PatchPhpEach,
    SyntaxType.PatchForEach,
    SyntaxType.PatchReplaceEvaluate,
    SyntaxType.PatchDecompileAndPatch,
    SyntaxType.PatchTry,
    SyntaxType.InnerPatch,
    SyntaxType.InnerPatchSave,
    SyntaxType.InnerPatchFile,
]);

/** Action control flow constructs with BEGIN...END bodies (command position inside body). */
const ACTION_CONTROL_FLOW_CONSTRUCTS = new Set<string>([
    SyntaxType.ActionIf,
    SyntaxType.ActionMatch,
    SyntaxType.ActionForEach,
    SyntaxType.ActionPhpEach,
    SyntaxType.OuterFor,
    SyntaxType.OuterWhile,
    SyntaxType.ActionTry,
    SyntaxType.ActionWithTra,
    SyntaxType.ActionBashFor,
]);

/** Patch commands that are always patch context regardless of parsing context. */
const ALWAYS_PATCH_KEYWORDS = new Set([
    "READ_BYTE",
    "READ_SHORT",
    "READ_LONG",
    "READ_ASCII",
    "READ_STRREF",
    "WRITE_BYTE",
    "WRITE_SHORT",
    "WRITE_LONG",
    "WRITE_ASCII",
    "WRITE_ASCIIE",
    "WRITE_ASCIIT",
    "WRITE_EVALUATED_ASCII",
]);

/**
 * Get the 0-based line number for a given byte offset in text.
 * @param text Full document text
 * @param offset Byte offset
 * @returns 0-based line number
 */
function getLineForOffset(text: string, offset: number): number {
    const lines = text.substring(0, offset).split('\n');
    return lines.length - 1;
}

/**
 * Check if cursor is inside the BEGIN...END body of a control flow construct.
 * Control flow constructs have their own BEGIN...END blocks, and statements inside
 * should be treated as command position (not value position).
 *
 * @param node Starting node (cursor position)
 * @param cursorOffset Byte offset of cursor
 * @param constructs Set of control flow construct types to check
 * @returns true if cursor is inside a control flow body
 */
function isInsideControlFlowBody(
    node: SyntaxNode,
    cursorOffset: number,
    constructs: Set<string>
): boolean {
    let current: SyntaxNode | null = node;

    // Walk up the tree to find a control flow construct
    while (current) {
        if (constructs.has(current.type)) {
            // Found a control flow construct - check if cursor is inside its BEGIN...END body
            let beginEnd = -1;
            let endStart = -1;

            for (const child of current.children) {
                if (child.type === "BEGIN") {
                    beginEnd = child.endIndex;
                } else if (child.type === "END") {
                    endStart = child.startIndex;
                }
            }

            // If cursor is between BEGIN and END, we're inside the body
            if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
                return true;
            }
        }
        current = current.parent;
    }

    return false;
}


/**
 * BEGIN/END block boundary positions.
 * Used by function definitions and control flow constructs.
 */
interface BlockBoundaries {
    /** Byte offset where BEGIN keyword ends (after the BEGIN keyword) */
    beginEnd: number;
    /** Byte offset where END keyword starts (before the END keyword) */
    endStart: number;
    /** Optional: byte offset where function name ends (used for detecting funcParams context) */
    functionNameEnd?: number;
}

/**
 * Find BEGIN and END keyword positions in a node.
 * Returns -1 for missing keywords.
 *
 * @param node Node to search (typically a function definition or control flow construct)
 * @param trackFunctionName If true, also track the first identifier (function name)
 * @returns Boundary positions
 */
function findBeginEndBoundaries(node: SyntaxNode, trackFunctionName = false): BlockBoundaries {
    let beginEnd = -1;
    let endStart = -1;
    let functionNameEnd = -1;

    for (const child of node.children) {
        if (child.type === "BEGIN") {
            beginEnd = child.endIndex;
        } else if (child.type === "END") {
            endStart = child.startIndex;
        } else if (trackFunctionName && child.type === SyntaxType.Identifier && functionNameEnd < 0) {
            // First identifier is the function name
            functionNameEnd = child.endIndex;
        }
    }

    return { beginEnd, endStart, functionNameEnd };
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

    // If cursor is AFTER function name but BEFORE BEGIN → funcParamName/funcParamValue context
    if (functionNameEnd && functionNameEnd > 0 && cursorOffset > functionNameEnd && (beginEnd < 0 || cursorOffset < beginEnd)) {
        // Check if cursor is in a call_item (parameter declaration) to determine name vs value context
        const callItem = findCallItemAtCursor(node, cursorOffset);
        if (callItem) {
            return [detectParamNameOrValue(callItem, cursorOffset)];
        }

        // Not in a call_item yet → funcParamName (typing new parameter)
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
 * Detect context by walking up from cursor node to find parent context,
 * then walking down through siblings to narrow the context.
 * Returns an array of contexts - multiple when ambiguous.
 */
/**
 * Determine function definition context when inside ERROR node with incomplete code.
 * In incomplete parses, function definitions may be flattened (keyword, params, BEGIN, body
 * all as siblings under ERROR), rather than wrapped in action_define_*_function node.
 *
 * Returns "patch" or "action" if inside function body, null otherwise.
 */
function getFunctionContextInError(startNode: SyntaxNode, cursorOffset: number): "patch" | "action" | null {
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
 * Check if cursor is in a command position (start of a new statement).
 * Returns true if cursor is inside a control flow body OR if incomplete code
 * at the end of a statement looks like a new statement on a new line.
 *
 * @param cursorOffset Byte offset of cursor
 * @param node Statement node to check
 * @returns true if at command position (keyword position)
 */
function isInCommandPosition(cursorOffset: number, node: SyntaxNode): boolean {
    // Check if we're inside a control flow construct's BEGIN...END body
    // Statements inside control flow bodies are command position, not value position
    if (isInsideControlFlowBody(node, cursorOffset, PATCH_CONTROL_FLOW_CONSTRUCTS)) {
        return true; // Command position (patchKeyword)
    }
    if (isInsideControlFlowBody(node, cursorOffset, ACTION_CONTROL_FLOW_CONSTRUCTS)) {
        return true; // Command position (actionKeyword)
    }

    const children = node.children;
    if (children.length < 2) {
        return false; // Continue to other checks
    }

    const lastChild = children[children.length - 1];
    if (!lastChild) {
        return false;
    }

    // Heuristic: cursor WITHIN last child that looks like incomplete new statement
    // (Incomplete code may be parsed as trailing argument to previous statement)
    if (cursorOffset >= lastChild.startIndex && cursorOffset <= lastChild.endIndex) {
        // Check if last child looks like it might be a new statement (not a continuation)
        // Heuristic: if it's an identifier/variable_ref/value that starts on a new line
        // relative to the previous child, treat as command position for new statement
        if (lastChild.type === SyntaxType.Identifier || lastChild.type === SyntaxType.VariableRef || lastChild.type === SyntaxType.Value) {
            // Check if there's a previous child
            if (children.length >= 2) {
                const prevChild = children[children.length - 2];
                // If last child is on a different line than previous, likely a new statement
                if (prevChild && lastChild.startPosition.row > prevChild.endPosition.row) {
                    return true; // Command position
                }
            }
        }
    }

    return false;
}

/**
 * Check if cursor is between keyword and last argument (value position).
 * Returns true if cursor is past the first child (keyword) and before/at the
 * last meaningful child, excluding trailing whitespace.
 *
 * @param cursorOffset Byte offset of cursor
 * @param node Statement node to check
 * @returns true if in value position (after keyword)
 */
function isBetweenKeywordAndLastArg(cursorOffset: number, node: SyntaxNode): boolean {
    const children = node.children;
    if (children.length < 2) {
        return false; // No arguments, can't be in value position
    }

    const firstChild = children[0];
    const lastChild = children[children.length - 1];
    if (!firstChild || !lastChild) {
        return false;
    }

    // Cursor must be past the keyword AND before the end of the last meaningful child
    // This excludes trailing whitespace/newlines that might be included in the node
    return cursorOffset > firstChild.endIndex && cursorOffset <= lastChild.endIndex;
}

/**
 * Check if cursor is in a value/expression position (not at keyword position).
 * Returns true if cursor is between the first child (keyword) and a meaningful
 * subsequent child (argument/value), not just on trailing whitespace.
 *
 * Special case: If cursor is within the last child that looks like an incomplete
 * new statement (identifier/variable_ref on new line), treat as command position.
 * This handles cases where incomplete code gets attached to the previous statement
 * by the parser.
 */
function isInValuePosition(cursorOffset: number, node: SyntaxNode): boolean {
    // Check for command position indicators first
    if (isInCommandPosition(cursorOffset, node)) {
        return false;
    }

    // Check basic position between keyword and last arg
    return isBetweenKeywordAndLastArg(cursorOffset, node);
}

/**
 * Check if cursor is inside a prologue directive node.
 * Returns context array if detected, null otherwise.
 */
function detectPrologueContext(node: SyntaxNode): CompletionContext[] | null {
    if (PROLOGUE_DIRECTIVE_TYPES.has(node.type)) {
        return [CompletionContext.Prologue];
    }
    return null;
}

/**
 * Check if cursor is inside a flag directive node.
 * Returns context array if detected, null otherwise.
 */
function detectFlagContext(node: SyntaxNode): CompletionContext[] | null {
    if (FLAG_TYPES.has(node.type)) {
        return [CompletionContext.Flag];
    }
    return null;
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
    let lastSectionNode: SyntaxNode | null = null;
    let lastSectionType: ParamSection | null = null;
    let lastKeywordPosition: number = -1; // Position of the keyword for filtering params

    // Helper to recursively find keyword nodes in the tree
    // With incomplete/erroneous code, tree-sitter may parse keywords as identifiers nested inside
    // value nodes. We look for keyword text matching "INT_VAR", "STR_VAR", etc. in any node type,
    // then verify it's at the right level (not nested inside call_item nodes).
    function findKeywordNodes(searchNode: SyntaxNode, depth: number = 0): void {
        const text = searchNode.text;

        // Check if this node looks like a keyword (text matches and not nested inside call_item)
        if (searchNode.startIndex < cursorOffset) {
            const isKeywordText = text === "INT_VAR" || text === "STR_VAR" || text === "RET" || text === "RET_ARRAY";

            if (isKeywordText) {
                // This looks like a keyword - determine which section and find the ancestor node
                let ancestor: SyntaxNode | null;
                if (text === "INT_VAR") {
                    lastSectionType = ParamSection.IntVar;
                    lastKeywordPosition = searchNode.endIndex;
                    // Find the int_var_call ancestor to extract params from
                    ancestor = searchNode.parent;
                    while (ancestor && ancestor.type !== SyntaxType.IntVarCall) {
                        ancestor = ancestor.parent;
                    }
                    if (ancestor) lastSectionNode = ancestor;
                } else if (text === "STR_VAR") {
                    lastSectionType = ParamSection.StrVar;
                    lastKeywordPosition = searchNode.endIndex;
                    // Find the str_var_call ancestor to extract params from
                    // Bug fix: With error recovery, STR_VAR might not have a str_var_call ancestor yet.
                    // Instead, we should create a virtual section or extract params differently.
                    // For now, we mark it as STR_VAR section even if no ancestor found.
                    ancestor = searchNode.parent;
                    while (ancestor && ancestor !== node && ancestor.type !== SyntaxType.StrVarCall) {
                        ancestor = ancestor.parent;
                    }
                    // If no str_var_call found, try to use the int_var_call (which erroneously contains it)
                    if (!ancestor || ancestor === node) {
                        ancestor = searchNode.parent;
                        while (ancestor && ancestor !== node && ancestor.type !== SyntaxType.IntVarCall) {
                            ancestor = ancestor.parent;
                        }
                    }
                    if (ancestor && ancestor !== node) lastSectionNode = ancestor;
                } else if (text === "RET") {
                    lastSectionType = ParamSection.Ret;
                    lastKeywordPosition = searchNode.endIndex;
                    ancestor = searchNode.parent;
                    while (ancestor && ancestor.type !== SyntaxType.RetCall) {
                        ancestor = ancestor.parent;
                    }
                    if (ancestor) lastSectionNode = ancestor;
                } else {
                    lastSectionType = ParamSection.RetArray;
                    lastKeywordPosition = searchNode.endIndex;
                    ancestor = searchNode.parent;
                    while (ancestor && ancestor.type !== SyntaxType.RetArrayCall) {
                        ancestor = ancestor.parent;
                    }
                    if (ancestor) lastSectionNode = ancestor;
                }
            }
        }

        // Recurse to children
        for (const child of searchNode.children) {
            findKeywordNodes(child, depth + 1);
        }
    }

    findKeywordNodes(node);

    // Extract used params from the last section node we found
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions -- TS doesn't track mutations through the findKeywordNodes closure
    if (lastSectionType && lastSectionNode) {
        // Extract params, filtering by keyword position if needed
        // Bug fix: When STR_VAR is inside int_var_call (error recovery), we need to extract
        // only params that appear after the STR_VAR keyword position
        const usedParams = extractUsedParamsAfter(lastSectionNode, lastKeywordPosition);
        lastFuncParamsContext = {
            functionName,
            paramSection: lastSectionType,
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
 * 1. If no = in call_item → funcParamName (implicit parameter)
 * 2. If cursor is left of = → funcParamName (typing parameter name)
 * 3. If cursor is right of = → funcParamValue (typing value)
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

    // No = found → funcParamName (implicit parameter)
    if (equalsPosition < 0) {
        return CompletionContext.FuncParamName;
    }

    // Cursor is left of or at = → funcParamName
    if (cursorOffset <= equalsPosition) {
        return CompletionContext.FuncParamName;
    }

    // Cursor is right of = → funcParamValue
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
 * - "= s|" (next char is newline/space) → inside node (still typing value)
 * - "= 5| " (next char is space, cursor in whitespace) → NOT inside (starting new param)
 * - "= 5|\n" (next char is newline, cursor at EOL) → NOT inside (starting new param)
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
function detectFunctionCallContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // Action function call (LAF)
    if (type === SyntaxType.ActionLaunchFunction || type === "launch_action_function") {
        if (isAtFunctionName(cursorOffset, node)) {
            return [CompletionContext.LafName];
        }
        // After function name → check for funcParamName vs funcParamValue
        // Bug fix #2: LAF inside patches context is invalid
        // Check if we're inside a COPY action (which has patch context) by walking up the tree
        let parent = node.parent;
        while (parent) {
            // LAF inside patches block → use patch context
            if (parent.type === SyntaxType.Patches) {
                return null;
            }
            // LAF inside COPY action → use patch context (even if not in proper patches node due to parse errors)
            if (parent.type && parent.type.startsWith("action_copy")) {
                return null;
            }
            // Check if we're at component level with a preceding COPY action (lexically inside COPY)
            if (parent.type === SyntaxType.Component) {
                // Look for a COPY action sibling before this LAF node
                for (const sibling of parent.children) {
                    if (sibling.startIndex < node.startIndex &&
                        sibling.type && sibling.type.startsWith("action_copy")) {
                        // Found COPY before LAF → LAF is lexically inside COPY's patch area
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

        // Not in a call_item yet → funcParamName (typing new parameter)
        return [CompletionContext.FuncParamName];
    }

    // Action macro call (LAM)
    if (type === SyntaxType.ActionLaunchMacro || type === "action_launch_macro") {
        if (isAtMacroName(cursorOffset, node)) {
            return [CompletionContext.LamName];
        }
        // LAM has no parameters beyond the macro name
        return null;
    }

    // Patch macro call (LPM)
    if (type === SyntaxType.PatchLaunchMacro || type === "patch_launch_macro") {
        if (isAtMacroName(cursorOffset, node)) {
            return [CompletionContext.LpmName];
        }
        // LPM has no parameters beyond the macro name
        return null;
    }

    // Patch function call (LPF)
    if (type === SyntaxType.PatchLaunchFunction || type === "launch_patch_function") {
        if (isAtFunctionName(cursorOffset, node)) {
            return [CompletionContext.LpfName];
        }
        // After function name → check for funcParamName vs funcParamValue
        // LPF is valid inside patches blocks
        // Extract enriched context for parameter completion
        extractFuncParamsContext(node, cursorOffset);

        // Check if cursor is in a call_item to determine name vs value context
        const callItem = findCallItemAtCursor(node, cursorOffset);
        if (callItem) {
            return [detectParamNameOrValue(callItem, cursorOffset)];
        }

        // Not in a call_item yet → funcParamName (typing new parameter)
        return [CompletionContext.FuncParamName];
    }

    return null;
}

/**
 * Check if cursor is inside a function definition (DEFINE_*_FUNCTION).
 * Returns context array if detected, null otherwise.
 */
function detectFunctionDefContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
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
 * Check if cursor is inside INNER_ACTION context.
 * Returns context array if detected, null otherwise.
 */
function detectInnerActionContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    if (node.type !== SyntaxType.InnerAction) {
        return null;
    }

    const { beginEnd, endStart } = findBeginEndBoundaries(node);

    // If cursor is between BEGIN and END, check for command vs value position
    if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
        // Look for action statement at cursor position
        let actionStatement: SyntaxNode | null = null;
        for (const child of node.children) {
            if (isAction(child.type) && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                actionStatement = child;
                break;
            }
        }

        if (actionStatement) {
            if (isInValuePosition(cursorOffset, actionStatement)) {
                return [CompletionContext.Action];
            }
            return [CompletionContext.ActionKeyword];
        }
        return [CompletionContext.ActionKeyword];
    }
    // Bug fix #1: Return null instead of [CompletionContext.Action] to let caller continue walking up the tree.
    // When cursor is not inside BEGIN...END body (e.g., at INNER_ACTION keyword),
    // we should continue walking to find the containing context (e.g., COPY patches).
    return null;
}

/**
 * Check if cursor is inside INNER_PATCH/OUTER_PATCH context.
 * Returns context array if detected, null otherwise.
 */
function detectPatchContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // INNER_PATCH with BEGIN...END body
    if (type === SyntaxType.InnerPatch || type === SyntaxType.InnerPatchSave || type === SyntaxType.InnerPatchFile) {
        const { beginEnd, endStart } = findBeginEndBoundaries(node);

        // If cursor is between BEGIN and END, check for command vs value position
        if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
            // Look for patch statement at cursor position
            let patchStatement: SyntaxNode | null = null;
            for (const child of node.children) {
                if (isPatch(child.type) && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                    patchStatement = child;
                    break;
                }
            }

            if (patchStatement) {
                if (isInValuePosition(cursorOffset, patchStatement)) {
                    return [CompletionContext.Patch];
                }
                return [CompletionContext.PatchKeyword];
            }
            return [CompletionContext.PatchKeyword];
        }
        return [CompletionContext.Patch];
    }

    // OUTER_PATCH (no body parsing needed)
    if (type === SyntaxType.ActionOuterPatch || type === SyntaxType.ActionOuterPatchSave) {
        return [CompletionContext.Patch];
    }

    // Patch file
    if (type === SyntaxType.PatchFile) {
        return [CompletionContext.Patch];
    }

    // Inside patches block (COPY...BEGIN...END)
    if (type === SyntaxType.Patches) {
        return [CompletionContext.Patch];
    }

    return null;
}

/**
 * Check if cursor is inside COPY action context.
 * Returns context array if detected, null otherwise.
 */
function detectCopyActionContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    if (!node.type.startsWith("action_copy")) {
        return null;
    }

    // Check if we're inside a patches block node first (most specific)
    // This must be checked BEFORE control flow detection to ensure COPY body
    // is always patch context, regardless of what contains the COPY.
    for (const child of node.children) {
        if (child.type === SyntaxType.Patches) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return [CompletionContext.Patch];
            }
        }
    }

    // Walk through children to determine position and what's above/below
    let hasPatchesAbove = false;
    let hasWhenAbove = false;
    let hasPatchesBelow = false;
    let hasWhenBelow = false;
    let lastFilePairEnd = -1;

    for (const child of node.children) {
        if (child.type === SyntaxType.FilePair) {
            lastFilePairEnd = Math.max(lastFilePairEnd, child.endIndex);
        }

        if (child.endIndex < cursorOffset) {
            // Above cursor
            if (child.type === SyntaxType.Patches || isPatch(child.type)) {
                hasPatchesAbove = true;
            }
            if (child.type === SyntaxType.When) {
                hasWhenAbove = true;
            }
        } else if (child.startIndex > cursorOffset) {
            // Below cursor - check both proper nodes and incomplete keywords in ERROR nodes
            if (child.type === SyntaxType.Patches || isPatch(child.type) || containsPatch(child)) {
                hasPatchesBelow = true;
            }
            if (child.type === SyntaxType.When || containsWhen(child)) {
                hasWhenBelow = true;
            }
        }
    }

    // Before/within file pairs → action context (COPY header)
    // Exception: if cursor is on a different line than the file pair AND after first file pair,
    // it's likely in patches area (indented patch commands), even if tree-sitter parsed it as file_pair
    if (lastFilePairEnd > 0 && cursorOffset <= lastFilePairEnd) {
        // Check if cursor is on a different line than COPY start
        // If so, it's likely patches (indented under COPY), not more file pairs
        const copyStartLine = node.startPosition.row;
        const cursorLine = getLineForOffset(node.tree.rootNode.text, cursorOffset);

        if (cursorLine > copyStartLine) {
            // Cursor is on a different line than COPY - likely patches area
            // Fall through to patches detection logic below
        } else {
            // Cursor is on same line as COPY - definitely in file pairs (header)
            // Only check control flow if cursor is in COPY header (at/before file pairs)
            // If COPY is inside action control flow, the header is action context
            if (isInsideControlFlowBody(node, cursorOffset, ACTION_CONTROL_FLOW_CONSTRUCTS)) {
                if (isInValuePosition(cursorOffset, node)) {
                    return [CompletionContext.Action];
                }
                return [CompletionContext.ActionKeyword];
            }
            return [CompletionContext.Action];
        }
    }

    // After file pairs - in patches area
    // COPY body is ALWAYS patch context, regardless of what contains the COPY
    // (even if COPY is inside ACTION_PHP_EACH or other action control flow)
    // Do NOT check isInsideControlFlowBody here!

    // Check if cursor is at a patch statement (command vs value position)
    let patchStatement: SyntaxNode | null = null;
    let whenStatement: SyntaxNode | null = null;
    for (const child of node.children) {
        if (isPatch(child.type) && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
            patchStatement = child;
            break;
        }
        if (child.type === SyntaxType.When && cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
            whenStatement = child;
            break;
        }
    }

    // If at a patch statement, determine command vs value position
    if (patchStatement) {
        if (isInValuePosition(cursorOffset, patchStatement)) {
            return [CompletionContext.Patch];
        }
        return [CompletionContext.PatchKeyword];
    }

    // If at a when statement, return when context
    if (whenStatement) {
        return [CompletionContext.When];
    }

    // Not at a specific statement - this is command position for typing new patch/when keywords
    // Check what's above/below to determine what keywords are allowed

    // If there's content both above and below, determine allowed contexts.
    // Patches above means user can still add more patches (before when block).
    if ((hasPatchesAbove || hasWhenAbove) && (hasPatchesBelow || hasWhenBelow)) {
        const contexts: CompletionContext[] = [];
        // Patches are valid here if there are patches above (can always add more)
        // or if there are patches below (within a patch block)
        if (hasPatchesAbove || hasPatchesBelow) contexts.push(CompletionContext.Patch);
        if (hasWhenBelow) contexts.push(CompletionContext.When);
        return contexts;
    }

    // If there's content above but nothing below, determine what's allowed next
    if (hasPatchesAbove || hasWhenAbove) {
        if (hasWhenAbove) {
            // After when: can add more when OR new action (NOT patches)
            return [CompletionContext.When, CompletionContext.Action];
        } else {
            // After patches: can add more patches, when, OR new action
            return [CompletionContext.Patch, CompletionContext.When, CompletionContext.Action];
        }
    }

    // After file pairs with nothing below: all three possible
    return [CompletionContext.Patch, CompletionContext.When, CompletionContext.Action];
}

/**
 * Check if cursor is inside component node.
 * Returns context array if detected, null otherwise.
 */
function detectComponentContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    if (node.type !== SyntaxType.Component) {
        return null;
    }
    return getComponentContextFromNode(cursorOffset, node);
}

/**
 * Handle context detection when cursor is inside a control flow construct's BEGIN...END body.
 * Returns context array if detected, null otherwise.
 */
function detectContextInControlFlow(
    node: SyntaxNode,
    type: string,
    cursorOffset: number
): CompletionContext[] | null {
    // Check if this is an action control flow construct with BEGIN...END body
    if (ACTION_CONTROL_FLOW_CONSTRUCTS.has(type)) {
        const { beginEnd, endStart } = findBeginEndBoundaries(node);
        // If cursor is inside BEGIN...END body
        // Note: cursor at node.endIndex is considered "in body" for completion (whitespace before END)
        if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset <= node.endIndex)) {
            // Check if there's a COPY action before cursor in this body
            // If so, cursor is in COPY patches area (even if COPY node doesn't extend there)
            let lastCopyBeforeCursor: SyntaxNode | null = null;
            for (const child of node.children) {
                if (child.type.startsWith("action_copy") && child.endIndex < cursorOffset) {
                    if (!lastCopyBeforeCursor || child.endIndex > lastCopyBeforeCursor.endIndex) {
                        lastCopyBeforeCursor = child;
                    }
                }
            }

            if (lastCopyBeforeCursor) {
                // Cursor is after COPY action - conceptually in COPY patches area
                // Return patchKeyword (command position for typing patch statements)
                return [CompletionContext.PatchKeyword];
            }

            // No COPY before cursor - cursor is in action control flow body
            return [CompletionContext.ActionKeyword];
        }
        // Cursor is in the construct header (before BEGIN) - return null to continue
        return null;
    }

    // Check if this is a patch control flow construct with BEGIN...END body
    if (PATCH_CONTROL_FLOW_CONSTRUCTS.has(type)) {
        const { beginEnd, endStart } = findBeginEndBoundaries(node);
        // If cursor is inside BEGIN...END body, return patchKeyword
        if (beginEnd > 0 && cursorOffset > beginEnd && (endStart < 0 || cursorOffset < endStart)) {
            return [CompletionContext.PatchKeyword];
        }
        // Cursor is in the construct header (before BEGIN) - return null to continue
        return null;
    }

    return null;
}

/**
 * Handle context detection when cursor is inside a patches block or inner_action.
 * Returns context array if detected, null otherwise.
 */
function detectContextInPatchesBlock(
    statementNode: SyntaxNode,
    cursorOffset: number,
    isActionNode: boolean
): CompletionContext[] | null {
    // Walk up to check if we're inside a patches block or inner_action
    let parent = statementNode.parent;
    let foundPatchesBlock = false;

    while (parent) {
        // INNER_ACTION creates action context even inside patches block
        if (parent.type === SyntaxType.InnerAction) {
            if (isActionNode && isInValuePosition(cursorOffset, statementNode)) {
                return [CompletionContext.Action];
            }
            if (isActionNode) {
                return [CompletionContext.ActionKeyword];
            }
            // Patch inside INNER_ACTION shouldn't happen, but fall through
        }

        if (parent.type === SyntaxType.Patches) {
            foundPatchesBlock = true;
            // Don't return yet - keep checking for inner_action above
        }
        parent = parent.parent;
    }

    // If we found a patches block and no inner_action, return patch context
    if (foundPatchesBlock) {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return [CompletionContext.Patch];
        }
        return [CompletionContext.PatchKeyword];
    }

    return null;
}

/**
 * Handle context detection when cursor is inside a function definition.
 * Returns context array if detected, null otherwise.
 */
function detectContextInFunctionDef(
    statementNode: SyntaxNode,
    cursorOffset: number,
    isActionNode: boolean,
    isPatchNode: boolean
): CompletionContext[] | null {
    // Walk up to find function definitions (skip ERROR nodes)
    let parent = statementNode.parent;
    while (parent) {
        // Skip ERROR nodes - continue up the tree
        if (parent.type !== SyntaxType.ERROR) {
            // Check for patch function definitions
            if (parent.type === SyntaxType.ActionDefinePatchFunction || parent.type === SyntaxType.ActionDefinePatchMacro) {
                // Inside DEFINE_PATCH_FUNCTION - body is patch context
                // Bug fix #3: Check if statement is action vs patch to handle invalid syntax gracefully.
                // If action statement inside patch function, return action context.
                if (isActionNode) {
                    if (isInValuePosition(cursorOffset, statementNode)) {
                        return [CompletionContext.Action];
                    }
                    return [CompletionContext.ActionKeyword];
                }
                if (isInValuePosition(cursorOffset, statementNode)) {
                    return [CompletionContext.Patch];
                }
                return [CompletionContext.PatchKeyword];
            }

            // Check for action function definitions
            if (parent.type === SyntaxType.ActionDefineFunction || parent.type === SyntaxType.ActionDefineMacro) {
                // Inside DEFINE_ACTION_FUNCTION - body is action context
                // Bug fix #3: Check if statement is action vs patch to handle invalid syntax gracefully.
                // If patch statement inside action function, return patch context.
                if (isPatchNode) {
                    if (isInValuePosition(cursorOffset, statementNode)) {
                        return [CompletionContext.Patch];
                    }
                    return [CompletionContext.PatchKeyword];
                }
                if (isInValuePosition(cursorOffset, statementNode)) {
                    return [CompletionContext.Action];
                }
                return [CompletionContext.ActionKeyword];
            }
        }
        parent = parent.parent;
    }

    return null;
}

/**
 * Handle context detection when cursor is inside an ERROR node with flattened function definition.
 * Returns context array if detected, null otherwise.
 */
function detectContextInErrorNode(
    statementNode: SyntaxNode,
    cursorOffset: number,
    isActionNode: boolean,
    isPatchNode: boolean
): CompletionContext[] | null {
    // Check if we're inside a flattened function definition in an ERROR node
    const funcContext = getFunctionContextInError(statementNode, cursorOffset);

    if (funcContext === "patch") {
        // Bug fix #3: Check if statement is action vs patch to handle invalid syntax gracefully.
        // If action statement inside patch function (even in ERROR node), return action context.
        if (isActionNode) {
            if (isInValuePosition(cursorOffset, statementNode)) {
                return [CompletionContext.Action];
            }
            return [CompletionContext.ActionKeyword];
        }
        if (isInValuePosition(cursorOffset, statementNode)) {
            return [CompletionContext.Patch];
        }
        return [CompletionContext.PatchKeyword];
    }

    if (funcContext === "action") {
        // Bug fix #3: Check if statement is action vs patch to handle invalid syntax gracefully.
        // If patch statement inside action function (even in ERROR node), return patch context.
        if (isPatchNode) {
            if (isInValuePosition(cursorOffset, statementNode)) {
                return [CompletionContext.Patch];
            }
            return [CompletionContext.PatchKeyword];
        }
        if (isInValuePosition(cursorOffset, statementNode)) {
            return [CompletionContext.Action];
        }
        return [CompletionContext.ActionKeyword];
    }

    return null;
}

/**
 * Check if cursor is at an action/patch statement and determine context.
 * Returns context array if detected, null otherwise.
 *
 * This handles statements that aren't inside function definitions or patches blocks.
 * It walks up to find the containing function/block to determine the correct context.
 */
function detectStatementContext(node: SyntaxNode, cursorOffset: number): CompletionContext[] | null {
    const type = node.type;

    // Check if this is a control flow construct with BEGIN...END body
    const controlFlowContext = detectContextInControlFlow(node, type, cursorOffset);
    if (controlFlowContext) {
        return controlFlowContext;
    }

    // Only process action/patch statement nodes
    if (!isAction(type) && !isPatch(type)) {
        return null;
    }

    // Remember this node and determine its true action/patch nature
    const statementNode = node;
    let isActionNode = isAction(type);
    let isPatchNode = isPatch(type);

    // Bug fix #3: Check the actual keyword text to determine true action/patch nature.
    // Parser creates context-aware nodes (e.g., OUTER_SET becomes patch_assignment inside patch function),
    // but we want to handle invalid syntax gracefully by detecting the true command type.
    // Only check for assignment/set statements, not COPY or other complex actions.
    if (type.includes("assignment") || type.includes("_set")) {
        const firstChild = statementNode.children.find(c => c.type !== SyntaxType.Comment && c.type !== SyntaxType.LineComment);
        if (firstChild) {
            const keywordText = firstChild.text.toUpperCase();
            // Commands that are always actions regardless of context
            if (keywordText.startsWith("OUTER_") || keywordText.startsWith("ACTION_")) {
                isActionNode = true;
                isPatchNode = false;
            }
            // Commands that are always patches regardless of context
            if (keywordText.startsWith("PATCH_") || ALWAYS_PATCH_KEYWORDS.has(keywordText)) {
                isPatchNode = true;
                isActionNode = false;
            }
        }
    }

    // Check if we're inside a patches block or inner_action (highest priority)
    const patchesBlockContext = detectContextInPatchesBlock(statementNode, cursorOffset, isActionNode);
    if (patchesBlockContext) {
        return patchesBlockContext;
    }

    // Check if we're inside a function definition
    const functionDefContext = detectContextInFunctionDef(statementNode, cursorOffset, isActionNode, isPatchNode);
    if (functionDefContext) {
        return functionDefContext;
    }

    // Check if we're inside an ERROR node with flattened function definition
    const errorNodeContext = detectContextInErrorNode(statementNode, cursorOffset, isActionNode, isPatchNode);
    if (errorNodeContext) {
        return errorNodeContext;
    }

    // Not inside a function def - use the statement node's context
    if (isPatchNode) {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return [CompletionContext.Patch];
        }
        return [CompletionContext.PatchKeyword];
    }
    if (isActionNode) {
        if (isInValuePosition(cursorOffset, statementNode)) {
            return [CompletionContext.Action];
        }
        return [CompletionContext.ActionKeyword];
    }

    return null;
}

/**
 * Check if cursor is at source file root and determine context.
 * Returns context array if detected, null otherwise.
 */
function detectSourceFileContext(node: SyntaxNode, cursorOffset: number, ext: string): CompletionContext[] | null {
    if (node.type !== SyntaxType.SourceFile) {
        return null;
    }

    // For .tp2 files, determine prologue vs flag
    if (ext === ".tp2") {
        return detectTp2RootContext(cursorOffset, node);
    }

    // For .tpa/.tph, check if file has component structure (BEGIN/GROUP)
    // If so, use tp2-style context detection; otherwise default to action
    if (ext === ".tpa" || ext === ".tph") {
        if (hasComponentStructure(node)) {
            return detectTp2RootContext(cursorOffset, node);
        }
        // Top level is command position - return only actionKeyword to exclude constants
        return [CompletionContext.ActionKeyword];
    }

    // For .tpp, top level is command position
    if (ext === ".tpp") {
        return [CompletionContext.PatchKeyword];
    }

    return null;
}

function detectContextFromNode(node: SyntaxNode, ext: string, cursorOffset: number): CompletionContext[] {
    let current: SyntaxNode | null = node;

    while (current) {
        // Try each handler in order of priority
        const context =
            detectPrologueContext(current) ??
            detectFlagContext(current) ??
            detectFunctionCallContext(current, cursorOffset) ??
            detectFunctionDefContext(current, cursorOffset) ??
            detectInnerActionContext(current, cursorOffset) ??
            detectPatchContext(current, cursorOffset) ??
            detectCopyActionContext(current, cursorOffset) ??
            detectComponentContext(current, cursorOffset) ??
            detectStatementContext(current, cursorOffset) ??
            detectSourceFileContext(current, cursorOffset, ext);

        if (context) {
            return context;
        }

        current = current.parent;
    }

    return [CompletionContext.Unknown];
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
        }
    }

    // Positional heuristic: cursor is after keyword (typing macro name)
    if (keywordEnd > 0 && cursorOffset > keywordEnd) {
        return true;
    }

    return false;
}

/** Component flag node types. */
const COMPONENT_FLAG_TYPES = new Set<string>([
    SyntaxType.DesignatedFlag,
    SyntaxType.DeprecatedFlag,
    SyntaxType.SubcomponentFlag,
    SyntaxType.GroupFlag,
    SyntaxType.LabelFlag,
    SyntaxType.RequirePredicateFlag,
    SyntaxType.RequireComponentFlag,
    SyntaxType.ForbidComponentFlag,
    "install_by_default_flag",  // Not yet in SyntaxType enum
    "no_log_record_flag",  // Not yet in SyntaxType enum
    "metadata_flag",  // Not yet in SyntaxType enum
    "forced_subcomponent_flag",  // Not yet in SyntaxType enum
]);

/** Component flag keywords (for checking text when parsed as identifiers in ERROR nodes). */
const COMPONENT_FLAG_KEYWORDS = new Set([
    "DESIGNATED",
    "DEPRECATED",
    "SUBCOMPONENT",
    "GROUP",
    "LABEL",
    "REQUIRE_PREDICATE",
    "REQUIRE_COMPONENT",
    "FORBID_COMPONENT",
    "INSTALL_BY_DEFAULT",
    "NO_LOG_RECORD",
    "METADATA",
    "FORCED_SUBCOMPONENT",
]);

/**
 * Check if a node or its children recursively contain a patch node.
 * Used to detect patches in ERROR nodes or nested structures.
 */
function containsPatch(node: SyntaxNode): boolean {
    if (isPatch(node.type)) return true;
    for (const child of node.children) {
        if (containsPatch(child)) return true;
    }
    return false;
}

/**
 * Check if a node or its children recursively contain a when node.
 * Used to detect when in ERROR nodes or nested structures.
 */
function containsWhen(node: SyntaxNode): boolean {
    if (node.type === SyntaxType.When) return true;
    for (const child of node.children) {
        if (containsWhen(child)) return true;
    }
    return false;
}

// ============================================
// Structural Node Detection
// ============================================

// Note: NodeType.ERROR is used consistently throughout this file
// instead of string literal "ERROR" for better maintainability

/** Structural nodes (actions, flags) found around cursor position. */
interface StructuralNodes {
    actionBefore: SyntaxNode | null;
    flagAfter: SyntaxNode | null;
}

/** Check if node is a component flag (by type or as incomplete keyword). */
function isComponentFlag(node: SyntaxNode): boolean {
    return (
        COMPONENT_FLAG_TYPES.has(node.type) ||
        (node.type === SyntaxType.Identifier && COMPONENT_FLAG_KEYWORDS.has(node.text.toUpperCase()))
    );
}

/** Update accumulator with actionBefore (keep latest). */
function updateActionBefore(acc: StructuralNodes, node: SyntaxNode): void {
    const current = acc.actionBefore;
    if (!current || node.endIndex > current.endIndex) {
        acc.actionBefore = node;
    }
}

/** Update accumulator with flagAfter (keep earliest). */
function updateFlagAfter(acc: StructuralNodes, node: SyntaxNode): void {
    const current = acc.flagAfter;
    if (!current || node.startIndex < current.startIndex) {
        acc.flagAfter = node;
    }
}

/**
 * Check a single node and update accumulator.
 * Handles both direct nodes and ERROR node children.
 */
function checkNode(node: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    const isBefore = node.endIndex <= cursorOffset;
    const isAfter = node.startIndex > cursorOffset;

    if (isBefore && isAction(node.type)) {
        updateActionBefore(acc, node);
    }

    if (isAfter && isComponentFlag(node)) {
        updateFlagAfter(acc, node);
    }
}

/**
 * Check ERROR node children for structural nodes.
 * ERROR nodes may contain flags/actions when code is incomplete.
 */
function checkErrorNodeChildren(errorNode: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    for (const child of errorNode.children) {
        if (child.startIndex <= cursorOffset) continue;
        checkNode(child, cursorOffset, acc);
    }
}

/**
 * Find structural nodes in component's direct children.
 */
function findInComponentChildren(component: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    for (const child of component.children) {
        checkNode(child, cursorOffset, acc);

        // Also check inside ERROR nodes that are after cursor
        if (child.type === SyntaxType.ERROR && child.startIndex > cursorOffset) {
            checkErrorNodeChildren(child, cursorOffset, acc);
        }
    }
}

/**
 * Find structural nodes in parent's children (siblings of component).
 * Handles incomplete code where flags/actions escape the component node.
 */
function findInParentSiblings(component: SyntaxNode, cursorOffset: number, acc: StructuralNodes): void {
    const parent = component.parent;
    if (!parent) return;

    for (const sibling of parent.children) {
        if (sibling === component) continue;

        // ERROR nodes: check children even if ERROR starts before cursor
        // (the ERROR may span the cursor, but contain valid nodes after it)
        if (sibling.type === SyntaxType.ERROR) {
            checkErrorNodeChildren(sibling, cursorOffset, acc);
            continue;
        }

        // Regular siblings: only check if after cursor
        if (sibling.startIndex > cursorOffset) {
            checkNode(sibling, cursorOffset, acc);
        }
    }
}

/**
 * Find structural nodes (actions, flags) immediately before and after cursor.
 *
 * Searches in two places:
 * 1. Component's direct children
 * 2. Parent's children (for incomplete code where nodes escape the component)
 */
function findStructuralNodesAroundCursor(component: SyntaxNode, cursorOffset: number): StructuralNodes {
    const acc: StructuralNodes = {
        actionBefore: null,
        flagAfter: null,
    };

    findInComponentChildren(component, cursorOffset, acc);
    findInParentSiblings(component, cursorOffset, acc);

    return acc;
}

/**
 * Check if source file has component structure (BEGIN, GROUP, LANGUAGE).
 * Used to detect .tpa/.tph files that define components rather than just actions.
 */
function hasComponentStructure(root: SyntaxNode): boolean {
    for (const child of root.children) {
        if (child.type === SyntaxType.Component || child.type === SyntaxType.LanguageDirective) {
            return true;
        }
    }
    return false;
}

/**
 * Get context for cursor position inside or after a COPY action.
 * COPY actions have a complex structure: file pairs, then optional patches, then optional when.
 */
function getCopyActionContext(copyAction: SyntaxNode, cursorOffset: number): CompletionContext[] {
    let hasPatchesBelow = false;
    let hasWhenBelow = false;
    let hasPatchesInCopy = false;
    let hasWhenInCopy = false;

    for (const child of copyAction.children) {
        const isChildPatch = child.type === SyntaxType.Patches || isPatch(child.type) || containsPatch(child);
        const isChildWhen = child.type === SyntaxType.When || containsWhen(child);

        if (isChildPatch) {
            hasPatchesInCopy = true;
            if (child.startIndex > cursorOffset) {
                hasPatchesBelow = true;
            }
        }
        if (isChildWhen) {
            hasWhenInCopy = true;
            if (child.startIndex > cursorOffset) {
                hasWhenBelow = true;
            }
        }
    }

    // Content below within COPY → only those contexts (certain)
    if (hasPatchesBelow || hasWhenBelow) {
        const contexts: CompletionContext[] = [];
        if (hasPatchesBelow) contexts.push(CompletionContext.Patch);
        if (hasWhenBelow) contexts.push(CompletionContext.When);
        return contexts;
    }

    // Nothing below → determine by what's already in COPY
    if (hasWhenInCopy) {
        // After when: more when OR new action (NOT patches - when comes after patches)
        return [CompletionContext.When, CompletionContext.Action];
    }
    if (hasPatchesInCopy) {
        // After patches: more patches, when, OR new action
        return [CompletionContext.Patch, CompletionContext.When, CompletionContext.Action];
    }
    // After file pairs only: all three possible
    return [CompletionContext.Patch, CompletionContext.When, CompletionContext.Action];
}

/**
 * Get context for cursor after an action (possibly inside it for COPY).
 */
function getActionContext(action: SyntaxNode, cursorOffset: number): CompletionContext[] {
    // COPY actions have special handling for patches/when
    if (action.type.startsWith("action_copy")) {
        return getCopyActionContext(action, cursorOffset);
    }
    // Regular action → determine if cursor is at command position or value position
    if (isInValuePosition(cursorOffset, action)) {
        return [CompletionContext.Action];
    }
    return [CompletionContext.ActionKeyword];
}

/**
 * Get component context by analyzing structural nodes around cursor.
 *
 * NOTE: When typing incomplete code, tree-sitter may not include subsequent flags
 * as children of the component. We also check siblings in the parent (root) node.
 */
function getComponentContextFromNode(cursorOffset: number, component: SyntaxNode): CompletionContext[] {
    // Check if cursor is inside a component flag node
    for (const child of component.children) {
        if (COMPONENT_FLAG_TYPES.has(child.type)) {
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return [CompletionContext.ComponentFlag];
            }
        }
    }

    // Find structural nodes around cursor
    const { actionBefore, flagAfter } = findStructuralNodesAroundCursor(component, cursorOffset);

    // Action above → delegate to action context handler (we're past flag section)
    if (actionBefore) {
        return getActionContext(actionBefore, cursorOffset);
    }

    // Flags below cursor → in flag section (can only add more flags)
    if (flagAfter) {
        return [CompletionContext.ComponentFlag];
    }

    // No flags after, no actions before → at boundary, both valid
    return [CompletionContext.ComponentFlag, CompletionContext.ActionKeyword];
}

/**
 * Detect context within .tp2 source file root.
 * Determines if we're in prologue or flag section.
 *
 * **Decision: Grammar vs Completion Context**
 * - Grammar: BACKUP and AUTHOR/SUPPORT are optional (for error recovery/malformed files)
 * - Completion: Encourages BACKUP first, then AUTHOR/SUPPORT, by showing prologue context
 * - This allows parsing of incomplete/test files while guiding users to write correct TP2s
 *
 * **Context Flow:**
 * 1. Empty file → "prologue" (must start with BACKUP)
 * 2. After BACKUP only → "prologue" (AUTHOR/SUPPORT still needed)
 * 3. After BACKUP + AUTHOR/SUPPORT → "flag" (prologue complete)
 * 4. After any non-prologue → "flag" (past prologue section)
 *
 * Note: Component nodes only span from BEGIN to the last action/flag.
 * Empty lines after a component (but before the next BEGIN) are not part
 * of the component node, but should still be treated as inside the component
 * for completion purposes.
 */
function detectTp2RootContext(cursorOffset: number, root: SyntaxNode): CompletionContext[] {
    // Track what we've seen
    let seenBackup = false;
    let seenAuthorOrSupport = false;
    let seenAnyNonPrologue = false;
    let lastComponent: SyntaxNode | null = null;

    for (const child of root.children) {
        const type = child.type;

        // Track what we've seen before cursor (use <= to include nodes ending at cursor)
        if (child.endIndex <= cursorOffset) {
            if (type === SyntaxType.BackupDirective) {
                seenBackup = true;
            }
            if (type === SyntaxType.AuthorDirective || type === SyntaxType.SupportDirective) {
                seenAuthorOrSupport = true;
            }
            if (!PROLOGUE_DIRECTIVE_TYPES.has(type)) {
                seenAnyNonPrologue = true;
            }
        }

        if (child.type === SyntaxType.Component) {
            // Check if cursor is BEFORE this component
            if (cursorOffset < child.startIndex) {
                // If we have a previous component, cursor is in its trailing area
                if (lastComponent) {
                    return getComponentContextFromNode(cursorOffset, lastComponent);
                }
                return [CompletionContext.Flag];
            }
            // Check if cursor is INSIDE this component's span
            if (cursorOffset >= child.startIndex && cursorOffset <= child.endIndex) {
                return getComponentContextFromNode(cursorOffset, child);
            }
            // Cursor is after this component - remember it for trailing area check
            lastComponent = child;
        }
    }

    // Cursor is after all children - if we found a component, we're in its trailing area
    if (lastComponent) {
        return getComponentContextFromNode(cursorOffset, lastComponent);
    }

    // Determine context based on what we've seen
    // Once we've seen any non-prologue directive, we're past the prologue section
    if (seenAnyNonPrologue) {
        return [CompletionContext.Flag];
    }

    // If we've seen both required directives, prologue is complete
    if (seenBackup && seenAuthorOrSupport) {
        return [CompletionContext.Flag];
    }

    // If we've seen BACKUP only, AUTHOR/SUPPORT is still required
    if (seenBackup) {
        return [CompletionContext.Prologue];
    }

    // Beginning of file - BACKUP is required first
    return [CompletionContext.Prologue];
}

