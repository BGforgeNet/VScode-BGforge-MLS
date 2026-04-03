import type { ParseResult, ParsedField, ParsedGroup } from "../parsers";

function field(name: string, value: unknown, offset: number, size: number, type: string, rawValue?: number): ParsedField {
    return { name, value, offset, size, type, rawValue };
}

function group(name: string, fields: (ParsedField | ParsedGroup)[], expanded = true, description?: string): ParsedGroup {
    return { name, fields, expanded, description };
}

function isGroup(entry: ParsedField | ParsedGroup): entry is ParsedGroup {
    return "fields" in entry;
}

function findGroup(root: ParsedGroup, groupName: string): ParsedGroup | undefined {
    return root.fields.find((entry) => isGroup(entry) && entry.name === groupName) as ParsedGroup | undefined;
}

function countNamedGroups(groupNode: ParsedGroup, predicate: (name: string) => boolean): number {
    return groupNode.fields.filter((entry) => isGroup(entry) && predicate(entry.name)).length;
}

function countNoteFields(groupNode: ParsedGroup): number {
    return groupNode.fields.filter((entry) => !isGroup(entry) && entry.name === "TODO").length;
}

export function buildBinaryEditorParseResult(parseResult: ParseResult): ParseResult {
    if (parseResult.format !== "map") {
        return parseResult;
    }

    const compactFields: (ParsedField | ParsedGroup)[] = [];

    const headerGroup = findGroup(parseResult.root, "Header");
    if (headerGroup) {
        compactFields.push(headerGroup);
    }

    const globalVars = findGroup(parseResult.root, "Global Variables");
    if (globalVars) {
        compactFields.push(group("Global Variables", [
            field("Count", globalVars.fields.length, 0, 0, "summary"),
        ]));
    }

    const localVars = findGroup(parseResult.root, "Local Variables");
    if (localVars) {
        compactFields.push(group("Local Variables", [
            field("Count", localVars.fields.length, 0, 0, "summary"),
        ]));
    }

    const tileSummaries: ParsedField[] = [];
    for (const entry of parseResult.root.fields) {
        if (!isGroup(entry)) continue;
        const match = /^Elevation (\d+) Tiles$/.exec(entry.name);
        if (!match) continue;
        const elevation = Number(match[1]);
        tileSummaries.push(field(`Elevation ${elevation} Non-Default Tiles`, entry.fields.length / 4, 0, 0, "summary"));
    }
    if (tileSummaries.length > 0) {
        compactFields.push(group("Tiles", tileSummaries));
    }

    const scriptSummaries: ParsedField[] = [];
    for (const entry of parseResult.root.fields) {
        if (!isGroup(entry) || !entry.name.endsWith(" Scripts")) continue;
        const label = entry.name;
        const extentCount = countNamedGroups(entry, (name) => name.startsWith("Extent "));
        scriptSummaries.push(field(label, extentCount, 0, 0, "summary"));
    }
    if (scriptSummaries.length > 0) {
        compactFields.push(group("Scripts", scriptSummaries));
    }

    const objectsGroup = findGroup(parseResult.root, "Objects Section");
    if (objectsGroup) {
        const objectSummaryFields: (ParsedField | ParsedGroup)[] = [];
        for (const entry of objectsGroup.fields) {
            if (!isGroup(entry)) {
                if (entry.name === "Total Objects") {
                    objectSummaryFields.push(entry);
                }
                continue;
            }

            if (!entry.name.startsWith("Elevation ")) {
                continue;
            }

            const countField = entry.fields.find((child) => !isGroup(child) && child.name === "Object Count") as ParsedField | undefined;
            if (!countField) {
                continue;
            }

            objectSummaryFields.push(field(`${entry.name} Count`, countField.value, countField.offset, 0, "summary"));
        }

        const todoCount = countNoteFields(objectsGroup);
        if (todoCount > 0) {
            objectSummaryFields.push(field(
                "TODO",
                "Full object browsing requires lazy loading and PRO-backed subtype resolution.",
                0,
                0,
                "note"
            ));
        }

        compactFields.push(group("Objects", objectSummaryFields));
    }

    return {
        ...parseResult,
        root: group(parseResult.root.name, compactFields),
    };
}
