# tree-sitter-weidu-tp2

Tree-sitter grammar for WeiDU TP2 files.

## TP2 Syntax Reference

TP2 files define mod installation scripts for WeiDU modding.

### File Types

| Extension | Context | Description |
|-----------|---------|-------------|
| `.tp2` | Full | Complete mod file (prologue + components) |
| `.tpa` | Actions | Action library (included via INCLUDE) |
| `.tph` | Actions | Action header (included via INCLUDE) |
| `.tpp` | Patches | Patch library (included via INCLUDE) |

### TP2 File Structure

```tp2
BACKUP ~mymod/backup~
AUTHOR ~email@example.com~

// TP2 Flags
VERSION ~1.0~

// Languages
LANGUAGE ~English~ ~english~ ~english/setup.tra~

// Components
BEGIN ~Component Name~
  // Actions...
```

### Prologue

```tp2
BACKUP ~directoryName~           // Backup location for uninstall
AUTHOR ~emailAddress~            // Bug report contact
SUPPORT ~emailAddress~           // Alias for AUTHOR
```

### TP2 Flags

| Flag | Syntax | Description |
|------|--------|-------------|
| AUTO_TRA | `AUTO_TRA ~path~` | Auto-load TRA files matching D files |
| ALLOW_MISSING | `ALLOW_MISSING file...` | Allow missing files (creates empty) |
| ASK_EVERY_COMPONENT | `ASK_EVERY_COMPONENT` | Ask about each component individually |
| ALWAYS | `ALWAYS ... END` | Execute before every component |
| README | `README file...` | Display readme after language selection |
| UNINSTALL_ORDER | `UNINSTALL_ORDER ops...` | Customize uninstall order |
| MODDER | `MODDER options...` | Enable debug info |
| VERSION | `VERSION ~string~` | Append to component names in log |
| SCRIPT_STYLE | `SCRIPT_STYLE BG\|IWD1\|IWD2\|PST` | BAF/BCS parsing style |
| NO_IF_EVAL_BUG | `NO_IF_EVAL_BUG` | Fix IF_EVAL bug |
| QUICK_MENU | `QUICK_MENU ...` | Define component groups |
| AUTO_EVAL_STRINGS | `AUTO_EVAL_STRINGS` | Auto EVALUATE_BUFFER |

### Language

```tp2
LANGUAGE ~languageName~ ~directory~ ~tra1.tra~ ~tra2.tra~
```

- `languageName` - Display name (e.g., "American English")
- `directory` - TRA file subdirectory (e.g., "english")
- `tra*.tra` - Default TRA files to load

### Component

```tp2
BEGIN ~componentName~
  // Component flags...
  // Actions...
```

### Component Flags

| Flag | Syntax | Description |
|------|--------|-------------|
| DEPRECATED | `DEPRECATED ~message~` | Mark as deprecated, auto-uninstall |
| REQUIRE_COMPONENT | `REQUIRE_COMPONENT ~mod~ ~comp~ ~msg~` | Require another component |
| FORBID_COMPONENT | `FORBID_COMPONENT ~mod~ ~comp~ ~msg~` | Forbid another component |
| REQUIRE_PREDICATE | `REQUIRE_PREDICATE value ~msg~` | Require condition |
| SUBCOMPONENT | `SUBCOMPONENT ~group~ [value]` | Mutually exclusive group |
| FORCED_SUBCOMPONENT | `FORCED_SUBCOMPONENT ~group~ [value]` | Forced subcomponent |
| GROUP | `GROUP ~group~ [value]` | Display grouping |
| INSTALL_BY_DEFAULT | `INSTALL_BY_DEFAULT` | Auto-install without asking |
| DESIGNATED | `DESIGNATED number` | Set component number |
| NO_LOG_RECORD | `NO_LOG_RECORD` | Don't log (can't uninstall) |
| LABEL | `LABEL ~identifier~` | Unique textual identifier |
| METADATA | `METADATA ~data~` | Associate metadata |

### String Types

| Type | Example | Status |
|------|---------|--------|
| Double quote | `"text"` | Supported |
| Tilde | `~text~` | Supported |
| Five tildes | `~~~~~text~~~~~` | Supported |
| Percent | `%text%` | Not supported (conflicts with variable refs) |

### Variable References

All syntaxes are equivalent in expression context:

