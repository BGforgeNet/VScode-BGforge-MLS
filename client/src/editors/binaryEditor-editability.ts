import type { ParsedField } from "../parsers";

function isPotentiallyEditableValue(field: ParsedField): boolean {
    return field.type === "enum" || field.type === "flags" || field.type.includes("int") || field.type.includes("uint");
}

function isMapFieldEditable(fieldPath: string, fieldName: string): boolean {
    if (fieldPath.startsWith("Header.")) {
        if (fieldName === "Version" || fieldName === "Num Local Vars" || fieldName === "Num Global Vars") {
            return false;
        }
    }

    if (fieldPath.includes(" Scripts.")) {
        if (fieldName === "Extent Length" || fieldName === "Extent Next") {
            return false;
        }

        if (
            /^Entry \d+ (Local Vars Offset|Num Local Vars|Program Pointer Slot|Unknown Field 0x48|Legacy Field 0x50)$/.test(fieldName)
        ) {
            return false;
        }
    }

    if (fieldPath.includes("Objects Section.")) {
        if (
            fieldName === "Total Objects"
            || fieldName === "Object Count"
            || fieldName === "Field 74"
            || fieldName === "Inventory Length"
            || fieldName === "Inventory Capacity"
            || fieldName === "Inventory Pointer"
        ) {
            return false;
        }
    }

    return true;
}

export function isEditableFieldForFormat(format: string, fieldPath: string, field: ParsedField): boolean {
    if (!isPotentiallyEditableValue(field)) {
        return false;
    }

    if (format === "map") {
        return isMapFieldEditable(fieldPath, field.name);
    }

    return true;
}
