import type { ParseResult, ParsedField, ParsedGroup } from "../parsers";
import type { BinaryEditorNode } from "./binaryEditor-messages";
import { isEditableFieldForFormat } from "./binaryEditor-editability";
import { formatNumericValue, resolveNumericFormat } from "./binaryEditor-formatting";
import { resolveDisplayValue, resolveEnumLookup, resolveFlagLookup } from "./binaryEditor-lookups";

interface TreeNodeRecord {
    readonly id: string;
    readonly summary: BinaryEditorNode;
    readonly children: readonly string[];
}

function group(name: string, fields: (ParsedField | ParsedGroup)[], expanded = true, description?: string): ParsedGroup {
    return { name, fields, expanded, description };
}

function isGroup(entry: ParsedField | ParsedGroup): entry is ParsedGroup {
    return "fields" in entry;
}

function makeFieldPath(parentPath: string, name: string): string {
    return parentPath ? `${parentPath}.${name}` : name;
}

export interface BinaryEditorTreeState {
    getInitMessagePayload(): { format: string; formatName: string; errors?: string[]; warnings?: string[]; rootChildren: BinaryEditorNode[] };
    getChildren(nodeId: string): BinaryEditorNode[];
}

function shouldHideFieldFromEditor(parseResult: ParseResult, entry: ParsedField): boolean {
    // Keep parser fidelity for round-trip/debugging, but omit low-signal raw
    // placeholders from the editor tree because they do not help end users edit
    // the file safely.
    if (entry.name === "Unknown") {
        return true;
    }

    if (parseResult.format !== "map") {
        return false;
    }

    return entry.name === "Padding (field_3C)"
        || entry.name === "Field 74"
        // Fallout 2 CE only gives useful semantics for the persisted program slot
        // and how_much value. The other script-entry fields below remain legacy or
        // unknown engine internals, so the editor hides them from the normal tree.
        || /^Entry \d+ (Next Script Link \(legacy\)|Unknown Field 0x48|Legacy Field 0x50)$/.test(entry.name);
}

function shouldHideMapGroupFromEditor(entry: ParsedGroup): boolean {
    if (!entry.name.endsWith("Scripts")) {
        return false;
    }

    if (entry.fields.length !== 1) {
        return false;
    }

    const [firstField] = entry.fields;
    return firstField !== undefined
        && !isGroup(firstField)
        && firstField.name === "Script Count"
        && firstField.value === 0;
}

function projectDisplayEntry(parseResult: ParseResult, entry: ParsedField | ParsedGroup): ParsedField | ParsedGroup | undefined {
    if (!isGroup(entry)) {
        return shouldHideFieldFromEditor(parseResult, entry) ? undefined : entry;
    }

    const projectedChildren = entry.fields
        .map((child) => projectDisplayEntry(parseResult, child))
        .filter((child): child is ParsedField | ParsedGroup => child !== undefined);

    if (projectedChildren.length === 0) {
        return undefined;
    }

    if (parseResult.format === "map" && shouldHideMapGroupFromEditor(group(entry.name, projectedChildren, entry.expanded !== false, entry.description))) {
        return undefined;
    }

    return group(entry.name, projectedChildren, entry.expanded !== false, entry.description);
}

function buildDisplayRoot(parseResult: ParseResult): ParsedGroup {
    if (parseResult.errors && parseResult.errors.length > 0) {
        return group(parseResult.root.name, [], parseResult.root.expanded, parseResult.root.description);
    }

    if (parseResult.format !== "map") {
        const projectedFields = parseResult.root.fields
            .map((entry) => projectDisplayEntry(parseResult, entry))
            .filter((entry): entry is ParsedField | ParsedGroup => entry !== undefined);
        return group(parseResult.root.name, projectedFields, parseResult.root.expanded, parseResult.root.description);
    }

    const projectedFields: (ParsedField | ParsedGroup)[] = [];
    let insertedTilesGroup = false;

    for (const entry of parseResult.root.fields) {
        if (isGroup(entry) && /^Elevation \d+ Tiles$/.test(entry.name)) {
            if (!insertedTilesGroup) {
                projectedFields.push(group("Tiles", [], false));
                insertedTilesGroup = true;
            }
            continue;
        }

        const projectedEntry = projectDisplayEntry(parseResult, entry);
        if (projectedEntry) {
            projectedFields.push(projectedEntry);
        }
    }

    return group(parseResult.root.name, projectedFields, parseResult.root.expanded, parseResult.root.description);
}

export function buildBinaryEditorTreeState(parseResult: ParseResult): BinaryEditorTreeState {
    const displayRoot = buildDisplayRoot(parseResult);
    const nodes = new Map<string, TreeNodeRecord>();
    const rootChildren: string[] = [];
    let nextId = 0;

    const visitEntry = (entry: ParsedField | ParsedGroup, parentId: string, parentPath: string): string => {
        const id = `node-${nextId++}`;
        if (isGroup(entry)) {
            const groupPath = makeFieldPath(parentPath, entry.name);
            const childIds = entry.fields.map((child) => visitEntry(child, id, groupPath));
            nodes.set(id, {
                id,
                children: childIds,
                summary: {
                    id,
                    parentId,
                    kind: "group",
                    name: entry.name,
                    description: entry.description,
                    expandable: childIds.length > 0,
                    expanded: entry.expanded !== false,
                },
            });
            return id;
        }

        const fieldPath = makeFieldPath(parentPath, entry.name);
        const numericFormat = resolveNumericFormat(parseResult.format, entry.name);
        const enumOptions = resolveEnumLookup(parseResult.format, fieldPath, entry.name);
        const flagOptions = resolveFlagLookup(parseResult.format, fieldPath, entry.name);
        const numericValue = typeof entry.rawValue === "number"
            ? entry.rawValue
            : typeof entry.value === "number"
                ? entry.value
                : undefined;
        const displayValue = typeof numericValue === "number"
            ? enumOptions || flagOptions
                ? resolveDisplayValue(parseResult.format, fieldPath, entry.name, numericValue)
                : formatNumericValue(numericValue, numericFormat)
            : String(entry.value);
        nodes.set(id, {
            id,
            children: [],
            summary: {
                id,
                parentId,
                kind: "field",
                name: entry.name,
                description: entry.description,
                expandable: false,
                fieldPath,
                editable: isEditableFieldForFormat(parseResult.format, fieldPath, entry),
                value: displayValue,
                rawValue: entry.rawValue,
                offset: entry.offset,
                size: entry.size,
                valueType: entry.type,
                numericFormat,
                enumOptions,
                flagOptions,
            },
        });
        return id;
    };

    for (const entry of displayRoot.fields) {
        rootChildren.push(visitEntry(entry, "root", ""));
    }

    return {
        getInitMessagePayload() {
            return {
                format: parseResult.format,
                formatName: parseResult.formatName,
                errors: parseResult.errors,
                warnings: parseResult.warnings,
                rootChildren: rootChildren.map((id) => nodes.get(id)!.summary),
            };
        },
        getChildren(nodeId: string) {
            const record = nodes.get(nodeId);
            if (!record) {
                return [];
            }
            return record.children.map((childId) => nodes.get(childId)!.summary);
        },
    };
}