| Syntax | Example | Description |
|--------|---------|-------------|
| Bare | `myvar` | Direct reference |
| Percent | `%myvar%` | Explicit variable (needed in strings) |
| Double-quoted | `"myvar"` | Quoted reference |
| Double-quoted percent | `"%myvar%"` | Quoted explicit reference |
| Tilde-quoted percent | `~%myvar%~` | Tilde-quoted explicit reference |

### Other References

| Type | Example | Description |
|------|---------|-------------|
| TRA ref | `@123` | Translation file reference |
| Array | `$array(index)` | Array element access |

### Comments

```tp2
// Line comment
/* Block comment */
```

### Expressions (Values)

#### Arithmetic Operators

| Operator | Description |
|----------|-------------|
| `+` | Addition |
| `-` | Subtraction |
| `*` | Multiplication |
| `/` | Division (rounds toward zero) |
| `**` | Exponentiation |
| `MODULO`, `REM`, `MOD`, `%` | Remainder |
| `** (n d)` | Fractional exponentiation (n/d power) |

#### Comparison Operators

| Operator | Description |
|----------|-------------|
| `=`, `==` | Equal |
| `!=` | Not equal |
| `<`, `>`, `<=`, `>=` | Comparison |

#### Logical Operators

| Operator | Description |
|----------|-------------|
| `AND`, `&&` | Conjunction |
| `OR`, `\|\|` | Disjunction |
| `NOT`, `!` | Negation |

#### Bitwise Operators

| Operator | Description |
|----------|-------------|
| `BAND`, `&` | Bitwise AND |
| `BOR`, `\|` | Bitwise OR |
| `BXOR`, `^^` | Bitwise XOR |
| `BNOT` | Bitwise NOT |
| `BLSL`, `<<` | Logical shift left |
| `BLSR`, `>>` | Logical shift right |
| `BASR` | Arithmetic shift right |

#### Unary Operators

| Operator | Description |
|----------|-------------|
| `-` | Negation |
| `ABS` | Absolute value |
| `NOT`, `!` | Logical NOT |
| `BNOT` | Bitwise NOT |

#### Ternary Operator

```tp2
condition ? then_value : else_value
```

#### Memory Access

| Expression | Description |
|------------|-------------|
| `BYTE_AT offset` | 8-bit value at offset |
| `SBYTE_AT offset` | 8-bit signed value |
| `SHORT_AT offset` | 16-bit value |
| `SSHORT_AT offset` | 16-bit signed value |
| `LONG_AT offset` | 32-bit value |
| `SLONG_AT offset` | 32-bit signed value |

#### String Comparison

| Operator | Description |
|----------|-------------|
| `STRING_COMPARE`, `STR_CMP` | Compare strings (like strcmp) |
| `STRING_COMPARE_CASE` | Case-insensitive compare |
| `STRING_EQUAL` | Equal (returns 1/0) |
| `STRING_EQUAL_CASE`, `STR_EQ` | Case-insensitive equal |
| `STRING_MATCHES_REGEXP` | Regexp match |
| `STRING_CONTAINS_REGEXP` | Contains regexp |

#### Game/File Checks

| Expression | Description |
|------------|-------------|
| `GAME_IS ~games~` | Check game type (bg2, tob, etc.) |
| `ENGINE_IS ~engines~` | Check engine type |
| `GAME_INCLUDES ~game~` | Check game content |
| `FILE_EXISTS file` | File exists in filesystem |
| `FILE_EXISTS_IN_GAME file` | File exists as game resource |
| `DIRECTORY_EXISTS dir` | Directory exists |
| `FILE_SIZE file size` | File has exact size |
| `SIZE_OF_FILE file` | Returns file size |
| `FILE_CONTAINS file regexp` | File contains pattern |
| `FILE_CONTAINS_EVALUATED (file regexp)` | With variable expansion |
| `RESOURCE_CONTAINS file regexp` | Game resource contains pattern |
| `FILE_MD5 file hash` | Check MD5 hash |
| `FILE_IS_IN_COMPRESSED_BIFF file` | In compressed BIF |
| `BIFF_IS_COMPRESSED file` | BIF is compressed |

#### Variable Checks

| Expression | Description |
|------------|-------------|
| `VARIABLE_IS_SET var` | Variable is defined |
| `IS_AN_INT var` | Variable is integer |
| `STRING_LENGTH string` | String length |
| `EVALUATE_BUFFER var` | Evaluate variables in string |

