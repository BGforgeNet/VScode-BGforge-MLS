import type { ParseResult, ParsedField, ParsedGroup } from "../parsers";
import type { BinaryEditorNode } from "./binaryEditor-messages";
import { isEditableFieldForFormat } from "./binaryEditor-editability";
import { formatNumericValue, resolveNumericFormat } from "./binaryEditor-formatting";
import { resolveEnumLookup, resolveFlagLookup } from "./binaryEditor-lookups";

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

function buildDisplayRoot(parseResult: ParseResult): ParsedGroup {
    if (parseResult.errors && parseResult.errors.length > 0) {
        return group(parseResult.root.name, [], parseResult.root.expanded, parseResult.root.description);
    }

    if (parseResult.format !== "map") {
        return parseResult.root;
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

        projectedFields.push(entry);
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
        const numericValue = typeof entry.rawValue === "number"
            ? entry.rawValue
            : typeof entry.value === "number"
                ? entry.value
                : undefined;
        const displayValue = typeof numericValue === "number"
            ? formatNumericValue(numericValue, numericFormat)
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
                enumOptions: resolveEnumLookup(parseResult.format, fieldPath, entry.name),
                flagOptions: resolveFlagLookup(parseResult.format, fieldPath, entry.name),
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
