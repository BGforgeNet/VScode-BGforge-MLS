import type { ParseResult, ParsedField, ParsedGroup } from "../parsers";
import { createFieldKey, resolveFieldPresentation, toSemanticFieldKey } from "../parsers/presentation-schema";
import type { BinaryEditorNode } from "./binaryEditor-messages";
import { isEditableFieldForFormat } from "./binaryEditor-editability";
import { formatNumericValue } from "./binaryEditor-formatting";
import { resolveDisplayValue, resolveEnumLookup, resolveFlagLookup } from "./binaryEditor-lookups";
import { resolveNumericFormat } from "./binaryEditor-numericFormat";

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

function makeFieldId(sourceSegments: readonly string[]): string {
    return JSON.stringify(sourceSegments);
}

type ProjectedEntry =
    | { readonly kind: "field"; readonly entry: ParsedField; readonly sourceSegments: readonly string[] }
    | { readonly kind: "group"; readonly entry: ParsedGroup; readonly sourceSegments: readonly string[]; readonly children: readonly ProjectedEntry[] };

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

function projectDisplayEntry(parseResult: ParseResult, entry: ParsedField | ParsedGroup, sourceSegments: readonly string[]): ProjectedEntry | undefined {
    if (!isGroup(entry)) {
        return shouldHideFieldFromEditor(parseResult, entry)
            ? undefined
            : { kind: "field", entry, sourceSegments };
    }

    const projectedChildren = entry.fields
        .map((child) => projectDisplayEntry(parseResult, child, [...sourceSegments, child.name]))
        .filter((child): child is ProjectedEntry => child !== undefined);

    if (projectedChildren.length === 0) {
        return undefined;
    }

    if (parseResult.format === "map" && shouldHideMapGroupFromEditor(group(
        entry.name,
        projectedChildren.map((child) => child.entry),
        entry.expanded !== false,
        entry.description,
    ))) {
        return undefined;
    }

    return { kind: "group", entry, sourceSegments, children: projectedChildren };
}

function buildDisplayRoot(parseResult: ParseResult): ProjectedEntry[] {
    if (parseResult.errors && parseResult.errors.length > 0) {
        return [];
    }

    if (parseResult.format !== "map") {
        return parseResult.root.fields
            .map((entry) => projectDisplayEntry(parseResult, entry, [entry.name]))
            .filter((entry): entry is ProjectedEntry => entry !== undefined);
    }

    const projectedFields: ProjectedEntry[] = [];
    let insertedTilesGroup = false;

    for (const entry of parseResult.root.fields) {
        if (isGroup(entry) && /^Elevation \d+ Tiles$/.test(entry.name)) {
            if (!insertedTilesGroup) {
                projectedFields.push({
                    kind: "group",
                    entry: group("Tiles", [], false),
                    sourceSegments: ["Tiles"],
                    children: [],
                });
                insertedTilesGroup = true;
            }
            continue;
        }

        const projectedEntry = projectDisplayEntry(parseResult, entry, [entry.name]);
        if (projectedEntry) {
            projectedFields.push(projectedEntry);
        }
    }

    return projectedFields;
}

export function buildBinaryEditorTreeState(parseResult: ParseResult): BinaryEditorTreeState {
    const displayRoot = buildDisplayRoot(parseResult);
    const nodes = new Map<string, TreeNodeRecord>();
    const rootChildren: string[] = [];
    let nextId = 0;

    const visitEntry = (projected: ProjectedEntry, parentId: string, parentPath: string): string => {
        const id = `node-${nextId++}`;
        if (projected.kind === "group") {
            const entry = projected.entry;
            const groupPath = makeFieldPath(parentPath, entry.name);
            const childIds = projected.children.map((child) => visitEntry(child, id, groupPath));
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

        const entry = projected.entry;
        const fieldPath = makeFieldPath(parentPath, entry.name);
        const fieldId = makeFieldId(projected.sourceSegments);
        const fieldKey = toSemanticFieldKey(parseResult.format, projected.sourceSegments)
            ?? createFieldKey(projected.sourceSegments);
        const presentation = resolveFieldPresentation(parseResult.format, fieldKey, entry.name);
        const numericFormat = resolveNumericFormat(parseResult.format, fieldKey, entry.name);
        const enumOptions = resolveEnumLookup(parseResult.format, fieldKey, entry.name);
        const flagOptions = resolveFlagLookup(parseResult.format, fieldKey, entry.name);
        const numericValue = typeof entry.rawValue === "number"
            ? entry.rawValue
            : typeof entry.value === "number"
                ? entry.value
                : undefined;
        const displayValue = typeof numericValue === "number"
            ? enumOptions || flagOptions
                ? resolveDisplayValue(parseResult.format, fieldKey, entry.name, numericValue)
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
                fieldId,
                fieldKey,
                fieldPath,
                editable: isEditableFieldForFormat(parseResult.format, fieldKey, entry),
                value: displayValue,
                rawValue: entry.rawValue,
                offset: entry.offset,
                size: entry.size,
                valueType: entry.type,
                numericFormat,
                enumOptions,
                flagOptions,
                flagActivation: presentation?.flagActivation,
            },
        });
        return id;
    };

    for (const entry of displayRoot) {
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