#### Script Validation

| Expression | Description |
|------------|-------------|
| `VALID_SCRIPT_ACTIONS var` | Actions compile without errors |
| `VALID_SCRIPT_TRIGGERS var` | Triggers compile without errors |

#### Function-like Expressions

| Expression | Description |
|------------|-------------|
| `IDS_OF_SYMBOL(file symbol)` | Get IDS number |
| `RANDOM(low high)` | Random integer |
| `INDEX(flags needle haystack [start])` | Find first match |
| `RINDEX(flags needle haystack [start])` | Find last match |
| `INDEX_BUFFER(flags needle [start])` | Find in current buffer |
| `RINDEX_BUFFER(flags needle [start])` | Find last in buffer |
| `RESOLVE_STR_REF(text)` | Get TLK index |
| `STATE_WHICH_SAYS text FROM dlg` | Find dialog state |
| `TRA_ENTRY_EXISTS(entry files...)` | TRA entry exists |

#### Nullary Expressions

| Expression | Description |
|------------|-------------|
| `BUFFER_LENGTH` | Current patch buffer size |
| `NEXT_STRREF` | Next TLK index |
| `IS_SILENT` | Output is silenced |
| `SOURCE_SIZE` | Source file size |
| `SOURCE_RES`, `SOURCE_EXT`, `SOURCE_FILE` | Source file info |
| `SOURCE_DIRECTORY`, `SOURCE_FILESPEC` | Source path info |
| `DEST_RES`, `DEST_EXT`, `DEST_FILE` | Destination file info |
| `DEST_DIRECTORY`, `DEST_FILESPEC` | Destination path info |

#### IE Resource Offsets

| Constant | Description |
|----------|-------------|
| `NAME1` | Unidentified name offset |
| `NAME2` | Identified name offset |
| `UNIDENTIFIED_DESC`, `DESC` | Unidentified description |
| `IDENTIFIED_DESC` | Identified description |
| `BIO` | NPC biography |
| Sound slots | `INITIAL_MEETING`, `MORALE`, `HAPPY`, `BATTLE_CRY1`-`5`, etc. |

### Variables (auto-set)

| Variable | Description |
|----------|-------------|
| `TP2_AUTHOR` | Value from AUTHOR directive |
| `TP2_FILE_NAME` | Full TP2 filename |
| `TP2_BASE_NAME` | TP2 name without "setup-" and extension |
| `MOD_FOLDER` | Directory containing TP2 |
| `MOD_VERSION` | Value from VERSION flag |
| `LANGUAGE` | Selected language directory |

## Actions

### File Operations

#### COPY

```tp2
COPY [--no-backup] [GLOB] ~fromFile~ ~toFile~ [~from2~ ~to2~ ...]
  BEGIN patch list END
  IF ~condition~
```

Copies files with optional patches. Sets `SOURCE_*` and `DEST_*` variables.

#### COPY_EXISTING

```tp2
COPY_EXISTING [--no-backup] ~fromFile~ ~toFile~ ...
  BEGIN patch list END
```

Like COPY but sources from game BIFFs/override.

#### COPY_EXISTING_REGEXP

```tp2
COPY_EXISTING_REGEXP [--no-backup] [GLOB] ~regexp~ ~toDir~ ...
  BEGIN patch list END
```

COPY_EXISTING with regexp matching. Use `\1`, `\2` for groups in destination.

#### COPY_LARGE

```tp2
COPY_LARGE [--no-backup] [GLOB] ~fromFile~ ~toFile~ ...
```

Like COPY but for large files (>1GB), no patches allowed.

#### COPY_RANDOM

```tp2
COPY_RANDOM (~file1~ ~file2~ ...) [(~fileN~ ...)] ...
  BEGIN patch list END
```

Shuffle files randomly within each group.

#### COPY_ALL_GAM_FILES

```tp2
COPY_ALL_GAM_FILES
  BEGIN patch list END
```

Copy and patch Default.gam and all savegames.

#### MOVE

```tp2
MOVE [--no-backup] ~fromFile~ ~toFile~ ...
MOVE (~directory~ ~regexp~) ~toDir~
```

Move files or directories.

#### DELETE

```tp2
DELETE [--no-backup] ~file~ ...
```

Remove files/directories.

#### DISABLE_FROM_KEY

