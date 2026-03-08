/**
 * Individual context detector functions for TP2 completion.
 * Each detector checks whether the cursor is within a specific syntactic construct
 * (prologue, flag, inner action, patch, COPY, component, statement, source file)
 * and returns the appropriate CompletionContext or null to delegate to the next detector.
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { SyntaxType } from "../../tree-sitter.d";
import { isAction, isPatch } from "../../format/utils";
import { CompletionContext } from "../types";
import {
    PROLOGUE_DIRECTIVE_TYPES,
    FLAG_TYPES,
    PATCH_CONTROL_FLOW_CONSTRUCTS,
    ACTION_CONTROL_FLOW_CONSTRUCTS,
    ALWAYS_PATCH_KEYWORDS,
} from "./constants";
import {
    containsPatch,
    containsWhen,
    findBeginEndBoundaries,
    getLineForOffset,
    isInsideControlFlowBody,
    isInValuePosition,
} from "./position";
import {
    detectFunctionCallContext,
    detectFunctionDefContext,
    getFunctionContextInError,
} from "./function-call";
import {
    hasComponentStructure,
    getComponentContextFromNode,
    detectTp2RootContext,
} from "./component";

// ============================================
// Individual Detectors
// ============================================

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
    // Pattern match: action_copy* covers action_copy, action_copy_existing, etc.
    // Multiple SyntaxType enum values share this prefix.
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

    // Before/within file pairs -> action context (COPY header)
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
            // AND no other action between that COPY and the cursor.
            // If both hold, cursor is in COPY patches area (even if COPY node doesn't extend there).
            // If another action exists after the COPY but before cursor, the COPY is complete
            // and we're back in action context.
            let lastCopyBeforeCursor: SyntaxNode | null = null;
            let hasActionAfterCopy = false;
            for (const child of node.children) {
                if (child.type.startsWith("action_copy") && child.endIndex < cursorOffset) {
                    if (!lastCopyBeforeCursor || child.endIndex > lastCopyBeforeCursor.endIndex) {
                        lastCopyBeforeCursor = child;
                        hasActionAfterCopy = false;
                    }
                } else if (lastCopyBeforeCursor && isAction(child.type) && child.endIndex < cursorOffset) {
                    hasActionAfterCopy = true;
                }
            }

            if (lastCopyBeforeCursor && !hasActionAfterCopy) {
                // Cursor is after COPY action with no intervening actions - in COPY patches area
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

/**
 * Detect context by walking up from cursor node to find parent context,
 * then walking down through siblings to narrow the context.
 * Returns an array of contexts - multiple when ambiguous.
 */
export function detectContextFromNode(node: SyntaxNode, ext: string, cursorOffset: number): CompletionContext[] {
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
