/**
 * Legacy data types.
 *
 * Contains the HeaderData interface used by header-parser and other legacy code
 * during the transition to the unified Symbols system.
 */

import * as completion from "./shared/completion";
import * as definition from "./shared/definition";
import * as hover from "./shared/hover";
import * as signature from "./shared/signature";

/** Generic processed data from headers */
export interface HeaderData {
    completion: completion.CompletionListEx;
    hover: hover.HoverMapEx;
    definition: definition.Data;
    signature?: signature.SigMap;
}
