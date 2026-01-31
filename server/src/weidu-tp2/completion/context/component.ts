/**
 * Component structure detection for TP2 completion context.
 * Handles BEGIN/GROUP component parsing, flag detection, structural node analysis,
 * and TP2 root-level context determination (prologue vs flag vs component).
 */

import type { Node as SyntaxNode } from "web-tree-sitter";
import { SyntaxType } from "../../tree-sitter.d";
import { isAction, isPatch } from "../../format/utils";
import { CompletionContext } from "../types";
import {
    PROLOGUE_DIRECTIVE_TYPES,
    COMPONENT_FLAG_TYPES,
    COMPONENT_FLAG_KEYWORDS,
} from "./constants";
import { isInValuePosition, containsPatch, containsWhen } from "./position";

// ============================================
// Component Flag Detection
// ============================================

/** Check if node is a component flag (by type or as incomplete keyword). */
function isComponentFlag(node: SyntaxNode): boolean {
    return (
        COMPONENT_FLAG_TYPES.has(node.type) ||
        (node.type === SyntaxType.Identifier && COMPONENT_FLAG_KEYWORDS.has(node.text.toUpperCase()))
    );
}

// ============================================
// Structural Node Detection
// ============================================

/** Structural nodes (actions, flags) found around cursor position. */
export interface StructuralNodes {
    actionBefore: SyntaxNode | null;
    flagAfter: SyntaxNode | null;
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

// ============================================
// Component Context Resolution
// ============================================

/**
 * Check if source file has component structure (BEGIN, GROUP, LANGUAGE).
 * Used to detect .tpa/.tph files that define components rather than just actions.
 */
export function hasComponentStructure(root: SyntaxNode): boolean {
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

    // Content below within COPY -> only those contexts (certain)
    if (hasPatchesBelow || hasWhenBelow) {
        const contexts: CompletionContext[] = [];
        if (hasPatchesBelow) contexts.push(CompletionContext.Patch);
        if (hasWhenBelow) contexts.push(CompletionContext.When);
        return contexts;
    }

    // Nothing below -> determine by what's already in COPY
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
    // Regular action -> determine if cursor is at command position or value position
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
export function getComponentContextFromNode(cursorOffset: number, component: SyntaxNode): CompletionContext[] {
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

    // Action above -> delegate to action context handler (we're past flag section)
    if (actionBefore) {
        return getActionContext(actionBefore, cursorOffset);
    }

    // Flags below cursor -> in flag section (can only add more flags)
    if (flagAfter) {
        return [CompletionContext.ComponentFlag];
    }

    // No flags after, no actions before -> at boundary, both valid
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
 * 1. Empty file -> "prologue" (must start with BACKUP)
 * 2. After BACKUP only -> "prologue" (AUTHOR/SUPPORT still needed)
 * 3. After BACKUP + AUTHOR/SUPPORT -> "flag" (prologue complete)
 * 4. After any non-prologue -> "flag" (past prologue section)
 *
 * Note: Component nodes only span from BEGIN to the last action/flag.
 * Empty lines after a component (but before the next BEGIN) are not part
 * of the component node, but should still be treated as inside the component
 * for completion purposes.
 */
export function detectTp2RootContext(cursorOffset: number, root: SyntaxNode): CompletionContext[] {
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
