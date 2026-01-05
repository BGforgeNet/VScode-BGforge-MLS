/**
 * Typed language registry.
 * Single source of truth for all language IDs used in the extension.
 * Language IDs must match those defined in package.json contributes.languages.
 */

// Fallout languages
export const LANG_FALLOUT_SSL = "fallout-ssl" as const;
export const LANG_FALLOUT_SSL_TOOLTIP = "fallout-ssl-tooltip" as const;
export const LANG_FALLOUT_WORLDMAP_TXT = "fallout-worldmap-txt" as const;
// Used only in TRANSLATION_FILE_LANGUAGES below
const LANG_FALLOUT_MSG = "fallout-msg" as const;

// WeiDU languages
export const LANG_WEIDU_TP2 = "weidu-tp2" as const;
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
 * Languages that support translation (inlay hints).
 */
export const TRANSLATION_LANGUAGES: string[] = [
    LANG_WEIDU_BAF,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_SSL,
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TPL,
];

/**
 * Languages that contain translation strings (msg/tra files).
 */
export const TRANSLATION_FILE_LANGUAGES: string[] = [LANG_FALLOUT_MSG, LANG_WEIDU_TRA];

/**
 * Languages that show msg file references (Fallout).
 */
export const MSG_LANGUAGES: string[] = [LANG_FALLOUT_SSL];

/**
 * Languages that can be compiled/parsed.
 */
export const COMPILABLE_FALLOUT: string[] = [LANG_FALLOUT_SSL];
export const COMPILABLE_WEIDU: string[] = [
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TPL,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_BAF,
];
