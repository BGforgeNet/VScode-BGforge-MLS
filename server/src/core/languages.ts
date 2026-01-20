/**
 * Typed language registry.
 * Single source of truth for all language IDs used in the extension.
 * Language IDs must match those defined in package.json contributes.languages.
 */

// Fallout languages
export const LANG_FALLOUT_SSL = "fallout-ssl" as const;
/** SSL header file extensions for file watching */
export const EXT_FALLOUT_SSL_HEADERS = [".h"] as const;
export const LANG_FALLOUT_SSL_TOOLTIP = "fallout-ssl-tooltip" as const;
export const LANG_FALLOUT_WORLDMAP_TXT = "fallout-worldmap-txt" as const;
// Used only in TRANSLATION_FILE_LANGUAGES below
const LANG_FALLOUT_MSG = "fallout-msg" as const;

// TypeScript-based languages (TSSL, TBAF, TD)
// These use "typescript" langId but are identified by file extension
export const LANG_TYPESCRIPT = "typescript" as const;
export const EXT_TSSL = ".tssl" as const;
export const EXT_TBAF = ".tbaf" as const;
export const EXT_TD = ".td" as const;

// WeiDU languages
export const LANG_WEIDU_TP2 = "weidu-tp2" as const;
/** TP2 header file extension - defines shareable functions/macros */
export const EXT_WEIDU_TPH = ".tph" as const;
/** TP2 file extensions for file watching */
export const EXT_WEIDU_TP2 = [EXT_WEIDU_TPH, ".tpa", ".tpp", ".tp2"] as const;
export const LANG_WEIDU_TP2_TOOLTIP = "weidu-tp2-tooltip" as const;
export const LANG_WEIDU_TP2_TPL = "weidu-tp2-tpl" as const;
export const LANG_WEIDU_BAF = "weidu-baf" as const;
export const LANG_WEIDU_D = "weidu-d" as const;
export const LANG_WEIDU_D_TPL = "weidu-d-tpl" as const;
export const LANG_WEIDU_SLB = "weidu-slb" as const;
export const LANG_WEIDU_SSL = "weidu-ssl" as const;
// Used only in TRANSLATION_FILE_LANGUAGES below
const LANG_WEIDU_TRA = "weidu-tra" as const;

/**
 * Languages that support .tra translation references (@123 style).
 */
export const TRA_LANGUAGES: string[] = [
    LANG_WEIDU_BAF,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_SSL,
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TPL,
    LANG_TYPESCRIPT, // TBAF uses .tra references
];

/**
 * Languages that contain translation strings (msg/tra files).
 */
export const TRANSLATION_FILE_LANGUAGES: string[] = [LANG_FALLOUT_MSG, LANG_WEIDU_TRA];

/**
 * Languages that show .msg file references (Fallout style: mstr(123), NOption(123)).
 */
export const MSG_LANGUAGES: string[] = [
    LANG_FALLOUT_SSL,
    LANG_TYPESCRIPT, // TSSL uses .msg references
];