```tp2
DISABLE_FROM_KEY ~file~ ...
```

Remove files from chitin.key without deleting BIF.

#### DECOMPRESS_BIFF

```tp2
DECOMPRESS_BIFF ~file.bif~
```

Decompress a compressed BIF file.

### Resource Creation

#### CREATE

```tp2
CREATE type [VERSION ~version~] ~resref~
  BEGIN patch list END
```

Create new game resource. Types: ARE, CRE, EFF, ITM, SPL, STO.

### Compilation

#### COMPILE

```tp2
COMPILE [EVALUATE_BUFFER] ~sourceFile~ ...
  BEGIN patch list END
  USING ~traFile~ ...
```

Compile D and BAF files.

### Text File Operations

#### APPEND

```tp2
APPEND [IF_FILE_EXISTS] ~filename~ ~text~ [KEEP_CRLF]
APPEND_COL ~filename~ ~text~ [KEEP_CRLF]
```

Append text to end of file. APPEND_COL appends as new column.

#### EXTEND_TOP / EXTEND_BOTTOM

```tp2
EXTEND_TOP ~dlgFile~ ~stateLabel~ [#position]
  transitions...
END

EXTEND_BOTTOM ~dlgFile~ ~stateLabel~ [#position]
  transitions...
END
```

Add dialogue transitions to existing states.

### Utility

#### CLEAR_MEMORY / CLEAR_EVERYTHING

```tp2
CLEAR_MEMORY
CLEAR_EVERYTHING
```

Remove all variables and reload automatic ones.

#### MKDIR

```tp2
MKDIR ~directory~
```

Create directory (and parent directories).

#### AT_NOW

```tp2
AT_NOW ~command~
AT_NOW varname ~command~ [EXACT]
```

Execute system command immediately. Optional varname captures output.

#### OUTER_SET / OUTER_SPRINT / OUTER_TEXT_SPRINT

```tp2
OUTER_SET varname = expression
OUTER_SPRINT varname ~string~
OUTER_TEXT_SPRINT varname ~string with %vars%~
```

Set variables in action context.

#### OUTER_PATCH / OUTER_PATCH_SAVE

```tp2
OUTER_PATCH ~buffer~ BEGIN
  patches...
END

OUTER_PATCH_SAVE varname ~buffer~ BEGIN
  patches...
END
```

Patch string buffer in action context.

#### WITH_TRA

```tp2
WITH_TRA ~file1.tra~ [~file2.tra~ ...] BEGIN
  actions...
END
```

Temporarily load TRA files for enclosed actions.

### Control Flow

#### ACTION_IF

```tp2
ACTION_IF condition BEGIN
  actions...
END
[ELSE ACTION_IF condition BEGIN ... END]
[ELSE BEGIN ... END]
```

Conditional action execution.

#### ACTION_FOR_EACH / PATCH_FOR_EACH

```tp2
ACTION_FOR_EACH var IN value1 value2 ... BEGIN
  actions...
END

PATCH_FOR_EACH var IN value1 value2 ... BEGIN
  patches...
END
```

Iterate over literal values.

#### ACTION_BASH_FOR

```tp2
ACTION_BASH_FOR ~directory~ ~filepattern~ BEGIN
  // %BASH_FOR_FILE%, %BASH_FOR_RES%, %BASH_FOR_EXT% available
  actions...
END
```

Iterate over files matching pattern in directory.

#### ACTION_PHP_EACH / PATCH_PHP_EACH

```tp2
ACTION_PHP_EACH array AS key => value BEGIN
  actions...
END

PATCH_PHP_EACH array AS key => value BEGIN
  patches...
END

PHP_EACH array AS key => value BEGIN  // patch context alias
  patches...
END
```

Iterate over array elements.

#### FOR

```tp2
FOR (init; condition; step) BEGIN
  patches...
END
```

C-style for loop (patch context only).

#### WHILE

```tp2
WHILE condition BEGIN
  patches...
END
```

Loop while condition is true (patch context only).

#### ACTION_TRY / PATCH_TRY

```tp2
ACTION_TRY
  actions...
WITH DEFAULT
  fallback_actions...
END

PATCH_TRY
  patches...
WITH DEFAULT
  fallback_patches...
END
```

Exception handling.

### Functions and Macros

#### DEFINE_ACTION_FUNCTION / DEFINE_PATCH_FUNCTION

