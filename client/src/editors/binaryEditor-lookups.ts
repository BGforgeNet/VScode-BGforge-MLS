import {
    BodyType,
    ContainerFlags,
    CritterFlags,
    DamageType,
    ElevatorType,
    FRMType,
    HeaderFlags,
    ItemFlagsExt,
    ItemSubType,
    KillType,
    MaterialType,
    ObjectType,
    ScenerySubType,
    ScriptType as ProScriptType,
    StatType,
    WallLightFlags,
    ActionFlags,
    WeaponAnimCode,
} from "../parsers/pro-types";
import {
    MapElevation,
    MapFlags,
    ObjectFlags,
    Rotation,
    ScriptProc,
    ScriptFlags,
    Skill,
} from "../parsers/map-types";

const PRO_ENUM_TABLES: Record<string, Record<number, string>> = {
    "Object Type": ObjectType,
    "FRM Type": FRMType,
    "Sub Type": { ...ItemSubType, ...ScenerySubType },
    "Material": MaterialType,
    "Damage Type": DamageType,
    "Body Type": BodyType,
    "Kill Type": KillType,
    "Elevator Type": ElevatorType,
    "Animation Code": WeaponAnimCode,
    "Stat 0": StatType,
    "Stat 1": StatType,
    "Stat 2": StatType,
    "Script Type": ProScriptType,
    "Gender": { 0: "Male", 1: "Female" },
};

const PRO_FLAG_TABLES: Record<string, Record<number, string>> = {
    "Flags": HeaderFlags,
    "Flags Ext": ItemFlagsExt,
    "Wall Light Flags": WallLightFlags,
    "Action Flags": ActionFlags,
    "Open Flags": ContainerFlags,
    "Critter Flags": CritterFlags,
};

const MAP_ENUM_TABLES: Record<string, Record<number, string>> = {
    "Default Elevation": MapElevation,
    "Default Orientation": Rotation,
    "Rotation": Rotation,
    "Elevation": MapElevation,
    "Destination Elevation": MapElevation,
    "Destination Rotation": Rotation,
};

const MAP_FLAG_TABLES: Record<string, Record<number, string>> = {
    "Map Flags": MapFlags,
};

const SCRIPT_PROC_DROPDOWN = Object.fromEntries(
    Object.entries(ScriptProc).filter(([, value]) => value !== "none_x_bad")
) as Record<number, string>;

export function resolveEnumLookup(
    format: string,
    _fieldPath: string,
    fieldName: string,
): Record<number, string> | undefined {
    if (format === "pro") {
        return PRO_ENUM_TABLES[fieldName];
    }

    if (format !== "map") {
        return undefined;
    }

    if (/^Entry \d+ Action$/.test(fieldName)) {
        return SCRIPT_PROC_DROPDOWN;
    }

    if (/^Entry \d+ Action Being Used$/.test(fieldName)) {
        return Skill;
    }

    return MAP_ENUM_TABLES[fieldName];
}

export function resolveFlagLookup(
    format: string,
    fieldPath: string,
    fieldName: string,
): Record<number, string> | undefined {
    if (format === "pro") {
        return PRO_FLAG_TABLES[fieldName];
    }

    if (format !== "map") {
        return undefined;
    }

    if (MAP_FLAG_TABLES[fieldName]) {
        return MAP_FLAG_TABLES[fieldName];
    }

    if (/^Entry \d+ Flags$/.test(fieldName)) {
        return ScriptFlags;
    }

    if (fieldName === "Flags" && fieldPath.includes("Objects Section.")) {
        return ObjectFlags;
    }

    return undefined;
}

export function resolveDisplayValue(
    format: string,
    fieldPath: string,
    fieldName: string,
    rawValue: number,
): string {
    const enumTable = resolveEnumLookup(format, fieldPath, fieldName);
    if (enumTable) {
        const label = enumTable[rawValue];
        return label !== undefined ? formatEnumDisplayValue(label, rawValue) : `Unknown (${rawValue})`;
    }

    const flagTable = resolveFlagLookup(format, fieldPath, fieldName);
    if (flagTable) {
        const flags: string[] = [];
        for (const [bit, name] of Object.entries(flagTable)) {
            const bitVal = Number(bit);
            if (bitVal === 0) {
                if (rawValue === 0) flags.push(name);
            } else if (rawValue & bitVal) {
                flags.push(name);
            }
        }
        return flags.length > 0 ? flags.join(", ") : "(none)";
    }

    return String(rawValue);
}

export function formatEnumDisplayValue(label: string, rawValue: number): string {
    return label === String(rawValue) ? label : `${label} (${rawValue})`;
}
