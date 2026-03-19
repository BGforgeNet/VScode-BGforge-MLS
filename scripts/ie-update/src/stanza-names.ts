import { WEIDU_TP2_STANZAS } from "../../../shared/stanza-names.js";

/** IE update-only stanza names used when generating IElib/IESDP data. */
export const IESDP_STANZAS = {
    iesdp_byte: "iesdp_byte",
    iesdp_char: "iesdp_char",
    iesdp_dword: "iesdp_dword",
    iesdp_other: "iesdp_other",
    iesdp_resref: "iesdp_resref",
    iesdp_strref: "iesdp_strref",
    iesdp_word: "iesdp_word",
} as const;

/** IE update-only stanza names used when generating IElib data. */
export const IELIB_STANZAS = {
    action_functions: WEIDU_TP2_STANZAS.action_functions,
    ielib_int: "ielib_int",
    ielib_resref: "ielib_resref",
    patch_functions: WEIDU_TP2_STANZAS.patch_functions,
} as const;
