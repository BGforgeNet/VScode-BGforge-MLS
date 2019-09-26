# Change Log

## 1.1.0
- WeiDU:
  - Fixed line breaks in CLONE_EFFECT.
  - Fixed highlighting in LAF/LPF invocation when strings contain keywords or names contain variables.
  - Fixed variable highlighing in function definition.
  - Added missing ALTER_ITEM_HEADER, INNER_PATCH.
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
- Fixed EVAL color in weidu function invocation.

## 1.0.3
- Fixed console error spam for languages with missing signatures.
- Set weidu IDS to constant scope.

## 1.0.2
- Added IN as a keyword, fix color of numbers inside parenthesis without space.
- Added THEN as a keyword, and ADD_STORE_ITEM flags.

## 1.0.1
- Fixed #NUM notaion, variable highlight in d and baf, and some missing highlight in function definitions.

## 1.0.0
- Initial release.
