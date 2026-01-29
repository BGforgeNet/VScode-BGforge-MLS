/**
 * Re-exports all public APIs from the fallout update modules.
 */

export { collectDefines, definesFromFile, findFile } from "./header-defines.js";
export { cmpStr, findFiles, litscal } from "../../../utils/src/yaml-helpers.js";
export { loadSfallFunctions, loadSfallHooks } from "./sfall-data.js";
export { dumpFalloutCompletion, dumpFalloutHighlight } from "./dump.js";
export type {
    DefineKind,
    FalloutArg,
    FalloutCompletionItem,
    HighlightPattern,
    SfallCategory,
    SfallFunction,
    SfallHook,
} from "./types.js";
