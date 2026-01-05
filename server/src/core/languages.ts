/**
 * Typed language registry.
 * Single source of truth for all language IDs used in the extension.
 * Language IDs must match those defined in package.json contributes.languages.
 */

// Fallout languages
export const LANG_FALLOUT_SSL = "fallout-ssl" as const;
export const LANG_FALLOUT_SSL_TOOLTIP = "fallout-ssl-tooltip" as const;
export const LANG_FALLOUT_MSG = "fallout-msg" as const;
export const LANG_FALLOUT_SCRIPTS_LST = "fallout-scripts-lst" as const;
export const LANG_FALLOUT_WORLDMAP_TXT = "fallout-worldmap-txt" as const;

// WeiDU languages
export const LANG_WEIDU_TP2 = "weidu-tp2" as const;
export const LANG_WEIDU_TP2_TOOLTIP = "weidu-tp2-tooltip" as const;
export const LANG_WEIDU_TP2_TPL = "weidu-tp2-tpl" as const;
export const LANG_WEIDU_BAF = "weidu-baf" as const;
export const LANG_WEIDU_BAF_TOOLTIP = "weidu-baf-tooltip" as const;
export const LANG_WEIDU_D = "weidu-d" as const;
export const LANG_WEIDU_D_TOOLTIP = "weidu-d-tooltip" as const;
export const LANG_WEIDU_D_TPL = "weidu-d-tpl" as const;
export const LANG_WEIDU_SLB = "weidu-slb" as const;
export const LANG_WEIDU_SSL = "weidu-ssl" as const;
export const LANG_WEIDU_TRA = "weidu-tra" as const;

// Infinity Engine
export const LANG_IE_2DA = "infinity-2da" as const;

// Internal syntax highlighting helpers
export const LANG_MLS_COMMENT = "bgforge-mls-comment" as const;
export const LANG_MLS_STRING = "bgforge-mls-string" as const;
export const LANG_MLS_DOCSTRING = "bgforge-mls-docstring" as const;

/**
 * Union type of all valid language IDs.
 */
export type LanguageId =
    | typeof LANG_FALLOUT_SSL
    | typeof LANG_FALLOUT_SSL_TOOLTIP
    | typeof LANG_FALLOUT_MSG
    | typeof LANG_FALLOUT_SCRIPTS_LST
    | typeof LANG_FALLOUT_WORLDMAP_TXT
    | typeof LANG_WEIDU_TP2
    | typeof LANG_WEIDU_TP2_TOOLTIP
    | typeof LANG_WEIDU_TP2_TPL
    | typeof LANG_WEIDU_BAF
    | typeof LANG_WEIDU_BAF_TOOLTIP
    | typeof LANG_WEIDU_D
    | typeof LANG_WEIDU_D_TOOLTIP
    | typeof LANG_WEIDU_D_TPL
    | typeof LANG_WEIDU_SLB
    | typeof LANG_WEIDU_SSL
    | typeof LANG_WEIDU_TRA
    | typeof LANG_IE_2DA
    | typeof LANG_MLS_COMMENT
    | typeof LANG_MLS_STRING
    | typeof LANG_MLS_DOCSTRING;

/**
 * All language IDs as an array.
 */
export const ALL_LANGUAGE_IDS: LanguageId[] = [
    LANG_FALLOUT_SSL,
    LANG_FALLOUT_SSL_TOOLTIP,
    LANG_FALLOUT_MSG,
    LANG_FALLOUT_SCRIPTS_LST,
    LANG_FALLOUT_WORLDMAP_TXT,
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TOOLTIP,
    LANG_WEIDU_TP2_TPL,
    LANG_WEIDU_BAF,
    LANG_WEIDU_BAF_TOOLTIP,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TOOLTIP,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_SLB,
    LANG_WEIDU_SSL,
    LANG_WEIDU_TRA,
    LANG_IE_2DA,
    LANG_MLS_COMMENT,
    LANG_MLS_STRING,
    LANG_MLS_DOCSTRING,
];

/**
 * Language groups for convenience.
 * Arrays typed as string[] to allow .includes(langId) where langId is string.
 */
export const FALLOUT_LANGUAGES: string[] = [
    LANG_FALLOUT_SSL,
    LANG_FALLOUT_MSG,
    LANG_FALLOUT_SCRIPTS_LST,
    LANG_FALLOUT_WORLDMAP_TXT,
];

export const WEIDU_LANGUAGES: string[] = [
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TPL,
    LANG_WEIDU_BAF,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_SLB,
    LANG_WEIDU_SSL,
    LANG_WEIDU_TRA,
];

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
