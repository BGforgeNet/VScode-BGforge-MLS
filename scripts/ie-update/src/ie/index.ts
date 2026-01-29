/**
 * Re-exports all ie/ module public APIs.
 * Serves the same role as the Python ie/__init__.py with wildcard imports.
 */

export { opcodeNameToId } from "./opcodes.js";

export {
    getOffsetPrefix,
    getFormatVersion,
    getOffsetId,
    stringToId,
    getOffsetSize,
    validateOffset,
    offsetIsUnused,
    offsetsToDefinition,
} from "./offsets.js";

export { getItemTypes, saveItemTypesIelib, getItemTypesIsense } from "./item-types.js";

export {
    actionAliasDesc,
    actionDesc,
    actionDescAbsoluteUrls,
    appendUnique,
    actionDetail,
} from "./actions.js";

export {
    cmpStr,
    litscal,
    findFiles,
    createItemsSeq,
    dumpCompletion,
    dumpHighlight,
    dumpDefinition,
    stripLiquid,
    checkCompletion,
} from "./common.js";

export type {
    CompletionItem,
    IEDataEntry,
    IEData,
    OffsetItem,
    ActionItem,
    ActionParam,
    IESDPGame,
    ItemType,
    ItemTypeRaw,
    OpcodeEntry,
    ProcessedIESDPData,
    FuncData,
    FuncParam,
    FuncReturn,
    TypeEntry,
} from "./types.js";

export { COMPLETION_TYPE_CONSTANT, COMPLETION_TYPE_FUNCTION } from "./types.js";

export {
    validateActionItem,
    validateArray,
    validateFuncData,
    validateIESDPGame,
    validateItemTypeRaw,
    validateOffsetItem,
    validateTypeEntry,
} from "./validate.js";
