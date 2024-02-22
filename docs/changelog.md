# Changelog

## 2.1.7

Fixed compile/parse issue introduced in 2.1.6.

## 2.1.6

- Fallout
  - Sfall data update as of 4.4.2.
- IE
  - Added `WEIDU_EXECUTABLE`, `ADD_PROJECTILE` to intellisense.
  - Added `STR_CMP`, `WRITE_ASCIIL`, additional value operators to highlighting.
  - Variables in trarefs are also highlighted now.
  - IESDP data update as of 2024.02.24.

## 2.1.5

- Added translation hints to `GMessage/NMessage/BMessage`.
- Fixed highlighting for tra references with negative numbers.
- Fixed extension crash when opening a single file instead of a directory.

## 2.1.4

- Fixed wrong paths being reported by diagnostics on Linux/wine.
- Fixed compile.exe reported problems not clearing on Windows due to incorrect paths.

## 2.1.3

[Fixed](https://github.com/BGforgeNet/VScode-BGforge-MLS/issues/61) diagnostics being attributed to the wrong file when there are errors in included files.

## 2.1.2

Updated IElib, now including cleric scrolls.

## 2.1.1

Fixed `TEXT_SPRINT` imports from IElib.

## 2.1.0

- Support for Fallout `worldmap.txt`.
- Prettier `GAME_IS/INCLUDES` doc.

## 2.0.6

- Prettified `GAME_IS`, `GAME_INCLUDES` doc.
- Fixed `set_critter_stat` doc.
- Added begin-end snippet in TP2.
- Disabled outdent on `END` in TP2.
- IElib `ITEMTYPE_` constants renamed to `ITEM_TYPE_`.

## 2.0.5

- Fixed missing hovers for defines from the same file.
- Added "offset" to offset tooltips, and their values too.
- Prettified doc for `GET_OFFSET_ARRAY`, `GET_OFFSET_ARRAY2`.
- Colored `AS` ans `USING` back as keywords in TP2.
- STO v1 and item types are now imported from IESDP.

## 2.0.4

Fixed SSL compile when source or destination directory contains spaces.

## 2.0.3

Fixed patch flow control keyword color for tp2.

## 2.0.2

- SSL constant defines colored as constants.
- `scripts.lst` highlighting.
- Local functions definitions no longer override builtin language functions for SSL.
- Removed single quotes from SSL autoclose, as they don't work for quoting.
- Prettier builtin functions descriptions for SSL.

## 2.0.1

Fixed crash on mod directory open on Windows.

## 2.0.0

- New feature: docstrings.
- Settings reworked, now with pretty names and sfall compile path is separate from options.
- RPU defines are no longer loaded statically, instead all headers are searched at runtime.
- Completion and hover items show source file.
- New feature: go to definition.
- New feature: functions can be marked as deprecated.
- New features: validate on save, validate on change.
- Prettier completion items (less plaintext, more markdown).
- Completion and hovers for WeiDU `D` format.
- Added file icons for `TRA`, `MSG`, `SSL` files.
- New feature: hover tooltips for `TRA`/`MSG` references.
- New feature: header support for WeiDU (`TPH`). Completion, hover, go to definition.
- Improved `TP2` tooltip highlighting.
- New feature: inlay hints for `TRA`/`MSG` references.
- For `TP2`, `READ_*` and `WRITE_*` patch highlitht style aligned with corresponding IElib types' styles.
- In `TP2`, action and patch flow control tokens switched to native action/patch highlight style.
- New feature: callgraph for `SSL`.
- Various smaller changes, mostly styling.
- Minimal VScode version is 1.69.2.

## 1.16.3

- IE
  - Only include BG2/EE `spell.ids` defines from IElib, as some of IWD spells clash with those.
  - Added missing `STRING_COMPARE_REGEXP` to syntax highlighting.
- Fallout
  - Update headers to RPU v26, sfall v4.3.3.1.
  - Note Smooth Talker for `giQ_Option` tooltip.

## 1.16.2

- IE
  - Added missing "GTIMES.IDS" and "LOCAL_SET/LOCAL_TEXT_SPRINT/LOCAL_SPRINT".
  - Added some missing WeiDU control keywords,

## 1.16.1

- Fallout
  - Added `start_gialog`/`start_gdialog` synonyms.
  - Added notes about visibility and `move_to` during fallout [game load](https://github.com/phobos2077/sfall/issues/380).
- IE
  - Fixed typo in `CLERIC_FAVOR_OR_ILMATER`.
  - Added some missing `tp2-vars` to autocompletion.
  - Added one missing spell to `spell-ids-iwdee`.
  - Allow more char types in weidu var names.
  - Added some missing STO-related functions.

## 1.16.0

- Fallout
  - Updated [RPU](https://github.com/BGforgeNet/Fallout2_Restoration_Project) defines to v21, [sfall](https://github.com/phobos2077/sfall) to 4.3.0.2.
  - Clarified `set_obj_visibility` description.
- IE
  - Updated [IESDP](https://gibberlings3.github.io/iesdp/) and [IElib](https://ielib.bgforge.net/) defines.
  - Added custom [icon theme](https://github.com/BGforgeNet/VScode-BGforge-MLS/blob/master/docs/icon-theme.md).
  - Added rudimentary gcc [preprocessing](https://forums.bgforge.net/viewtopic.php?f=35&t=334) support.

## 1.15.3

- Fallout
  - Updated data from upstream.
  - Added more preprocessor directives: highlighting, completion, indentation.
  - Moved comments higher in highlighting for better performance.
- IE
  - Updated data from upstream.
  - Fixed highlighting for var names with `-`.

## 1.15.2

- Fallout
  - Fixed displaying source files for dynamically loaded defines.
- IE
  - WeiDU is now searched in system PATH by default.

## 1.15.1

- IE
  - Added `LAF`, `LPM`, `LPF` and `LAM` to tooltips.
  - For `LAUNCH_ACTION_MACRO`, `LAUNCH_PATCH_MACRO` set proper action/patch color.
  - Fixed color of `DEFINE_ACTION_MACRO`, `DEFINE_PATCH_MACRO`. Properly color `DEFINE_ACTION_FUNCTION`, `DEFINE_PATCH_FUNCTION` when `BEGIN` is on the same line.
  - Updated defines from upstream.
- Fallout
  - Updated defines from upstream.

## 1.15.0

- Added basic indentation rules for Fallout SSL, WeiDU BAF and TP2.
- Added IF-THEN block snippet for BAF.

## 1.14.1

Fixed 1.14.0 packaging issue.

## 1.14.0

- IE:
  - Added support for `TPA`, `TPH`, `TPP` `BAF` and `D` parsing with new WeiDU v247.
  - New keywords from WeiDU v247.
  - More details for some WeiDU constants.
  - Updated IESDP defines.
- Fallout:
  - Updated RPU and sfall defines.

## 1.13.0

- General:
  - Added a custom theme to allow futher tailoring of the style.
- IE:
  - Added support for importing file formats from IESDP.
  - Clearly separated actions from patches, coloring them differently.
  - Changed tp2 values to be italic blue to distinguish them from actions.
  - IElib and IESDP constants now display type in tooltip, IElib ones also display value.
  - Known IElib functions are now colored according to their type, even if invocation is wrong.
  - Duplicate constants removed from completion.
- Fallout:
  - Updated RP and sfall defines.

## 1.12.0

- IE:
  - Added weidu's `GET_OFFSET_ARRAY/2` predefined sets to completion.
  - Added support for [IElib](https://ielib.bgforge.net) functions.
  - Fixed IElib's constants coloring inside associative array declarations.

## 1.11.0

- IE:
  - Updated [IElib](https://github.com/BGforgeNet/BGforge-MLS-IElib) and [IESDP](https://iesdp.bgforge.net) defines.
  - Added WeiDU's `REM`.

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