```tp2
DEFINE_ACTION_FUNCTION funcName
  [INT_VAR var1 = default1 ...]
  [STR_VAR var2 = ~default2~ ...]
  [RET retvar1 ...]
  [RET_ARRAY retarr1 ...]
BEGIN
  actions...
END

DEFINE_PATCH_FUNCTION funcName
  ...same parameters...
BEGIN
  patches...
END
```

Define reusable functions.

#### LAF / LPF (Launch Function)

```tp2
LAF funcName
  [INT_VAR var1 = value1 ...]
  [STR_VAR var2 = ~value2~ ...]
  [RET retvar1 = localvar1 ...]
  [RET_ARRAY retarr1 = localarr1 ...]
END

LPF funcName ... END  // patch context
```

Call defined functions.

#### DEFINE_ACTION_MACRO / DEFINE_PATCH_MACRO

```tp2
DEFINE_ACTION_MACRO macroName BEGIN
  actions...
END

DEFINE_PATCH_MACRO macroName BEGIN
  patches...
END
```

Define macros (legacy, prefer functions).

#### LAM / LPM (Launch Macro)

```tp2
LAM macroName
LPM macroName
```

Execute defined macros.

### Arrays

#### ACTION_DEFINE_ARRAY / DEFINE_ARRAY

```tp2
ACTION_DEFINE_ARRAY arrayName BEGIN
  value1 value2 value3
END

DEFINE_ARRAY arrayName BEGIN  // patch context
  value1 value2 value3
END
```

Define indexed array.

#### ACTION_DEFINE_ASSOCIATIVE_ARRAY / DEFINE_ASSOCIATIVE_ARRAY

```tp2
ACTION_DEFINE_ASSOCIATIVE_ARRAY arrayName BEGIN
  key1 => value1
  key2 => value2
  ~key3~, ~key4~ => value3  // multi-key
END
```

Define associative array.

#### ACTION_CLEAR_ARRAY / CLEAR_ARRAY

```tp2
ACTION_CLEAR_ARRAY arrayName
CLEAR_ARRAY arrayName  // patch context
```

Remove all elements from array.

### Inner Operations

#### INNER_ACTION

```tp2
INNER_ACTION BEGIN
  actions...
END
```

Execute actions within patch context.

#### INNER_PATCH / INNER_PATCH_SAVE

```tp2
INNER_PATCH ~buffer~ BEGIN
  patches...
END

INNER_PATCH_SAVE varname ~buffer~ BEGIN
  patches...
END
```

Patch a string buffer.

#### INNER_PATCH_FILE

```tp2
INNER_PATCH_FILE ~filename~ BEGIN
  patches...
END
```

Patch file without copying.

### Modifiers

#### optNoBackup

| Modifier | Description |
|----------|-------------|
| (none) | Make backup, undo on uninstall |
| `+` | No backup, won't undo on uninstall |
| `-` | Don't copy, store as inlined file only |

#### optGlob

| Modifier | Description |
|----------|-------------|
| (none) | Sane defaults (GLOB with COPY_EXISTING_REGEXP, no GLOB with COPY) |
| `GLOB` | Use filesystem globbing |
| `NOGLOB` | Disable filesystem globbing |

#### optcase

| Modifier | Description |
|----------|-------------|
| `CASE_SENSITIVE` | Case-sensitive matching |
| `CASE_INSENSITIVE` | Case-insensitive matching |

#### optexact

| Modifier | Description |
|----------|-------------|
| `EXACT_MATCH` | Match exact string only |
| `EVALUATE_REGEXP` | Use regexp matching |

#### ArrayIndicesSortType

| Modifier | Description |
|----------|-------------|
| `LEXICOGRAPHICALLY` | Sort as strings (default) |
| `NUMERICALLY` | Sort as numbers |

### Other Modifiers

| Modifier | Description |
|----------|-------------|
| `EVALUATE_BUFFER` | Substitute %variables% |

### When Conditions

```tp2
IF ~condition~      // Only if condition is true
UNLESS ~condition~  // Only if condition is false
```

## Patches

### Binary Read Operations

```tp2
READ_BYTE offset varname
READ_SBYTE offset varname        // signed
READ_SHORT offset varname
READ_SSHORT offset varname       // signed
READ_LONG offset varname
READ_SLONG offset varname        // signed
READ_ASCII offset varname [(length)] [NULL]
READ_STRREF offset varname
```

