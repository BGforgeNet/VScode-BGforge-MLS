# Changelog

## 1.10.0
- General:
  - Switched all helper scripts to Ruamel for YAML.
- IE:
  - Added WeiDU's `LOCAL_SET`, `LOCAL_SPRINT`, `WITH`, `DEFAULT`, multuple `SOURCE_*` vars.
  - Fixed `TargetBlock`/`TriggerBlock` highlighting in SSL.
  - Updated [IElib](https://github.com/BGforgeNet/BGforge-MLS-IElib) and [IESDP](https://iesdp.bgforge.net) defines.
  - Fixed error in WeiDU completion formatting, which was breaking some completion items.
- Fallout:
  - Updated sfall and [RPU](https://github.com/BGforgeNet/Fallout2_Restoration_Project) defines.

## 1.9.1
 - General:
  - Reverted client to `vscode` module to fix missing tooltips.

## 1.9.0
- General:
  - Switched to `@types/vscode` for tests, removed old unused dependencies, bumped minimal VScode version.
- IE:
  - Fixed dashes/quotes in function names breaking highlighting.
  - Fixed dashes in SLB `TARGET` breaking highlighting.
  - Added support for array construct highlighting.
- Fallout:
  - Updated RP defines.

## 1.8.0
- Common:
  - Fixed hovers display/highlight.
- IE:
  - Added `WRITE_ASCIIL`, `WRITE_ASCIIT`, `WRITE_ASCIIE`, `BUT_ONLY`, `STR_EQ`, `STR_CMP`, `R_B_B`, `ON_MISMATCH` aliases.
  - Added text defines, in particular spell names.
  - Added support for partial syntax: inlined BAF scripts.
  - Added `kit.ids` defines.
  - Added some hidden script actions.
  - Added completion for BAF actions (BG2/EE only).
  - Fixed shorted highlighting keys overriding longer ones in some cases.
  - Fixed highlighting of unbalanced `%`s for [IElib](https://github.com/BGforgeNet/BGforge-MLS-IElib) defines.
- Fallout:
  - Loaded aliased defines from RP.
  - Allowed empty arg list for ssl function invocation.
  - Allowed whitespace between function name and parentheses.
  - Updated sfall defines to version 4.2.3+develop.

## 1.7.0
- IE:
  - Added colorization for [IElib](https://github.com/BGforgeNet/BGforge-MLS-IElib) defines.
- Fallout:
  - Fixed colorization bug when procedure begins on the next line.

## 1.6.0
- IE:
  - More symbolic references.
  - Added support for hexadecimal numbers in BAF and D files.
  - Removed '(?i)' from triggers: everything is case sensitive now.
  - Colored ELSE and THIS.
Fallout:
  - Updated definitions: sfall 4.2.2, RPU 12.

## 1.5.4
- IE:
  - Fixed highlighting for double variable references.

## 1.5.3
- IE:
  - Added highlighting for double variable references (`EVAL ~%%my%_var%~`).

## 1.5.2
- IE:
  - Really really fixed macro invocation highlighting.

## 1.5.1
- IE:
  - Really fixed macro invocation highlighting.

## 1.5.0
- IE:
  - Added support for Sword Coast Stratagems Scripting Language.
  - Fixed macro invocation highlighting.
  - Added vars highlighting in tra strings.
  - Added many more IDS tokens.

## 1.4.0
- IE:
  - Added syntax highlighting for IWD:EE `spell.ids` tokens.
  - Fixed `PLAYER1-PLAYER6` highlighing in `tra` files.

## 1.3.0
- IE:
  - Added `2da` syntax highlighting.

## 1.2.0
- WeiDU:
  - Added `tra` syntax highlighting.
- Fallout:
  - Added `msg` syntax highlighting.
  - Added missing `ifndef`, `endif`, `%`.

## 1.1.0
- WeiDU:
  - Fixed line breaks in `CLONE_EFFECT`.
  - Fixed highlighting in `LAF`/`LPF` invocation when strings contain keywords or names contain variables.
  - Fixed variable highlighing in function definition.
  - Added missing `ALTER_ITEM_HEADER`, `INNER_PATCH`.
- Fallout SSL:
  - Added highlighting for defines (constants, variables, defines with variables, procedures) from [sfall](https://github.com/phobos2077/sfall/) and [RPU](https://github.com/BGforgeNet/Fallout2_Restoration_Project) headers.
  - Added support for automatic update of defines sfall/RPU headers.
  - Added LVARs highlighting.
  - Added descriptions for builtin procedures (`map_enter_p_proc`, etc).
  - Fixed `obj_being_used_with` description.

## 1.0.9
- FSSL: added support for more data types and standartized display of functions without args (strip parhenthesis).
- Last built-in WeiDU macros added.
- Allow to compile files uppercased names.

## 1.0.8
- Added more WeiDU macros.
- Added newlines to WeiDU macro docs.
- Updated Fallout module with latest functions and hooks.
- Fixed import typo in server.

## 1.0.7
- Added WeiDU patch and macro functions.
- Fixed minor typos.

## 1.0.6
- Fixed detail missing from weidu completion.

## 1.0.5
- More IE constants supported.

## 1.0.4
- Fixed comment color in weidu function invocation.
- Fixed `EVAL` color in weidu function invocation.

## 1.0.3
- Fixed console error spam for languages with missing signatures.
- Set weidu IDS to constant scope.

## 1.0.2
- Added IN as a keyword, fix color of numbers inside parenthesis without space.
- Added THEN as a keyword, and ADD_STORE_ITEM flags.

## 1.0.1
- Fixed `#NUM` notation, variable highlight in `d` and `baf`, and some missing highlight in function definitions.

## 1.0.0
- Initial release.
