/**
 * Tree-sitter grammar for WeiDU TP2 files.
 * Covers .tp2 (full), .tpa/.tph (actions), .tpp (patches).
 *
 * @file WeiDU TP2 grammar
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Helper functions to reduce repetition in grammar rules

/** choice() that handles single keyword without warning */
const kw = (...keywords) => keywords.length === 1 ? keywords[0] : choice(...keywords);

/** Read patch: KEYWORD offset var [ELSE value] */
const readPatch = (...keywords) => ($) =>
    seq(
        kw(...keywords),
        field("offset", $._value),
        // WeiDU allows variable names including arrays and numeric-starting vars
        field("var", $._assignable),
        optional(seq("ELSE", field("else_value", $._value)))
    );

/** Write patch: KEYWORD offset value */
const writePatch = (...keywords) => ($) =>
    seq(kw(...keywords), field("offset", $._value), field("value", $._value));

/** Memory access expression: KEYWORD offset */
const memoryAt = (...keywords) => ($) =>
    seq(kw(...keywords), field("offset", $._value));

/** Check expression: KEYWORD value (with prec.right(3)) */
const checkExpr = (keyword, fieldName = "value") => ($) =>
    prec.right(3, seq(keyword, field(fieldName, $._value)));

export default grammar({
    name: "weidu_tp2",

    extras: ($) => [/\s/, $.comment, $.line_comment],

    word: ($) => $.identifier,

    conflicts: ($) => [
        [$.component],
        [$.copy_action],
        [$.copy_existing_action],
        [$.copy_existing_regexp_action],
        [$.create_action],
        [$.variable_ref, $._assignable],
        [$.variable_ref, $.at_now_action],
        [$.variable_ref, $.assoc_entry],
        [$.remove_store_item_patch],
        [$.add_store_item_patch],
        [$.replace_cre_item_patch],
        [$.remove_cre_item_patch],
        [$.add_cre_item_patch],
        [$.copy_all_gam_files_action],
        [$.copy_random_action],
        [$.action_match_case],
        [$._action, $._top_level],
        [$._assignable, $._primary],
        [$._assignable, $._expr],
        [$.define_associative_array_patch, $.action_define_associative_array],
        [$.evaluate_buffer_patch, $.extend_top_action],
        [$.evaluate_buffer_patch, $.extend_bottom_action],
        [$._action, $.action_if],
    ],

    rules: {
        // Allow patches at top level for .tpp files (patch includes)
        source_file: ($) => repeat(choice($._top_level, $._action, $.top_level_assignment, $._patch)),

        // Bare assignment at top level (implicit OUTER_SET, common in .tpp files)
        top_level_assignment: ($) =>
            prec(-1, seq(
                field("var", $._assignable),
                $._assign_op,
                field("value", $._value)
            )),

        // =========================================
        // LITERALS (lowest level)
        // =========================================

        // Strings
        string: ($) =>
            choice(
                $.tilde_string,
                $.double_string,
                $.five_tilde_string,
                $.percent_string
            ),

        tilde_string: ($) => seq("~", optional($.tilde_content), "~"),
        // Match any chars except tilde - don't treat ~~ as escape to allow adjacent strings
        tilde_content: ($) => /[^~]+/,

        double_string: ($) => seq('"', optional($.double_content), '"'),
        double_content: ($) => /[^"]*/,

        five_tilde_string: ($) => seq("~~~~~", optional($.five_tilde_content), "~~~~~"),
        five_tilde_content: ($) => repeat1(choice(/[^~]+/, /~{1,4}/)),

        // Percent-delimited string/regex pattern (common for REPLACE_TEXTUALLY)
        percent_string: ($) => seq("%", $.percent_content, "%"),
        percent_content: ($) => /[^%]+/,

        // Numbers - single token for cleaner parse tree
        // #number is WeiDU syntax for explicit numeric literal
        // Decimal, hex (0x), octal (0o), binary (0b), # prefix, and float (for versions like 1.0.0)
        number: ($) => choice(
            /-?[0-9]+(\.[0-9]+)*/,  // Integer or dotted version (1, 1.0, 1.0.0)
            /0[xX][0-9a-fA-F]+/,
            /0[oO][0-7]+/,
            /0[bB][01]+/,
            /#-?[0-9]+/
        ),

        // TRA reference
        tra_ref: ($) => /@-?[0-9]+/,

        // Identifier - WeiDU allows hyphens in identifiers (e.g., bif-off, res-cnt)
        identifier: ($) => /[A-Za-z_][A-Za-z0-9_#-]*/,

        // Bare resource reference (e.g., g_forge.2da, mymod/script.baf)
        // For unquoted file arguments that include dots or slashes
        // bare_resref: unquoted resource reference (e.g., script.bcs, 00MYFILE.itm)
        bare_resref: ($) => /[A-Za-z0-9_][A-Za-z0-9_#-]*\.[A-Za-z0-9]+/,

        // =========================================
        // COMMENTS
        // =========================================

        comment: ($) => seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
        line_comment: ($) => seq("//", /[^\n]*/),

        // =========================================
        // VARIABLE REFERENCES
        // =========================================

        // Variable reference: bare identifier or %var%
        // Variable names can start with numbers (e.g., 1fx_idx, %2da_rows%)
        variable_ref: ($) =>
            choice(
                $.identifier,
                $.var_name_numeric,
                seq("%", choice($.identifier, $.var_name_numeric), "%")
            ),

        // Variable name that starts with a number (valid inside %...% and as array keys)
        var_name_numeric: ($) => /[0-9][A-Za-z0-9_#-]*/,

        // Array access: $array(index) or $array(idx1 idx2) or $EVAL "name"(index)
        // Array name can be identifier or evaluated string like $"%varname%"(...)
        array_access: ($) =>
            choice(
                seq(
                    "$",
                    field("name", choice($.identifier, $.string)),
                    "(",
                    repeat($._value),
                    ")"
                ),
                // $EVAL form: $EVAL "arrayname"(index)
                seq(
                    "$",
                    "EVAL",
                    field("name", $._value),
                    "(",
                    repeat($._value),
                    ")"
                )
            ),

        // Assignable target: identifier, numeric-starting var, array element, or evaluated string
        _assignable: ($) => choice($.identifier, $.var_name_numeric, $.array_access, $.string),

        // =========================================
        // MODIFIERS / FLAGS
        // =========================================

        // optNoBackup: +, -
        // Higher precedence than unary - to avoid conflict
        _opt_no_backup: ($) => prec(10, choice("+", "-")),

        // optGlob
        _opt_glob: ($) => choice("GLOB", "NOGLOB"),

        // optcase
        _opt_case: ($) => choice("CASE_SENSITIVE", "CASE_INSENSITIVE"),

        // optexact
        _opt_exact: ($) => choice("EXACT_MATCH", "EVALUATE_REGEXP"),

        // Combined search flags (for INDEX, REPLACE_TEXTUALLY, etc.)
        // Use repeat1 - callers use optional() when flags aren't required
        search_flags: ($) => repeat1(choice($._opt_case, $._opt_exact)),

        // =========================================
        // EXPRESSIONS (VALUES)
        // =========================================

        _value: ($) => $._expr,

        _expr: ($) =>
            choice(
                $.ternary_expr,
                $.binary_expr,
                $.unary_expr,
                $.paren_expr,
                // EVAL prefix
                $.evaluated_expr,
                // Memory access
                $.byte_at_expr,
                $.short_at_expr,
                $.long_at_expr,
                // Function-like expressions
                $.index_expr,
                $.rindex_expr,
                $.index_buffer_expr,
                $.rindex_buffer_expr,
                $.random_expr,
                $.ids_of_symbol_expr,
                $.resolve_str_ref_expr,
                $.state_which_says_expr,
                $.tra_entry_exists_expr,
                // Check expressions
                $.file_exists_expr,
                $.file_exists_in_game_expr,
                $.directory_exists_expr,
                $.variable_is_set_expr,
                $.is_an_int_expr,
                $.game_is_expr,
                $.game_includes_expr,
                $.engine_is_expr,
                $.mod_is_installed_expr,
                $.id_of_label_expr,
                $.file_contains_expr,
                $.file_contains_evaluated_expr,
                // String functions
                $.string_length_expr,
                // Nullary expressions
                $.nullary_expr,
                // Array access
                $.array_access,
                // Primary
                $._primary
            ),

        _primary: ($) =>
            choice($.string, $.number, $.tra_ref, $.at_ref, $.bare_resref, $.variable_ref),

        // AT value - runtime TRA reference lookup (AT variable or AT number)
        at_ref: ($) => prec.right(3, seq("AT", field("ref", $._expr))),

        // Parenthesized expression
        paren_expr: ($) => seq("(", $._expr, ")"),

        // Ternary: condition ? then : else
        ternary_expr: ($) =>
            prec.right(1, seq(
                field("condition", $._expr),
                "?",
                field("then", $._expr),
                ":",
                field("else", $._expr)
            )),

        // Binary expressions with proper precedence levels
        // Logical operators (lowest precedence)
        binary_expr: ($) =>
            choice(
                prec.left(1, seq(
                    field("left", $._expr),
                    field("op", choice("AND", "OR", "&&", "||")),
                    field("right", $._expr)
                )),
                prec.left(2, seq(
                    field("left", $._expr),
                    field("op", $._comparison_op),
                    field("right", $._expr)
                )),
                prec.left(3, seq(
                    field("left", $._expr),
                    field("op", $._arithmetic_op),
                    field("right", $._expr)
                ))
            ),

        _comparison_op: ($) =>
            choice(
                // Comparison
                "==", "=", "!=", "<", ">", "<=", ">=", "EQUALS",
                // String comparison
                "STRING_COMPARE", "STR_CMP", "STRING_COMPARE_CASE",
                "STRING_EQUAL", "STRING_EQUAL_CASE", "STR_EQ",
                "STRING_MATCHES_REGEXP", "STRING_CONTAINS_REGEXP",
                "STRING_COMPARE_REGEXP"
            ),

        _arithmetic_op: ($) =>
            choice(
                // Arithmetic
                "+", "-", "*", "/", "**",
                "MODULO", "REM",
                // Bitwise
                "BAND", "BOR", "BXOR", "&", "|", "^^",
                "BLSL", "BLSR", "BASR", "<<", ">>",
                // String concatenation (used in SPRINT etc)
                "^"
            ),

        // Keep _binary_op for backwards compatibility if needed elsewhere
        _binary_op: ($) =>
            choice(
                $._comparison_op,
                $._arithmetic_op,
                "AND", "OR", "&&", "||"
            ),

        // Unary expressions
        unary_expr: ($) =>
            prec.right(3, seq(
                field("op", $._unary_op),
                field("operand", $._expr)
            )),

        // Backtick (`) is synonym for BNOT (bitwise not)
        // ! works as NOT in practice even if not documented
        _unary_op: ($) => choice("-", "NOT", "!", "BNOT", "`", "ABS"),

        // EVAL/EVALUATE_BUFFER value - low precedence so action keywords take priority
        evaluated_expr: ($) =>
            prec.right(1, seq(
                choice("EVAL", "EVALUATE_BUFFER"),
                field("value", $._expr)
            )),

        // Memory access expressions
        byte_at_expr: memoryAt("BYTE_AT", "SBYTE_AT"),
        short_at_expr: memoryAt("SHORT_AT", "SSHORT_AT"),
        long_at_expr: memoryAt("LONG_AT", "SLONG_AT"),

        // INDEX (flags needle haystack [start])
        index_expr: ($) =>
            seq(
                "INDEX",
                "(",
                optional($.search_flags),
                field("needle", $._value),
                field("haystack", $._value),
                optional(field("start", $._value)),
                ")"
            ),

        rindex_expr: ($) =>
            seq(
                "RINDEX",
                "(",
                optional($.search_flags),
                field("needle", $._value),
                field("haystack", $._value),
                optional(field("start", $._value)),
                ")"
            ),

        index_buffer_expr: ($) =>
            seq(
                "INDEX_BUFFER",
                "(",
                optional($.search_flags),
                field("needle", $._value),
                optional(field("start", $._value)),
                ")"
            ),

        rindex_buffer_expr: ($) =>
            seq(
                "RINDEX_BUFFER",
                "(",
                optional($.search_flags),
                field("needle", $._value),
                optional(field("start", $._value)),
                ")"
            ),

        // RANDOM(low high)
        random_expr: ($) =>
            seq(
                "RANDOM",
                "(",
                field("lower", $._value),
                field("upper", $._value),
                ")"
            ),

        // IDS_OF_SYMBOL (file symbol) - space before ( is allowed
        ids_of_symbol_expr: ($) =>
            seq(
                "IDS_OF_SYMBOL",
                "(",
                field("file", $._value),
                field("symbol", $._value),
                ")"
            ),

        // RESOLVE_STR_REF (text) - space before ( is allowed
        resolve_str_ref_expr: ($) =>
            seq(
                "RESOLVE_STR_REF",
                "(",
                field("text", $._value),
                ")"
            ),

        // STATE_WHICH_SAYS text FROM dlg
        // STATE_WHICH_SAYS value IN dlg1 FROM dlg2
        state_which_says_expr: ($) =>
            prec.right(3, seq(
                "STATE_WHICH_SAYS",
                field("text", $._value),
                optional(seq("IN", field("in_dlg", $._value))),
                "FROM",
                field("from_dlg", $._value)
            )),

        // TRA_ENTRY_EXISTS (entry files...) - space before ( is allowed
        tra_entry_exists_expr: ($) =>
            seq(
                "TRA_ENTRY_EXISTS",
                "(",
                field("entry", $._value),
                repeat(field("file", $._value)),
                ")"
            ),

        // Check expressions
        file_exists_expr: checkExpr("FILE_EXISTS", "file"),
        file_exists_in_game_expr: checkExpr("FILE_EXISTS_IN_GAME", "file"),
        directory_exists_expr: checkExpr("DIRECTORY_EXISTS", "dir"),
        variable_is_set_expr: checkExpr("VARIABLE_IS_SET", "var"),
        is_an_int_expr: checkExpr("IS_AN_INT", "var"),
        game_is_expr: checkExpr("GAME_IS", "games"),
        game_includes_expr: checkExpr("GAME_INCLUDES", "games"),
        engine_is_expr: checkExpr("ENGINE_IS", "engines"),
        string_length_expr: checkExpr("STRING_LENGTH", "string"),

        mod_is_installed_expr: ($) =>
            prec.right(3, seq(
                choice("MOD_IS_INSTALLED", "COMPONENT_IS_INSTALLED"),
                field("mod", $._value),
                field("component", $._value)
            )),

        // ID_OF_LABEL tp2file label - get component number from label
        id_of_label_expr: ($) =>
            seq(
                "ID_OF_LABEL",
                field("tp2", $._value),
                field("label", $._value)
            ),

        // FILE_CONTAINS file regexp
        file_contains_expr: ($) =>
            prec.right(3, seq(
                "FILE_CONTAINS",
                field("file", $._value),
                field("regexp", $._value)
            )),

        // FILE_CONTAINS_EVALUATED (file regexp) - like FILE_CONTAINS but with variable expansion
        file_contains_evaluated_expr: ($) =>
            seq(
                "FILE_CONTAINS_EVALUATED",
                "(",
                field("file", $._value),
                field("regexp", $._value),
                ")"
            ),

        // Nullary expressions (no arguments)
        nullary_expr: ($) =>
            choice(
                "BUFFER_LENGTH",
                "NEXT_STRREF",
                "IS_SILENT",
                "SOURCE_SIZE",
                "SOURCE_RES",
                "SOURCE_EXT",
                "SOURCE_FILE",
                "SOURCE_DIRECTORY",
                "SOURCE_FILESPEC",
                "DEST_RES",
                "DEST_EXT",
                "DEST_FILE",
                "DEST_DIRECTORY",
                "DEST_FILESPEC"
            ),

        // =========================================
        // PATCHES
        // =========================================

        _patch: ($) =>
            choice(
                // Write operations
                $.write_byte_patch,
                $.write_short_patch,
                $.write_long_patch,
                $.write_ascii_patch,
                $.write_ascii_list_patch,
                $.write_asciil_patch,
                // Read operations
                $.read_byte_patch,
                $.read_short_patch,
                $.read_long_patch,
                $.read_ascii_patch,
                $.read_strref_patch,
                $.get_strref_patch,
                $.lookup_ids_symbol_of_int_patch,
                // String operations
                $.say_patch,
                $.sprint_patch,
                $.text_sprint_patch,
                $.snprint_patch,
                $.sprintf_patch,
                $.to_upper_patch,
                $.to_lower_patch,
                $.spaces_patch,
                $.quote_patch,
                $.source_biff_patch,
                // Assignment
                $.set_patch,
                $.assignment_patch,
                $.increment_patch,
                $.decrement_patch,
                // Control flow
                $.patch_if,
                $.patch_match,
                $.for_patch,
                $.while_patch,
                $.php_each_patch,
                $.patch_for_each,
                // Text manipulation
                $.replace_patch,
                $.replace_textually_patch,
                $.replace_evaluate_patch,
                // Buffer operations
                $.evaluate_buffer_patch,
                $.insert_bytes_patch,
                $.delete_bytes_patch,
                $.append_file_patch,
                // 2DA operations
                $.read_2da_entry_patch,
                $.read_2da_entries_now_patch,
                $.read_2da_entry_former_patch,
                $.set_2da_entry_patch,
                $.set_2da_entry_later_patch,
                $.set_2da_entries_now_patch,
                $.count_2da_cols_patch,
                $.count_2da_rows_patch,
                $.count_regexp_instances_patch,
                $.pretty_print_2da_patch,
                $.insert_2da_row_patch,
                $.remove_2da_row_patch,
                // Offset array operations
                $.get_offset_array_patch,
                $.get_offset_array2_patch,
                // Store operations
                $.remove_store_item_patch,
                $.add_store_item_patch,
                // CRE item operations
                $.replace_cre_item_patch,
                $.remove_cre_item_patch,
                $.add_cre_item_patch,
                $.add_memorized_spell_patch,
                $.remove_memorized_spells_patch,
                $.add_known_spell_patch,
                $.remove_known_spell_patch,
                $.remove_known_spells_patch,
                $.remove_cre_effects_patch,
                $.add_map_note_patch,
                $.set_bg2_proficiency_patch,
                // Functions
                $.launch_patch_function,
                $.launch_patch_macro,
                $.replace_bcs_block_patch,
                // Arrays
                $.define_associative_array_patch,
                $.clear_array_patch,
                $.sort_array_indices_patch,
                // Exception handling
                $.patch_try,
                // Inner patches
                $.inner_patch,
                $.inner_patch_save,
                $.inner_patch_file,
                $.inner_action,
                // Misc
                $.patch_print,
                $.patch_log,
                $.patch_warn,
                $.patch_fail,
                $.patch_abort,
                $.patch_include,
                $.patch_reraise,
                $.patch_silent,
                $.patch_verbose,
                $.compile_baf_to_bcs,
                $.decompile_bcs_to_baf,
                $.compile_d_to_dlg,
                $.decompile_dlg_to_d,
                $.decompile_and_patch,
                $.decompress_replace_file_patch,
                $.compress_replace_file_patch,
                $.decompress_into_var_patch
            ),

        // Write patches
        write_byte_patch: writePatch("WRITE_BYTE"),
        write_short_patch: writePatch("WRITE_SHORT"),
        write_long_patch: writePatch("WRITE_LONG"),

        write_ascii_patch: ($) =>
            prec.right(seq(
                choice("WRITE_ASCII", "WRITE_ASCIIE", "WRITE_ASCIIT", "WRITE_ASCII_TERMINATE", "WRITE_EVALUATED_ASCII"),
                field("offset", $._value),
                field("string", $._value),
                optional(choice(
                    seq("#", field("length", $._value)),
                    seq("(", field("length", $._value), ")")
                ))
            )),

        // WRITE_ASCII_LIST offset value1 [value2 ...]
        write_ascii_list_patch: ($) =>
            prec.right(seq(
                "WRITE_ASCII_LIST",
                field("offset", $._value),
                repeat1($._value)
            )),

        // WRITE_ASCIIL offset value1 value2 ... (space-separated, no parens)
        write_asciil_patch: ($) =>
            prec.right(seq(
                "WRITE_ASCIIL",
                field("offset", $._value),
                repeat1($._value)
            )),

        // Read patches (with signed variants)
        read_byte_patch: readPatch("READ_BYTE", "READ_SBYTE"),
        read_short_patch: readPatch("READ_SHORT", "READ_SSHORT"),
        read_long_patch: readPatch("READ_LONG", "READ_SLONG"),

        read_ascii_patch: ($) =>
            prec.right(seq(
                "READ_ASCII",
                field("offset", $._value),
                field("var", $._value),
                optional(seq("ELSE", field("else_value", $._value))),
                optional(seq("(", field("length", $._value), ")")),
                optional("NULL")
            )),

        read_strref_patch: ($) =>
            seq("READ_STRREF", field("offset", $._value), field("var", $.identifier)),

        // GET_STRREF[_S] strref var - reads string from dialog.tlk (_S = silent)
        get_strref_patch: ($) =>
            seq(choice("GET_STRREF", "GET_STRREF_S"), field("strref", $._value), field("var", $.identifier)),

        // LOOKUP_IDS_SYMBOL_OF_INT target ids_file value - looks up symbol name for int value in IDS file
        lookup_ids_symbol_of_int_patch: ($) =>
            seq("LOOKUP_IDS_SYMBOL_OF_INT", field("target", $.identifier),
                field("ids_file", $._value), field("value", $._value)),

        // String operations
        say_patch: ($) =>
            seq(choice("SAY", "SAY_EVALUATED"), field("offset", $._value), field("text", $._value)),

        sprint_patch: ($) =>
            seq("SPRINT", field("var", $._value), field("value", $._value)),

        text_sprint_patch: ($) =>
            seq("TEXT_SPRINT", field("var", $._value), field("value", $._value)),

        snprint_patch: ($) =>
            seq(
                "SNPRINT",
                field("length", $._value),
                field("var", $.identifier),
                field("value", $._value)
            ),

        // SPRINTF var ~format~ (arg1 arg2 ...)
        sprintf_patch: ($) =>
            prec.right(seq(
                "SPRINTF",
                field("var", $._value),
                field("format", $._value),
                optional(seq("(", repeat($._value), ")"))
            )),

        to_upper_patch: ($) => seq("TO_UPPER", field("var", $.identifier)),
        to_lower_patch: ($) => seq("TO_LOWER", field("var", $.identifier)),

        // String utilities
        spaces_patch: ($) =>
            seq("SPACES", field("var", $.identifier), field("template", $._value)),
        quote_patch: ($) =>
            seq("QUOTE", field("var", $.identifier), field("string", $._value)),
        source_biff_patch: ($) =>
            seq("SOURCE_BIFF", field("var", $.identifier), field("filename", $._value)),

        // Assignment (EVAL makes variable name evaluated)
        set_patch: ($) =>
            seq(
                "SET",
                optional("EVAL"),
                field("var", $._assignable),
                $._assign_op,
                field("value", $._value)
            ),

        assignment_patch: ($) =>
            prec(10, seq(
                field("var", $._assignable),
                $._assign_op,
                field("value", $._value)
            )),

        // ++var and --var are patches (equivalent to var += 1)
        increment_patch: ($) => seq("++", field("var", $._value)),
        decrement_patch: ($) => seq("--", field("var", $._value)),

        _assign_op: ($) => choice("=", "+=", "-=", "*=", "/=", "|=", "&=", "||=", "&&="),

        // Control flow
        patch_if: ($) =>
            seq(
                "PATCH_IF",
                field("condition", $._value),
                optional("THEN"),
                "BEGIN",
                repeat($._patch),
                "END",
                optional(seq("ELSE", choice(
                    seq("BEGIN", repeat($._patch), "END"),
                    $._patch  // else-if chain or single patch like INNER_ACTION
                )))
            ),

        // PATCH_MATCH value WITH cases... DEFAULT [patches] END
        patch_match: ($) =>
            seq(
                "PATCH_MATCH",
                field("value", $._value),
                "WITH",
                repeat($.match_case),
                "DEFAULT",
                repeat($._patch),
                "END"
            ),

        match_case: ($) =>
            seq(
                repeat1($._value),
                optional(seq("WHEN", field("guard", $._value))),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        for_patch: ($) =>
            seq(
                "FOR",
                "(",
                optional($._patch),
                ";",
                field("condition", $._value),
                ";",
                optional($._patch),
                ")",
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // WHILE condition BEGIN - parentheses are optional, parsed as paren_expr if present
        while_patch: ($) =>
            seq(
                "WHILE",
                field("condition", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        php_each_patch: ($) =>
            seq(
                choice("PHP_EACH", "PATCH_PHP_EACH"),
                field("array", $._value),
                "AS",
                field("key_var", $.identifier),
                "=>",
                field("value_var", $.identifier),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // PATCH_FOR_EACH var IN value... BEGIN patches END
        patch_for_each: ($) =>
            seq(
                "PATCH_FOR_EACH",
                field("var", $._value),
                "IN",
                repeat1($._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // Text manipulation
        // REPLACE pattern replacement [SOUND]
        replace_patch: ($) =>
            seq(
                "REPLACE",
                field("regexp", $._value),
                field("replacement", $._value),
                optional($.sound_ref)
            ),

        // Sound reference: [SOUNDNAME]
        sound_ref: ($) => seq("[", field("sound", $.identifier), "]"),

        replace_textually_patch: ($) =>
            prec.right(seq(
                "REPLACE_TEXTUALLY",
                optional($.search_flags),
                field("regexp", $._value),
                field("replacement", $._value),
                optional(seq("(", field("count", $._value), ")"))
            )),

        // REPLACE_EVALUATE regexp BEGIN patches END replacement
        replace_evaluate_patch: ($) =>
            seq(
                "REPLACE_EVALUATE",
                optional($.search_flags),
                field("regexp", $._value),
                "BEGIN",
                repeat($._patch),
                "END",
                field("replacement", $._value)
            ),

        // Buffer operations
        evaluate_buffer_patch: ($) => "EVALUATE_BUFFER",

        insert_bytes_patch: ($) =>
            seq("INSERT_BYTES", field("offset", $._value), field("length", $._value)),

        delete_bytes_patch: ($) =>
            seq("DELETE_BYTES", field("offset", $._value), field("length", $._value)),

        append_file_patch: ($) =>
            seq("APPEND_FILE", field("file", $._value)),

        // 2DA operations
        read_2da_entry_patch: ($) =>
            seq(
                "READ_2DA_ENTRY",
                field("row", $._value),
                field("col", $._value),
                field("req_cols", $._value),
                field("var", $._value)
            ),

        read_2da_entries_now_patch: ($) =>
            seq(
                "READ_2DA_ENTRIES_NOW",
                field("var", $._value),
                field("req_cols", $._value)
            ),

        read_2da_entry_former_patch: ($) =>
            seq(
                "READ_2DA_ENTRY_FORMER",
                field("array", $._value),
                field("row", $._value),
                field("col", $._value),
                field("var", $._value)
            ),

        set_2da_entry_patch: ($) =>
            seq(
                "SET_2DA_ENTRY",
                field("row", $._value),
                field("col", $._value),
                field("req_cols", $._value),
                field("value", $._value)
            ),

        // SET_2DA_ENTRY_LATER array row col value
        set_2da_entry_later_patch: ($) =>
            seq(
                "SET_2DA_ENTRY_LATER",
                field("array", $._value),
                field("row", $._value),
                field("col", $._value),
                field("value", $._value)
            ),

        // SET_2DA_ENTRIES_NOW array req_cols
        set_2da_entries_now_patch: ($) =>
            seq(
                "SET_2DA_ENTRIES_NOW",
                field("array", $._value),
                field("req_cols", $._value)
            ),

        count_2da_cols_patch: ($) =>
            seq("COUNT_2DA_COLS", field("var", choice($.identifier, $.string))),

        count_2da_rows_patch: ($) =>
            seq("COUNT_2DA_ROWS", field("req_cols", $._value), field("var", choice($.identifier, $.string))),

        // COUNT_REGEXP_INSTANCES [CASE_SENSITIVE] [EXACT_MATCH] pattern var
        count_regexp_instances_patch: ($) =>
            seq(
                "COUNT_REGEXP_INSTANCES",
                optional("CASE_SENSITIVE"),
                optional("EXACT_MATCH"),
                field("pattern", $._value),
                field("var", $._value)
            ),

        // PRETTY_PRINT_2DA - formats 2DA with proper spacing
        pretty_print_2da_patch: ($) => "PRETTY_PRINT_2DA",

        // INSERT_2DA_ROW row req_cols value
        insert_2da_row_patch: ($) =>
            seq("INSERT_2DA_ROW", field("row", $._value), field("req_cols", $._value), field("value", $._value)),

        // REMOVE_2DA_ROW row req_cols
        remove_2da_row_patch: ($) =>
            seq("REMOVE_2DA_ROW", field("row", $._value), field("req_cols", $._value)),

        // GET_OFFSET_ARRAY var off_start off_len cnt_off cnt_size struct_off_off struct_off_size struct_size
        get_offset_array_patch: ($) =>
            prec.right(seq("GET_OFFSET_ARRAY", field("var", $.identifier), repeat1($._value))),

        // GET_OFFSET_ARRAY2 var base off_start off_len cnt_off cnt_size struct_off_off struct_off_size struct_size
        get_offset_array2_patch: ($) =>
            prec.right(seq("GET_OFFSET_ARRAY2", field("var", $.identifier), repeat1($._value))),

        // REMOVE_STORE_ITEM item1 item2 ...
        remove_store_item_patch: ($) =>
            seq("REMOVE_STORE_ITEM", repeat1(field("item", $._value))),

        // ADD_STORE_ITEM [+|-] item charges1 charges2 charges3 flags [quantity]
        add_store_item_patch: ($) =>
            seq("ADD_STORE_ITEM", optional($._opt_no_backup), repeat1(field("item", $._value))),

        // REPLACE_CRE_ITEM item charges1 charges2 charges3 flags slot
        replace_cre_item_patch: ($) =>
            seq("REPLACE_CRE_ITEM", repeat1($._value)),

        // REMOVE_CRE_ITEM item
        remove_cre_item_patch: ($) =>
            seq("REMOVE_CRE_ITEM", repeat1($._value)),

        // ADD_CRE_ITEM item charges1 charges2 charges3 flags slot
        add_cre_item_patch: ($) =>
            seq("ADD_CRE_ITEM", repeat1($._value)),

        // ADD_MEMORIZED_SPELL spell level type [(count)]
        add_memorized_spell_patch: ($) =>
            prec.right(seq(
                "ADD_MEMORIZED_SPELL",
                field("spell", $._value),
                field("level", $._value),
                field("type", $._value),
                optional(seq("(", field("count", $._value), ")"))
            )),

        // REMOVE_MEMORIZED_SPELLS - removes all memorized spells
        remove_memorized_spells_patch: ($) => "REMOVE_MEMORIZED_SPELLS",

        // REMOVE_KNOWN_SPELLS - removes all known spells (no arguments)
        remove_known_spells_patch: ($) => "REMOVE_KNOWN_SPELLS",

        // REMOVE_CRE_EFFECTS - removes all creature effects
        remove_cre_effects_patch: ($) => "REMOVE_CRE_EFFECTS",

        // ADD_KNOWN_SPELL spell level type
        add_known_spell_patch: ($) =>
            seq(
                "ADD_KNOWN_SPELL",
                field("spell", $._value),
                field("level", $._value),
                field("type", $._value)
            ),

        // REMOVE_KNOWN_SPELL spell [spell ...]
        remove_known_spell_patch: ($) =>
            prec.right(seq("REMOVE_KNOWN_SPELL", repeat1(field("spell", $._value)))),

        // ADD_MAP_NOTE x y color strref
        add_map_note_patch: ($) =>
            seq(
                "ADD_MAP_NOTE",
                field("x", $._value),
                field("y", $._value),
                field("color", $._value),
                field("strref", $._value)
            ),

        // SET_BG2_PROFICIENCY proficiency value
        set_bg2_proficiency_patch: ($) =>
            seq("SET_BG2_PROFICIENCY", field("proficiency", $._value), field("value", $._value)),

        // Functions
        launch_patch_function: ($) =>
            seq(
                choice("LAUNCH_PATCH_FUNCTION", "LPF"),
                field("name", choice($.identifier, $.string)),
                repeat($._func_call_param),
                "END"
            ),

        launch_patch_macro: ($) =>
            seq(choice("LAUNCH_PATCH_MACRO", "LPM"), field("name", choice($.identifier, $.string))),

        // REPLACE_BCS_BLOCK file file [ON_MISMATCH patches END]
        // Uses string specifically to avoid ON_MISMATCH being parsed as a file
        replace_bcs_block_patch: ($) =>
            prec.right(seq(
                choice("REPLACE_BCS_BLOCK", "R_B_B"),
                optional($._opt_case),
                repeat1(field("file", $.string)),
                optional(seq("ON_MISMATCH", repeat($._patch), "END"))
            )),

        // Arrays
        define_associative_array_patch: ($) =>
            seq(
                "DEFINE_ASSOCIATIVE_ARRAY",
                field("name", $._value),
                "BEGIN",
                repeat($.assoc_entry),
                "END"
            ),

        clear_array_patch: ($) =>
            seq("CLEAR_ARRAY", field("array", $._value)),

        // SORT_ARRAY_INDICES array NUMERICALLY|LEXICOGRAPHICALLY
        sort_array_indices_patch: ($) =>
            seq("SORT_ARRAY_INDICES", field("array", $._value), choice("NUMERICALLY", "LEXICOGRAPHICALLY")),

        // Associative array entry: key(s) => value
        // Keys can be comma-separated for multi-dimensional arrays
        // Keys can be regular values or numeric-starting identifiers (e.g., 2HSW02)
        assoc_entry: ($) => seq(
            choice($._value, $.var_name_numeric),
            repeat(seq(",", $._value)),
            "=>",
            $._value
        ),

        // Misc
        patch_print: ($) => seq("PATCH_PRINT", field("message", $._value)),
        patch_log: ($) => seq("PATCH_LOG", field("message", $._value)),
        patch_warn: ($) => seq("PATCH_WARN", field("message", $._value)),
        patch_fail: ($) => seq("PATCH_FAIL", field("message", $._value)),
        patch_abort: ($) => seq("PATCH_ABORT", field("message", $._value)),
        patch_include: ($) => prec.right(seq("PATCH_INCLUDE", repeat1(field("file", $._value)))),
        patch_reraise: ($) => "PATCH_RERAISE",
        patch_silent: ($) => "PATCH_SILENT",
        patch_verbose: ($) => "PATCH_VERBOSE",
        compile_baf_to_bcs: ($) => "COMPILE_BAF_TO_BCS",
        decompile_bcs_to_baf: ($) => "DECOMPILE_BCS_TO_BAF",
        compile_d_to_dlg: ($) => "COMPILE_D_TO_DLG",
        decompile_dlg_to_d: ($) => "DECOMPILE_DLG_TO_D",

        decompile_and_patch: ($) =>
            seq(
                "DECOMPILE_AND_PATCH",
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // DECOMPRESS_REPLACE_FILE offset compressed_size uncompressed_size
        decompress_replace_file_patch: ($) =>
            seq(
                "DECOMPRESS_REPLACE_FILE",
                field("offset", $._value),
                field("compressed_size", $._value),
                field("uncompressed_size", $._value)
            ),

        // COMPRESS_REPLACE_FILE offset uncompressed_size level
        compress_replace_file_patch: ($) =>
            seq(
                "COMPRESS_REPLACE_FILE",
                field("offset", $._value),
                field("uncompressed_size", $._value),
                field("level", $._value)
            ),

        // DECOMPRESS_INTO_VAR offset compressed_size uncompressed_size var
        decompress_into_var_patch: ($) =>
            seq(
                "DECOMPRESS_INTO_VAR",
                field("offset", $._value),
                field("compressed_size", $._value),
                field("uncompressed_size", $._value),
                field("var", $.identifier)
            ),

        // PATCH_TRY ... WITH DEFAULT ... END
        patch_try: ($) =>
            seq(
                "PATCH_TRY",
                repeat($._patch),
                "WITH",
                optional("DEFAULT"),
                repeat($._patch),
                "END"
            ),

        // INNER_PATCH buffer BEGIN patches END
        inner_patch: ($) =>
            seq(
                "INNER_PATCH",
                field("buffer", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // INNER_PATCH_SAVE var buffer BEGIN patches END
        inner_patch_save: ($) =>
            seq(
                "INNER_PATCH_SAVE",
                field("var", $._assignable),
                field("buffer", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // INNER_PATCH_FILE filename BEGIN patches END
        inner_patch_file: ($) =>
            seq(
                "INNER_PATCH_FILE",
                field("file", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // INNER_ACTION BEGIN actions END
        inner_action: ($) =>
            seq(
                "INNER_ACTION",
                "BEGIN",
                repeat($._action),
                "END"
            ),

        // =========================================
        // ACTIONS
        // =========================================

        _action: ($) =>
            choice(
                // File operations
                $.copy_action,
                $.copy_existing_action,
                $.copy_existing_regexp_action,
                $.copy_large_action,
                $.copy_random_action,
                $.copy_all_gam_files_action,
                $.compile_action,
                $.create_action,
                $.extend_top_action,
                $.extend_bottom_action,
                $.append_action,
                $.append_col_action,
                $.append_outer_action,
                $.delete_action,
                $.move_action,
                $.mkdir_action,
                $.inlined_file,
                // Control flow
                $.action_if,
                $.action_match,
                $.action_try,
                $.outer_for,
                $.outer_while,
                $.action_for_each,
                $.action_php_each,
                // Variables
                $.outer_set_action,
                $.outer_sprint_action,
                $.outer_text_sprint_action,
                $.with_tra_action,
                $.outer_patch_action,
                $.outer_patch_save_action,
                $.outer_inner_patch_action,
                $.outer_inner_patch_save_action,
                // Includes
                $.include_action,
                // Functions/macros
                $.define_action_macro,
                $.define_patch_macro,
                $.define_action_function,
                $.define_patch_function,
                $.launch_action_macro,
                $.launch_action_function,
                // Arrays
                $.action_define_array,
                $.action_define_associative_array,
                $.action_clear_array,
                // String/tra
                $.string_set_action,
                $.load_tra_action,
                // Game data modification
                $.add_sectype_action,
                $.add_area_type_action,
                $.add_spell_action,
                $.add_kit_action,
                // System/execution
                $.at_now_action,
                $.action_bash_for,
                $.decompress_biff_action,
                // Misc
                $.print_action,
                $.warn_action,
                $.fail_action,
                $.clear_memory_action,
                $.silent_action,
                $.verbose_action,
                $.action_to_upper,
                $.action_to_lower,
                $.action_get_strref,
                $.require_predicate_action,
                $.forbid_component_action,
                $.action_clear_array,
                $.disable_from_key_action,
                $.random_seed_action,
                $.action_readln,
                // Inlined files can appear in action context
                $.inlined_file
            ),

        // File operations
        copy_action: ($) =>
            seq(
                "COPY",
                optional($._opt_no_backup),
                optional($._opt_glob),
                repeat1($.file_pair),
                optional($._patches),
                optional($._but_only)
            ),

        copy_existing_action: ($) =>
            seq(
                "COPY_EXISTING",
                optional($._opt_no_backup),
                repeat1($.file_pair),
                optional($._patches),
                optional($._but_only)
            ),

        copy_existing_regexp_action: ($) =>
            seq(
                "COPY_EXISTING_REGEXP",
                optional($._opt_no_backup),
                optional($._opt_glob),
                repeat1($.file_pair),
                optional($._patches),
                optional($._but_only)
            ),

        // COPY_LARGE - for files >1GB, no patches
        copy_large_action: ($) =>
            seq(
                "COPY_LARGE",
                optional($._opt_no_backup),
                optional($._opt_glob),
                $.file_pair
            ),

        // COPY_RANDOM (file1 file2 ...) [(fileN ...)] - shuffle files
        copy_random_action: ($) =>
            seq(
                "COPY_RANDOM",
                repeat1(seq("(", repeat1($._value), ")")),
                optional($._patches)
            ),

        // COPY_ALL_GAM_FILES - patch Default.gam and savegames
        copy_all_gam_files_action: ($) =>
            seq("COPY_ALL_GAM_FILES", optional($._patches)),

        file_pair: ($) =>
            seq(field("from", $._value), field("to", $._value)),

        // Patch block or inline patches
        // Use low precedence for patch_block to prefer component's BEGIN over patch block
        _patches: ($) => prec.right(choice(repeat1($._patch), $.patch_block)),

        patch_block: ($) => prec(-10, seq("BEGIN", repeat($._patch), "END")),

        // BUT_ONLY, IF_EXISTS, UNLESS, IF can appear in various orders
        _but_only: ($) =>
            choice(
                seq(
                    choice("BUT_ONLY", "BUT_ONLY_IF_IT_CHANGES"),
                    optional("IF_EXISTS"),
                    optional(seq("UNLESS", $._value)),
                    optional(seq("IF", field("if_resource", $._value)))
                ),
                seq(
                    "IF_EXISTS",
                    optional(seq("UNLESS", $._value)),
                    optional(choice("BUT_ONLY", "BUT_ONLY_IF_IT_CHANGES"))
                ),
                seq("UNLESS", $._value, optional(choice("BUT_ONLY", "BUT_ONLY_IF_IT_CHANGES")))
            ),

        compile_action: ($) =>
            prec.right(seq(
                "COMPILE",
                optional(choice("EVALUATE_BUFFER", "EVAL")),
                repeat1(field("source", $._value)),
                optional(choice("EVALUATE_BUFFER", "EVAL")),
                optional(seq("USING", repeat1(field("tra", $._value))))
            )),

        // EXTEND_TOP for BCS files: source, target, optional flags, optional inline patches
        // Note: inline patches do NOT start with BEGIN (that's patch_block which conflicts with component)
        extend_top_action: ($) =>
            prec.right(seq(
                "EXTEND_TOP",
                field("existing", $._value),
                field("new_file", $._value),
                optional(choice("EVALUATE_BUFFER", "EVAL")),
                repeat($._patch)
            )),

        // EXTEND_BOTTOM for BCS files: source, target, optional flags, optional inline patches
        extend_bottom_action: ($) =>
            prec.right(seq(
                "EXTEND_BOTTOM",
                field("existing", $._value),
                field("new_file", $._value),
                optional(choice("EVALUATE_BUFFER", "EVAL")),
                repeat($._patch)
            )),

        append_action: ($) =>
            seq(
                "APPEND",
                field("file", $._value),
                field("text", $._value),
                optional(seq("IF", field("if_text", $._value))),
                optional(seq("UNLESS", field("unless_text", $._value)))
            ),

        append_col_action: ($) =>
            seq(
                "APPEND_COL",
                field("file", $._value),
                field("text", $._value),
                optional(seq("IF", field("if_text", $._value))),
                optional(seq("UNLESS", field("unless_text", $._value)))
            ),

        // APPEND_OUTER file text [KEEP_CRLF]
        append_outer_action: ($) =>
            seq(
                "APPEND_OUTER",
                field("file", $._value),
                field("text", $._value),
                optional("KEEP_CRLF")
            ),

        delete_action: ($) => prec.right(seq("DELETE", optional($._opt_no_backup), repeat1(field("file", $._value)))),
        move_action: ($) => seq("MOVE", field("from", $._value), field("to", $._value)),
        mkdir_action: ($) => seq("MKDIR", field("dir", $._value)),

        // CREATE type [VERSION ~version~] ~resref~
        create_action: ($) =>
            seq(
                "CREATE",
                field("type", $.identifier),
                optional(seq("VERSION", field("version", $._value))),
                field("resref", $._value),
                optional($._patches)
            ),

        // Control flow
        action_if: ($) =>
            seq(
                "ACTION_IF",
                field("condition", $._value),
                optional("THEN"),
                "BEGIN",
                repeat($._action),
                "END",
                optional(seq("ELSE", choice(
                    seq("BEGIN", repeat($._action), "END"),
                    $.action_if,
                    $._action  // Single action without BEGIN...END
                )))
            ),

        // ACTION_MATCH value WITH cases... DEFAULT [actions] END
        action_match: ($) =>
            seq(
                "ACTION_MATCH",
                field("value", $._value),
                "WITH",
                repeat($.action_match_case),
                optional(seq("DEFAULT", repeat($._action))),
                "END"
            ),

        action_match_case: ($) =>
            seq(
                repeat1($._value),
                optional("WHEN"),
                optional(field("condition", $._value)),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        // ACTION_TRY ... WITH DEFAULT ... END
        action_try: ($) =>
            seq(
                "ACTION_TRY",
                repeat($._action),
                "WITH",
                optional("DEFAULT"),
                repeat($._action),
                "END"
            ),

        outer_for: ($) =>
            seq(
                "OUTER_FOR",
                "(",
                optional($._patch),
                ";",
                field("condition", $._value),
                ";",
                optional($._patch),
                ")",
                "BEGIN",
                repeat($._action),
                "END"
            ),

        outer_while: ($) =>
            seq(
                "OUTER_WHILE",
                field("condition", $._value),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        // ACTION_FOR_EACH can have BEGIN...END or just actions...END (no BEGIN)
        action_for_each: ($) =>
            prec.right(seq(
                "ACTION_FOR_EACH",
                field("var", $._value),
                "IN",
                repeat1($._value),
                optional("BEGIN"),
                repeat($._action),
                "END"
            )),

        action_php_each: ($) =>
            seq(
                "ACTION_PHP_EACH",
                field("array", $._value),
                "AS",
                field("key_var", $._value),
                "=>",
                field("value_var", $._value),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        // Variables
        // OUTER_SET var = value or OUTER_SET ++var or OUTER_SET --var
        outer_set_action: ($) =>
            seq(
                "OUTER_SET",
                choice(
                    seq(field("var", $._assignable), $._assign_op, field("value", $._value)),
                    seq(choice("++", "--"), field("var", $._assignable))
                )
            ),

        outer_sprint_action: ($) =>
            seq("OUTER_SPRINT", field("var", $._value), field("value", $._value)),

        outer_text_sprint_action: ($) =>
            seq("OUTER_TEXT_SPRINT", field("var", $._value), field("value", $._value)),

        // WITH_TRA ~file.tra~ BEGIN ... END - temporarily loads a translation file
        with_tra_action: ($) =>
            seq(
                "WITH_TRA",
                repeat1(field("file", $._value)),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        outer_patch_action: ($) =>
            seq(
                "OUTER_PATCH",
                field("buffer", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        outer_patch_save_action: ($) =>
            seq(
                "OUTER_PATCH_SAVE",
                field("var", $.identifier),
                field("buffer", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        outer_inner_patch_action: ($) =>
            seq(
                "OUTER_INNER_PATCH",
                field("buffer", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        outer_inner_patch_save_action: ($) =>
            seq(
                "OUTER_INNER_PATCH_SAVE",
                field("var", $.identifier),
                field("buffer", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        // Includes
        include_action: ($) => seq("INCLUDE", field("file", $._value)),

        // Functions/macros definitions
        define_action_macro: ($) =>
            seq(
                "DEFINE_ACTION_MACRO",
                field("name", choice($.identifier, $.string)),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        define_patch_macro: ($) =>
            seq(
                "DEFINE_PATCH_MACRO",
                field("name", choice($.identifier, $.string)),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        define_action_function: ($) =>
            seq(
                "DEFINE_ACTION_FUNCTION",
                field("name", choice($.identifier, $.string)),
                repeat($._func_decl_param),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        define_patch_function: ($) =>
            seq(
                "DEFINE_PATCH_FUNCTION",
                field("name", choice($.identifier, $.string)),
                repeat($._func_decl_param),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        _func_decl_param: ($) =>
            choice(
                $.int_var_decl,
                $.str_var_decl,
                $.ret_decl,
                $.ret_array_decl
            ),

        // Parameter name is identifier or string, not full expression (to avoid = ambiguity)
        int_var_decl: ($) =>
            seq("INT_VAR", repeat(seq(choice($.identifier, $.string), optional(seq("=", $._value))))),

        str_var_decl: ($) =>
            seq("STR_VAR", repeat(seq(choice($.identifier, $.string), optional(seq("=", $._value))))),

        ret_decl: ($) => seq("RET", repeat1($.identifier)),

        ret_array_decl: ($) => seq("RET_ARRAY", repeat1($.identifier)),

        // Function/macro calls
        launch_action_macro: ($) =>
            seq(choice("LAUNCH_ACTION_MACRO", "LAM"), field("name", choice($.identifier, $.string))),

        launch_action_function: ($) =>
            seq(
                choice("LAUNCH_ACTION_FUNCTION", "LAF"),
                field("name", choice($.identifier, $.string)),
                repeat($._func_call_param),
                "END"
            ),

        _func_call_param: ($) =>
            choice($.int_var_call, $.str_var_call, $.ret_call, $.ret_array_call),

        // Function call parameters - name can be identifier or evaluated string
        // INT_VAR can be empty (just resets to defaults)
        int_var_call: ($) =>
            seq("INT_VAR", repeat(seq($._value, optional(seq("=", $._value))))),

        str_var_call: ($) =>
            seq("STR_VAR", repeat1(seq($._value, optional(seq("=", $._value))))),

        ret_call: ($) =>
            seq("RET", repeat1(seq($._value, optional(seq("=", $._value))))),

        ret_array_call: ($) =>
            seq("RET_ARRAY", repeat1(seq($._value, optional(seq("=", $._value))))),

        // Arrays
        // DEFINE_ARRAY can be used with either simple values or key=>value pairs
        // WeiDU accepts both ACTION_DEFINE_ARRAY and bare DEFINE_ARRAY
        action_define_array: ($) =>
            seq(
                choice("ACTION_DEFINE_ARRAY", "DEFINE_ARRAY"),
                field("name", $._value),
                "BEGIN",
                repeat(choice($._value, $.assoc_entry)),
                "END"
            ),

        action_define_associative_array: ($) =>
            seq(
                choice("ACTION_DEFINE_ASSOCIATIVE_ARRAY", "DEFINE_ASSOCIATIVE_ARRAY"),
                field("name", $._value),
                "BEGIN",
                repeat($.assoc_entry),
                "END"
            ),

        action_clear_array: ($) =>
            seq("ACTION_CLEAR_ARRAY", field("array", $._value)),

        // String/tra operations
        // STRING_SET can have single pair or multiple pairs on separate lines
        // STRING_SET / STRING_SET_EVALUATE can have multiple pairs
        string_set_action: ($) =>
            prec.right(seq(
                choice("STRING_SET", "STRING_SET_EVALUATE"),
                repeat1(seq(field("strref", $._value), field("value", $._value)))
            )),

        load_tra_action: ($) =>
            prec.right(seq("LOAD_TRA", repeat1(field("file", $._value)))),

        // Game data modification
        add_sectype_action: ($) =>
            seq("ADD_SECTYPE", field("name", $._value), field("label", $._value)),

        // ADD_AREA_TYPE - adds a new area type constant
        add_area_type_action: ($) =>
            seq("ADD_AREA_TYPE", field("name", $._value)),

        // ADD_SPELL file level type name [patches]
        add_spell_action: ($) =>
            prec.right(seq(
                "ADD_SPELL",
                field("file", $._value),
                field("level", $._value),
                field("type", $._value),
                field("name", $._value),
                optional($._patches)
            )),

        // ADD_KIT name values... - adds a new kit with multiple 2DA entries
        // Can include SAY statements for kit names/descriptions
        add_kit_action: ($) =>
            prec.right(seq("ADD_KIT", repeat1(choice($._value, $.kit_say)))),

        // SAY value - provides a TLK string reference (used in ADD_KIT context)
        kit_say: ($) => seq("SAY", $._value),

        // System/execution - AT_NOW [var] command [EXACT]
        at_now_action: ($) =>
            seq("AT_NOW", optional(field("var", $.identifier)), field("command", $._value), optional("EXACT")),

        // ACTION_BASH_FOR dir pattern BEGIN ... END
        action_bash_for: ($) =>
            seq(
                "ACTION_BASH_FOR",
                field("directory", $._value),
                field("pattern", $._value),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        // DECOMPRESS_BIFF file
        decompress_biff_action: ($) => seq("DECOMPRESS_BIFF", field("file", $._value)),

        // Print/messaging
        print_action: ($) => seq("PRINT", field("message", $._value)),
        warn_action: ($) => seq("WARN", field("message", $._value)),
        fail_action: ($) => seq("FAIL", field("message", $._value)),

        // Memory clear actions
        clear_memory_action: ($) =>
            choice("CLEAR_MEMORY", "CLEAR_ARRAYS", "CLEAR_CODES", "CLEAR_INLINED", "CLEAR_EVERYTHING", "CLEAR_IDS_MAP"),

        // RANDOM_SEED value - initialize random number generator
        random_seed_action: ($) => seq("RANDOM_SEED", $._value),

        // ACTION_READLN var - read user input
        action_readln: ($) => seq("ACTION_READLN", $._value),

        // Output control
        silent_action: ($) => "SILENT",
        verbose_action: ($) => "VERBOSE",

        // Case conversion
        action_to_upper: ($) => seq("ACTION_TO_UPPER", field("var", $.identifier)),
        action_to_lower: ($) => seq("ACTION_TO_LOWER", field("var", $.identifier)),

        // ACTION_GET_STRREF strref var - action version of GET_STRREF
        action_get_strref: ($) => seq("ACTION_GET_STRREF", field("strref", $._value), field("var", $.identifier)),

        // REQUIRE_PREDICATE as standalone action (also exists as component flag)
        // Use prec to prefer this over assignment_patch parsing REQUIRE_PREDICATE as identifier
        require_predicate_action: ($) =>
            prec(10, seq("REQUIRE_PREDICATE", field("predicate", $._value), field("message", $._value))),

        // FORBID_COMPONENT as standalone action (also exists as component flag)
        forbid_component_action: ($) =>
            prec(10, seq("FORBID_COMPONENT", field("file", $._value), field("component", $._value), field("message", $._value))),

        action_clear_array: ($) =>
            seq("ACTION_CLEAR_ARRAY", field("array", $._value)),

        // DISABLE_FROM_KEY - removes resources from key file
        disable_from_key_action: ($) =>
            prec.right(seq("DISABLE_FROM_KEY", repeat1(field("resource", $._value)))),

        // =========================================
        // TOP-LEVEL DIRECTIVES
        // =========================================

        _top_level: ($) =>
            choice(
                $.backup_directive,
                $.author_directive,
                $.support_directive,
                $.version_flag,
                $.readme_directive,
                $.no_if_eval_bug_flag,
                $.auto_eval_strings_flag,
                $.allow_missing_directive,
                $.language_directive,
                $.component,
                $.inlined_file,
                $.always_block
            ),

        backup_directive: ($) => seq("BACKUP", field("path", $._value)),
        author_directive: ($) => seq("AUTHOR", field("email", $._value)),
        support_directive: ($) => seq("SUPPORT", field("url", $._value)),
        version_flag: ($) => seq("VERSION", field("version", $._value)),
        readme_directive: ($) => prec.right(seq("README", repeat1(field("path", $._value)))),
        no_if_eval_bug_flag: ($) => "NO_IF_EVAL_BUG",
        auto_eval_strings_flag: ($) => "AUTO_EVAL_STRINGS",
        allow_missing_directive: ($) =>
            prec.right(seq("ALLOW_MISSING", repeat1(field("file", $._value)))),

        language_directive: ($) =>
            prec.right(seq(
                "LANGUAGE",
                field("name", $._value),
                field("directory", $._value),
                repeat1(field("tra_file", $._value))
            )),

        // Component with high precedence to properly terminate at next BEGIN
        component: ($) =>
            prec(100, seq(
                "BEGIN",
                field("name", $._value),
                repeat($._component_flag),
                repeat($._action)
            )),

        _component_flag: ($) =>
            choice(
                $.designated_flag,
                $.subcomponent_flag,
                $.group_flag,
                $.require_predicate_flag,
                $.require_component_flag,
                $.label_flag
            ),

        designated_flag: ($) => seq("DESIGNATED", field("number", $.number)),
        subcomponent_flag: ($) => seq("SUBCOMPONENT", field("name", $._value)),
        group_flag: ($) => seq("GROUP", field("name", $._value)),
        label_flag: ($) => seq("LABEL", field("label", $._value)),
        require_predicate_flag: ($) =>
            seq("REQUIRE_PREDICATE", field("predicate", $._value), field("message", $._value)),
        // REQUIRE_COMPONENT file component_number message
        require_component_flag: ($) =>
            seq("REQUIRE_COMPONENT", field("file", $._value), field("component", $._value), field("message", $._value)),

        always_block: ($) =>
            seq("ALWAYS", repeat($._action), "END"),

        inlined_file: ($) =>
            seq(
                "<<<<<<<<",
                field("filename", $.inlined_filename),
                field("body", $.inlined_body),
                ">>>>>>>>"
            ),
        inlined_filename: ($) => /[^\n]+/,
        inlined_body: ($) => /[^>]*(?:>[^>][^>]*)*/, // Match until >>>>>>>>
    },
});