Read values from file buffer into variables.

### Binary Write Operations

```tp2
WRITE_BYTE offset value
WRITE_SHORT offset value
WRITE_LONG offset value
WRITE_ASCII offset ~string~ [(length)]
WRITE_ASCIIE offset ~string~ [(length)]   // EVALUATE_BUFFER
WRITE_ASCIIT offset ~string~              // truncate at null
WRITE_ASCII_LIST offset (value1 value2 ...)
WRITE_EVALUATED_ASCII offset ~string~ [(length)]
```

Write values to file buffer.

### Buffer Manipulation

```tp2
INSERT_BYTES offset count
DELETE_BYTES offset count
```

Modify buffer structure.

### 2DA Operations

```tp2
COUNT_2DA_COLS varname
COUNT_2DA_ROWS varname
READ_2DA_ENTRY row col varname
READ_2DA_ENTRIES_NOW arrayname reqCols
READ_2DA_ENTRY_FORMER arrayname row col varname
SET_2DA_ENTRY row col value
SET_2DA_ENTRY_LATER arrayname row col value
SET_2DA_ENTRIES_NOW arrayname numCols
PRETTY_PRINT_2DA
```

Operations for 2DA table files.

### SET Operations

```tp2
SET varname = value
SET varname += value
SET varname -= value
SET varname *= value
SET varname /= value
SET varname |= value    // bitwise OR
SET varname &= value    // bitwise AND
```

Variable assignment with operators.

### String/Text

#### SAY

```tp2
SAY offset ~text~
```

Write string reference at offset (for names, descriptions).

#### SAY_EVALUATED

```tp2
SAY_EVALUATED offset ~string with %vars%~
```

Like SAY but evaluates variables in string first.

### Messages/Control Flow

#### PATCH_FAIL

```tp2
PATCH_FAIL ~error message~
```

Display message and fail component installation.

#### PATCH_ABORT

```tp2
PATCH_ABORT ~message~
```

Display message and undo component installation.

#### PATCH_WARN

```tp2
PATCH_WARN ~message~
```

Display warning, marks install as "INSTALLED WITH WARNINGS".

#### PATCH_PRINT

```tp2
PATCH_PRINT ~message with %vars%~
```

Print message to console.

#### PATCH_LOG

```tp2
PATCH_LOG ~message~
```

Write message to debug log.

### String Manipulation

#### TEXT_SPRINT / SPRINT

```tp2
TEXT_SPRINT variable ~string with %vars%~
SPRINT variable ~string~
```

Assign evaluated string to variable. Prefer TEXT_SPRINT.

#### SNPRINT

```tp2
SNPRINT length variable ~string~
```

Assign first/last N characters to variable.

#### SPRINTF

```tp2
SPRINTF variable ~%s %d %x~ (~str~ 10 var)
```

Format string with placeholders.

#### TO_UPPER / TO_LOWER

```tp2
TO_UPPER variable
TO_LOWER variable
```

Convert variable contents to upper/lower case.

#### SPACES

```tp2
SPACES variable ~template~
```

Create string of spaces matching template length.

#### QUOTE

```tp2
QUOTE variable ~string~
```

Escape special characters in string.

#### SOURCE_BIFF

```tp2
SOURCE_BIFF variable ~filename~
```

Get BIF path containing file.

### Text Replacement

#### REPLACE

```tp2
REPLACE [CASE_SENSITIVE|CASE_INSENSITIVE] [EXACT_MATCH|EVALUATE_REGEXP] ~regexp~ ~text~
```

Replace regexp with string reference number.

#### REPLACE_TEXTUALLY

```tp2
REPLACE_TEXTUALLY [case] [exact] ~regexp~ ~replacement~ [(size)]
```

Replace text literally. Optional size pads to exact length.

### Variable Evaluation

#### EVALUATE_BUFFER

```tp2
EVALUATE_BUFFER
EVAL
```

Replace all %variables% in current file with values.

#### EVALUATE_BUFFER_SPECIAL

```tp2
EVALUATE_BUFFER_SPECIAL ~$~
```

Like EVALUATE_BUFFER but with custom delimiter (e.g., $var$).

## Building

```bash
tree-sitter generate
tree-sitter build --wasm
```

## Testing

```bash
./test.sh
```
