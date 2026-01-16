/**
 * Tree-sitter grammar for WeiDU TP2 files.
 * Covers .tp2 (full), .tpa/.tph (actions), .tpp (patches).
 *
 * @file WeiDU TP2 grammar
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// =========================================
// HELPER FUNCTIONS
// =========================================

/** choice() that handles single keyword without warning */
const kw = (...keywords) => (keywords.length === 1 ? keywords[0] : choice(...keywords));

/** Read patch: KEYWORD offset var [ELSE value] */
const readPatch =
    (...keywords) =>
    ($) =>
        seq(
            kw(...keywords),
            field("offset", $._value),
            field("var", $._assignable),
            optional(seq("ELSE", field("else_value", $._value)))
        );

/** Write patch: KEYWORD offset value */
const writePatch =
    (...keywords) =>
    ($) =>
        seq(kw(...keywords), field("offset", $._value), field("value", $._value));

/** Memory access expression: KEYWORD offset */
const memoryAt =
    (...keywords) =>
    ($) =>
        seq(kw(...keywords), field("offset", $._value));

/** Check expression: KEYWORD value (with prec.right(3)) */
const checkExpr =
    (keyword, fieldName = "value") =>
    ($) =>
        prec.right(3, seq(keyword, field(fieldName, $._value)));

/** Check expression using simple value (excludes OR/AND): KEYWORD value (with prec.right(3)) */
const checkExprSimple =
    (keyword, fieldName = "value") =>
    ($) =>
        prec.right(3, seq(keyword, field(fieldName, $._simple_value)));

/** Sprint-like operation: KEYWORD var value */
const sprintOp =
    (...keywords) =>
    ($) =>
        seq(kw(...keywords), field("var", $._value), field("value", $._value));

/** Print-like operation: KEYWORD message */
const printOp =
    (keyword) =>
    ($) =>
        seq(keyword, field("message", $._value));

/** Case conversion: KEYWORD var (identifier only) */
const caseConvert =
    (keyword) =>
    ($) =>
        seq(keyword, field("var", $.identifier));

/** CRE/store item patch: KEYWORD values... */
const itemPatch =
    (keyword) =>
    ($) =>
        seq(keyword, repeat1($._value));

/** EXTEND action: KEYWORD existing new_file [EVAL] patches... */
const extendAction =
    (keyword) =>
    ($) =>
        prec.right(
            seq(
                keyword,
                field("existing", $._value),
                field("new_file", $._value),
                optional(choice("EVALUATE_BUFFER", "EVAL")),
                repeat($._patch)
            )
        );

/** APPEND action: KEYWORD file text [IF ...] [UNLESS ...] */
const appendAction =
    (keyword) =>
    ($) =>
        seq(
            keyword,
            field("file", $._value),
            field("text", $._value),
            optional(seq("IF", field("if_text", $._value))),
            optional(seq("UNLESS", field("unless_text", $._value)))
        );

/** Define macro: KEYWORD name BEGIN body END */
const defineMacro =
    (keyword, bodyType) =>
    ($) =>
        seq(keyword, field("name", choice($.identifier, $.string)), "BEGIN", repeat(bodyType($)), "END");

/** Define function: KEYWORD name params BEGIN body END */
const defineFunction =
    (keyword, bodyType) =>
    ($) =>
        seq(
            keyword,
            field("name", choice($.identifier, $.string)),
            repeat($._func_decl_param),
            "BEGIN",
            repeat(bodyType($)),
            "END"
        );

/** FOR loop: FOR (init; cond; step) BEGIN body END */
const forLoop =
    (keyword, bodyType) =>
    ($) =>
        seq(
            keyword,
            "(",
            optional($._patch),
            ";",
            field("condition", $._value),
            ";",
            optional($._patch),
            ")",
            "BEGIN",
            repeat(bodyType($)),
            "END"
        );

/** WHILE loop: WHILE cond BEGIN body END */
const whileLoop =
    (keyword, bodyType) =>
    ($) =>
        seq(keyword, field("condition", $._value), "BEGIN", repeat(bodyType($)), "END");

/** PHP_EACH loop: KEYWORD array AS key => value BEGIN body END */
const phpEachLoop =
    (...keywords) =>
    (bodyType) =>
    ($) =>
        seq(
            kw(...keywords),
            field("array", $._value),
            "AS",
            field("key_var", $.identifier),
            "=>",
            field("value_var", $.identifier),
            "BEGIN",
            repeat(bodyType($)),
            "END"
        );

/** Index expression: KEYWORD ( [flags] needle haystack [start] ) */
const indexExpr =
    (keyword, hasHaystack = true) =>
    ($) =>
        seq(
            keyword,
            "(",
            optional($.search_flags),
            field("needle", $._value),
            ...(hasHaystack ? [field("haystack", $._value)] : []),
            optional(field("start", $._value)),
            ")"
        );

/** OUTER_PATCH action: KEYWORD buffer BEGIN patches END */
const outerPatchAction =
    (keyword) =>
    ($) =>
        seq(keyword, field("buffer", $._value), "BEGIN", repeat($._patch), "END");

/** OUTER_PATCH_SAVE action: KEYWORD var buffer BEGIN patches END */
const outerPatchSaveAction =
    (keyword) =>
    ($) =>
        seq(keyword, field("var", $.identifier), field("buffer", $._value), "BEGIN", repeat($._patch), "END");

/** INNER_PATCH: KEYWORD buffer BEGIN patches END */
const innerPatchOp =
    (keyword) =>
    ($) =>
        seq(keyword, field("buffer", $._value), "BEGIN", repeat($._patch), "END");

/** TRY block: KEYWORD body WITH [DEFAULT] handler END */
const tryBlock =
    (keyword, bodyType) =>
    ($) =>
        seq(keyword, repeat(bodyType($)), "WITH", optional("DEFAULT"), repeat(bodyType($)), "END");

/** DEFINE_ASSOCIATIVE_ARRAY: KEYWORD name BEGIN entries END */
const defineAssocArray =
    (...keywords) =>
    ($) =>
        seq(kw(...keywords), field("name", $._value), "BEGIN", repeat($.assoc_entry), "END");

/** CLEAR_ARRAY: KEYWORD array */
const clearArray =
    (keyword) =>
    ($) =>
        seq(keyword, field("array", $._value));

/** GET_STRREF: KEYWORD strref var */
const getStrref =
    (...keywords) =>
    ($) =>
        seq(kw(...keywords), field("strref", $._value), field("var", $.identifier));

export default grammar({
    name: "weidu_tp2",

    extras: ($) => [/\s/, $.comment, $.line_comment],

    word: ($) => $.identifier,

    conflicts: ($) => [
        [$._expr, $._simple_expr],
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
        // First token disambiguates: normal file (.tp2) vs patch-only file (.tpp)
        source_file: ($) => choice(
            repeat(choice($._top_level, $._action, $.top_level_assignment)),
            $.patch_file
        ),

        // Patch-only file (e.g., .tpp includes) - entire file is patches
        patch_file: ($) => repeat1($._patch),

        // Bare assignment at top level (implicit OUTER_SET, common in .tpp files)
        top_level_assignment: ($) =>
            prec(-1, seq(field("var", $._assignable), $._assign_op, field("value", $._value))),

        // =========================================
        // LITERALS
        // =========================================

        string: ($) => choice($.tilde_string, $.double_string, $.five_tilde_string, $.percent_string),

        tilde_string: ($) => seq("~", optional($.tilde_content), "~"),
        tilde_content: ($) => /[^~]+/,

        double_string: ($) => seq('"', optional($.double_content), '"'),
        double_content: ($) => /[^"]*/,

        five_tilde_string: ($) => seq("~~~~~", optional($.five_tilde_content), "~~~~~"),
        five_tilde_content: ($) => repeat1(choice(/[^~]+/, /~{1,4}/)),

        percent_string: ($) => seq("%", $.percent_content, "%"),
        percent_content: ($) => /[^%]+/,

        // Decimal, hex (0x), octal (0o), binary (0b), # prefix, dotted version
        number: ($) =>
            choice(
                /-?[0-9]+(\.[0-9]+)*/,
                /0[xX][0-9a-fA-F]+/,
                /0[oO][0-7]+/,
                /0[bB][01]+/,
                /#-?[0-9]+/
            ),

        tra_ref: ($) => /@-?[0-9]+/,

        identifier: ($) => /[A-Za-z_][A-Za-z0-9_#-]*/,

        // Unquoted resource reference (e.g., script.bcs, 00MYFILE.itm)
        bare_resref: ($) => /[A-Za-z0-9_][A-Za-z0-9_#-]*\.[A-Za-z0-9]+/,

        // =========================================
        // COMMENTS
        // =========================================

        comment: ($) => seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
        line_comment: ($) => seq("//", /[^\n]*/),

        // =========================================
        // VARIABLE REFERENCES
        // =========================================

        variable_ref: ($) =>
            choice(
                $.identifier,
                $.var_name_numeric,
                seq("%", choice($.identifier, $.var_name_numeric), "%")
            ),

        // Variable name starting with a number (valid inside %...% and as array keys)
        var_name_numeric: ($) => /[0-9][A-Za-z0-9_#-]*/,

        array_access: ($) =>
            choice(
                seq("$", field("name", choice($.identifier, $.string)), "(", repeat($._value), ")"),
                seq("$", "EVAL", field("name", $._value), "(", repeat($._value), ")")
            ),

        _assignable: ($) => choice($.identifier, $.var_name_numeric, $.array_access, $.string),

        // =========================================
        // MODIFIERS / FLAGS
        // =========================================

        _opt_no_backup: ($) => prec(10, choice("+", "-")),
        _opt_glob: ($) => choice("GLOB", "NOGLOB"),
        _opt_case: ($) => choice("CASE_SENSITIVE", "CASE_INSENSITIVE"),
        _opt_exact: ($) => choice("EXACT_MATCH", "EVALUATE_REGEXP"),
        search_flags: ($) => repeat1(choice($._opt_case, $._opt_exact)),

        // =========================================
        // EXPRESSIONS (VALUES)
        // =========================================

        _value: ($) => $._expr,

        // Simple value excludes OR/AND binary expressions - used where boolean operators shouldn't appear
        _simple_value: ($) => $._simple_expr,

        _expr: ($) =>
            choice(
                $.ternary_expr,
                $.binary_expr,
                $.unary_expr,
                $.paren_expr,
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
                $.string_length_expr,
                // Nullary expressions
                $.nullary_expr,
                $.array_access,
                $._primary
            ),

        // Simple expression excludes OR/AND - only comparison and arithmetic binary ops
        _simple_expr: ($) =>
            choice(
                $.ternary_expr,
                $._simple_binary_expr,
                $.unary_expr,
                $.paren_expr,
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
                $.string_length_expr,
                // Nullary expressions
                $.nullary_expr,
                $.array_access,
                $._primary
            ),

        // Binary expression without OR/AND
        _simple_binary_expr: ($) =>
            choice(
                prec.left(2, seq(field("left", $._simple_expr), field("op", $._comparison_op), field("right", $._simple_expr))),
                prec.left(3, seq(field("left", $._simple_expr), field("op", $._arithmetic_op), field("right", $._simple_expr)))
            ),

        _primary: ($) => choice($.string, $.number, $.tra_ref, $.at_ref, $.bare_resref, $.variable_ref),

        at_ref: ($) => prec.right(3, seq("AT", field("ref", $._expr))),

        paren_expr: ($) => seq("(", $._expr, ")"),

        ternary_expr: ($) =>
            prec.right(
                1,
                seq(field("condition", $._expr), "?", field("then", $._expr), ":", field("else", $._expr))
            ),

        binary_expr: ($) =>
            choice(
                prec.left(
                    1,
                    seq(field("left", $._expr), field("op", choice("AND", "OR", "&&", "||")), field("right", $._expr))
                ),
                prec.left(2, seq(field("left", $._expr), field("op", $._comparison_op), field("right", $._expr))),
                prec.left(3, seq(field("left", $._expr), field("op", $._arithmetic_op), field("right", $._expr)))
            ),

        _comparison_op: ($) =>
            choice(
                "==",
                "=",
                "!=",
                "<",
                ">",
                "<=",
                ">=",
                "EQUALS",
                "STRING_COMPARE",
                "STR_CMP",
                "STRING_COMPARE_CASE",
                "STRING_EQUAL",
                "STRING_EQUAL_CASE",
                "STR_EQ",
                "STRING_MATCHES_REGEXP",
                "STRING_CONTAINS_REGEXP",
                "STRING_COMPARE_REGEXP"
            ),

        _arithmetic_op: ($) =>
            choice(
                "+",
                "-",
                "*",
                "/",
                "**",
                "MODULO",
                "REM",
                "BAND",
                "BOR",
                "BXOR",
                "&",
                "|",
                "^^",
                "BLSL",
                "BLSR",
                "BASR",
                "<<",
                ">>",
                "^"
            ),

        unary_expr: ($) => prec.right(3, seq(field("op", $._unary_op), field("operand", $._expr))),

        _unary_op: ($) => choice("-", "NOT", "!", "BNOT", "`", "ABS"),

        evaluated_expr: ($) =>
            prec.right(1, seq(choice("EVAL", "EVALUATE_BUFFER"), field("value", $._expr))),

        // Memory access expressions
        byte_at_expr: memoryAt("BYTE_AT", "SBYTE_AT"),
        short_at_expr: memoryAt("SHORT_AT", "SSHORT_AT"),
        long_at_expr: memoryAt("LONG_AT", "SLONG_AT"),

        // Index expressions
        index_expr: indexExpr("INDEX"),
        rindex_expr: indexExpr("RINDEX"),
        index_buffer_expr: indexExpr("INDEX_BUFFER", false),
        rindex_buffer_expr: indexExpr("RINDEX_BUFFER", false),

        random_expr: ($) =>
            seq("RANDOM", "(", field("lower", $._value), field("upper", $._value), ")"),

        ids_of_symbol_expr: ($) =>
            seq("IDS_OF_SYMBOL", "(", field("file", $._value), field("symbol", $._value), ")"),

        resolve_str_ref_expr: ($) => seq("RESOLVE_STR_REF", "(", field("text", $._value), ")"),

        state_which_says_expr: ($) =>
            prec.right(
                3,
                seq(
                    "STATE_WHICH_SAYS",
                    field("text", $._value),
                    optional(seq("IN", field("in_dlg", $._value))),
                    "FROM",
                    field("from_dlg", $._value)
                )
            ),

        tra_entry_exists_expr: ($) =>
            seq("TRA_ENTRY_EXISTS", "(", field("entry", $._value), repeat(field("file", $._value)), ")"),

        // Check expressions
        file_exists_expr: checkExpr("FILE_EXISTS", "file"),
        file_exists_in_game_expr: checkExpr("FILE_EXISTS_IN_GAME", "file"),
        directory_exists_expr: checkExpr("DIRECTORY_EXISTS", "dir"),
        variable_is_set_expr: checkExpr("VARIABLE_IS_SET", "var"),
        is_an_int_expr: checkExpr("IS_AN_INT", "var"),
        game_is_expr: checkExpr("GAME_IS", "games"),
        game_includes_expr: checkExprSimple("GAME_INCLUDES", "games"),
        engine_is_expr: checkExprSimple("ENGINE_IS", "engines"),
        string_length_expr: checkExpr("STRING_LENGTH", "string"),

        mod_is_installed_expr: ($) =>
            prec.right(
                3,
                seq(choice("MOD_IS_INSTALLED", "COMPONENT_IS_INSTALLED"), field("mod", $._value), field("component", $._simple_value))
            ),

        id_of_label_expr: ($) => seq("ID_OF_LABEL", field("tp2", $._value), field("label", $._value)),

        file_contains_expr: ($) =>
            prec.right(3, seq("FILE_CONTAINS", field("file", $._value), field("regexp", $._value))),

        file_contains_evaluated_expr: ($) =>
            seq("FILE_CONTAINS_EVALUATED", "(", field("file", $._value), field("regexp", $._value), ")"),

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
                $.define_array_patch,
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
            prec.right(
                seq(
                    choice("WRITE_ASCII", "WRITE_ASCIIE", "WRITE_ASCIIT", "WRITE_ASCII_TERMINATE", "WRITE_EVALUATED_ASCII"),
                    field("offset", $._value),
                    field("string", $._value),
                    optional(choice(seq("#", field("length", $._value)), seq("(", field("length", $._value), ")")))
                )
            ),

        write_ascii_list_patch: ($) =>
            prec.right(seq("WRITE_ASCII_LIST", field("offset", $._value), repeat1($._value))),

        write_asciil_patch: ($) =>
            prec.right(seq("WRITE_ASCIIL", field("offset", $._value), repeat1($._value))),

        // Read patches
        read_byte_patch: readPatch("READ_BYTE", "READ_SBYTE"),
        read_short_patch: readPatch("READ_SHORT", "READ_SSHORT"),
        read_long_patch: readPatch("READ_LONG", "READ_SLONG"),

        read_ascii_patch: ($) =>
            prec.right(
                seq(
                    "READ_ASCII",
                    field("offset", $._value),
                    field("var", $._value),
                    optional(seq("ELSE", field("else_value", $._value))),
                    optional(seq("(", field("length", $._value), ")")),
                    optional("NULL")
                )
            ),

        read_strref_patch: ($) => seq("READ_STRREF", field("offset", $._value), field("var", $.identifier)),

        get_strref_patch: getStrref("GET_STRREF", "GET_STRREF_S"),

        lookup_ids_symbol_of_int_patch: ($) =>
            seq(
                "LOOKUP_IDS_SYMBOL_OF_INT",
                field("target", $.identifier),
                field("ids_file", $._value),
                field("value", $._value)
            ),

        // String operations
        say_patch: ($) =>
            seq(choice("SAY", "SAY_EVALUATED"), field("offset", $._value), field("text", $._value)),

        sprint_patch: sprintOp("SPRINT"),
        text_sprint_patch: sprintOp("TEXT_SPRINT"),

        snprint_patch: ($) =>
            seq("SNPRINT", field("length", $._value), field("var", $.identifier), field("value", $._value)),

        sprintf_patch: ($) =>
            prec.right(
                seq(
                    "SPRINTF",
                    field("var", $._value),
                    field("format", $._value),
                    optional(seq("(", repeat($._value), ")"))
                )
            ),

        to_upper_patch: caseConvert("TO_UPPER"),
        to_lower_patch: caseConvert("TO_LOWER"),

        spaces_patch: ($) => seq("SPACES", field("var", $.identifier), field("template", $._value)),
        quote_patch: ($) => seq("QUOTE", field("var", $.identifier), field("string", $._value)),
        source_biff_patch: ($) => seq("SOURCE_BIFF", field("var", $.identifier), field("filename", $._value)),

        // Assignment
        set_patch: ($) =>
            seq("SET", optional("EVAL"), field("var", $._assignable), $._assign_op, field("value", $._value)),

        assignment_patch: ($) =>
            prec(10, seq(field("var", $._assignable), $._assign_op, field("value", $._value))),

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
                optional(
                    seq(
                        "ELSE",
                        choice(
                            seq("BEGIN", repeat($._patch), "END"),
                            $._patch // else-if chain or single patch
                        )
                    )
                )
            ),

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

        for_patch: forLoop("FOR", ($) => $._patch),
        while_patch: whileLoop("WHILE", ($) => $._patch),
        php_each_patch: phpEachLoop("PHP_EACH", "PATCH_PHP_EACH")(($) => $._patch),

        patch_for_each: ($) =>
            seq("PATCH_FOR_EACH", field("var", $._value), "IN", repeat1($._value), "BEGIN", repeat($._patch), "END"),

        // Text manipulation
        replace_patch: ($) =>
            seq("REPLACE", field("regexp", $._value), field("replacement", $._value), optional($.sound_ref)),

        sound_ref: ($) => seq("[", field("sound", $.identifier), "]"),

        replace_textually_patch: ($) =>
            prec.right(
                seq(
                    "REPLACE_TEXTUALLY",
                    optional($.search_flags),
                    field("regexp", $._value),
                    field("replacement", $._value),
                    optional(seq("(", field("count", $._value), ")"))
                )
            ),

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

        append_file_patch: ($) => seq("APPEND_FILE", field("file", $._value)),

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
            seq("READ_2DA_ENTRIES_NOW", field("var", $._value), field("req_cols", $._value)),

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

        set_2da_entry_later_patch: ($) =>
            seq(
                "SET_2DA_ENTRY_LATER",
                field("array", $._value),
                field("row", $._value),
                field("col", $._value),
                field("value", $._value)
            ),

        set_2da_entries_now_patch: ($) =>
            seq("SET_2DA_ENTRIES_NOW", field("array", $._value), field("req_cols", $._value)),

        count_2da_cols_patch: ($) =>
            seq("COUNT_2DA_COLS", field("var", choice($.identifier, $.string))),

        count_2da_rows_patch: ($) =>
            seq("COUNT_2DA_ROWS", field("req_cols", $._value), field("var", choice($.identifier, $.string))),

        count_regexp_instances_patch: ($) =>
            seq(
                "COUNT_REGEXP_INSTANCES",
                optional("CASE_SENSITIVE"),
                optional("EXACT_MATCH"),
                field("pattern", $._value),
                field("var", $._value)
            ),

        pretty_print_2da_patch: ($) => "PRETTY_PRINT_2DA",

        insert_2da_row_patch: ($) =>
            seq("INSERT_2DA_ROW", field("row", $._value), field("req_cols", $._value), field("value", $._value)),

        remove_2da_row_patch: ($) =>
            seq("REMOVE_2DA_ROW", field("row", $._value), field("req_cols", $._value)),

        get_offset_array_patch: ($) =>
            prec.right(seq("GET_OFFSET_ARRAY", field("var", $.identifier), repeat1($._value))),

        get_offset_array2_patch: ($) =>
            prec.right(seq("GET_OFFSET_ARRAY2", field("var", $.identifier), repeat1($._value))),

        // Store/CRE item operations (using helpers)
        remove_store_item_patch: ($) =>
            seq("REMOVE_STORE_ITEM", repeat1(field("item", $._value))),

        add_store_item_patch: ($) =>
            seq("ADD_STORE_ITEM", optional($._opt_no_backup), repeat1(field("item", $._value))),

        replace_cre_item_patch: itemPatch("REPLACE_CRE_ITEM"),
        remove_cre_item_patch: itemPatch("REMOVE_CRE_ITEM"),
        add_cre_item_patch: itemPatch("ADD_CRE_ITEM"),

        add_memorized_spell_patch: ($) =>
            prec.right(
                seq(
                    "ADD_MEMORIZED_SPELL",
                    field("spell", $._value),
                    field("level", $._value),
                    field("type", $._value),
                    optional(seq("(", field("count", $._value), ")"))
                )
            ),

        remove_memorized_spells_patch: ($) => "REMOVE_MEMORIZED_SPELLS",
        remove_known_spells_patch: ($) => "REMOVE_KNOWN_SPELLS",
        remove_cre_effects_patch: ($) => "REMOVE_CRE_EFFECTS",

        add_known_spell_patch: ($) =>
            seq("ADD_KNOWN_SPELL", field("spell", $._value), field("level", $._value), field("type", $._value)),

        remove_known_spell_patch: ($) =>
            prec.right(seq("REMOVE_KNOWN_SPELL", repeat1(field("spell", $._value)))),

        add_map_note_patch: ($) =>
            seq(
                "ADD_MAP_NOTE",
                field("x", $._value),
                field("y", $._value),
                field("color", $._value),
                field("strref", $._value)
            ),

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

        replace_bcs_block_patch: ($) =>
            prec.right(
                seq(
                    choice("REPLACE_BCS_BLOCK", "R_B_B"),
                    optional($._opt_case),
                    repeat1(field("file", $.string)),
                    optional(seq("ON_MISMATCH", repeat($._patch), "END"))
                )
            ),

        // Arrays
        define_array_patch: ($) =>
            seq("DEFINE_ARRAY", field("name", $._value), "BEGIN", repeat($._value), "END"),
        define_associative_array_patch: defineAssocArray("DEFINE_ASSOCIATIVE_ARRAY"),
        clear_array_patch: clearArray("CLEAR_ARRAY"),

        sort_array_indices_patch: ($) =>
            seq("SORT_ARRAY_INDICES", field("array", $._value), choice("NUMERICALLY", "LEXICOGRAPHICALLY")),

        assoc_entry: ($) =>
            seq(choice($._value, $.var_name_numeric), repeat(seq(",", $._value)), "=>", $._value),

        // Print/log operations (using helpers)
        patch_print: printOp("PATCH_PRINT"),
        patch_log: printOp("PATCH_LOG"),
        patch_warn: printOp("PATCH_WARN"),
        patch_fail: printOp("PATCH_FAIL"),
        patch_abort: printOp("PATCH_ABORT"),

        patch_include: ($) => prec.right(seq("PATCH_INCLUDE", repeat1(field("file", $._value)))),
        patch_reraise: ($) => "PATCH_RERAISE",
        patch_silent: ($) => "PATCH_SILENT",
        patch_verbose: ($) => "PATCH_VERBOSE",
        compile_baf_to_bcs: ($) => "COMPILE_BAF_TO_BCS",
        decompile_bcs_to_baf: ($) => "DECOMPILE_BCS_TO_BAF",
        compile_d_to_dlg: ($) => "COMPILE_D_TO_DLG",
        decompile_dlg_to_d: ($) => "DECOMPILE_DLG_TO_D",

        decompile_and_patch: ($) => seq("DECOMPILE_AND_PATCH", "BEGIN", repeat($._patch), "END"),

        decompress_replace_file_patch: ($) =>
            seq(
                "DECOMPRESS_REPLACE_FILE",
                field("offset", $._value),
                field("compressed_size", $._value),
                field("uncompressed_size", $._value)
            ),

        compress_replace_file_patch: ($) =>
            seq(
                "COMPRESS_REPLACE_FILE",
                field("offset", $._value),
                field("uncompressed_size", $._value),
                field("level", $._value)
            ),

        decompress_into_var_patch: ($) =>
            seq(
                "DECOMPRESS_INTO_VAR",
                field("offset", $._value),
                field("compressed_size", $._value),
                field("uncompressed_size", $._value),
                field("var", $.identifier)
            ),

        patch_try: tryBlock("PATCH_TRY", ($) => $._patch),

        inner_patch: innerPatchOp("INNER_PATCH"),

        inner_patch_save: ($) =>
            seq(
                "INNER_PATCH_SAVE",
                field("var", $._assignable),
                field("buffer", $._value),
                "BEGIN",
                repeat($._patch),
                "END"
            ),

        inner_patch_file: ($) =>
            seq("INNER_PATCH_FILE", field("file", $._value), "BEGIN", repeat($._patch), "END"),

        inner_action: ($) => seq("INNER_ACTION", "BEGIN", repeat($._action), "END"),

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
                $.add_projectile_action,
                $.add_sectype_action,
                $.add_area_type_action,
                $.add_spell_action,
                $.add_kit_action,
                // System/execution
                $.at_now_action,
                $.at_interactive_exit_action,
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
                $.disable_from_key_action,
                $.random_seed_action,
                $.action_readln,
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

        copy_large_action: ($) =>
            seq("COPY_LARGE", optional($._opt_no_backup), optional($._opt_glob), $.file_pair),

        copy_random_action: ($) =>
            seq("COPY_RANDOM", repeat1(seq("(", repeat1($._value), ")")), optional($._patches)),

        copy_all_gam_files_action: ($) => seq("COPY_ALL_GAM_FILES", optional($._patches)),

        file_pair: ($) => seq(field("from", $._value), field("to", $._value)),

        // Patches inside actions - either bare patches or BEGIN/END block
        _patches: ($) => prec.right(choice(repeat1($._patch), $.patch_block)),

        patch_block: ($) => prec(-10, seq("BEGIN", repeat($._patch), "END")),

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
            prec.right(
                seq(
                    "COMPILE",
                    optional(choice("EVALUATE_BUFFER", "EVAL")),
                    repeat1(field("source", $._value)),
                    optional(choice("EVALUATE_BUFFER", "EVAL")),
                    optional(seq("USING", repeat1(field("tra", $._value))))
                )
            ),

        extend_top_action: extendAction("EXTEND_TOP"),
        extend_bottom_action: extendAction("EXTEND_BOTTOM"),

        append_action: appendAction("APPEND"),
        append_col_action: appendAction("APPEND_COL"),

        append_outer_action: ($) =>
            seq("APPEND_OUTER", field("file", $._value), field("text", $._value), optional("KEEP_CRLF")),

        delete_action: ($) =>
            prec.right(seq("DELETE", optional($._opt_no_backup), repeat1(field("file", $._value)))),

        move_action: ($) => seq("MOVE", field("from", $._value), field("to", $._value)),

        mkdir_action: ($) => seq("MKDIR", field("dir", $._value)),

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
                optional(
                    seq(
                        "ELSE",
                        choice(
                            seq("BEGIN", repeat($._action), "END"),
                            $.action_if,
                            $._action // Single action without BEGIN...END
                        )
                    )
                )
            ),

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

        action_try: tryBlock("ACTION_TRY", ($) => $._action),

        outer_for: forLoop("OUTER_FOR", ($) => $._action),
        outer_while: whileLoop("OUTER_WHILE", ($) => $._action),

        action_for_each: ($) =>
            prec.right(
                seq(
                    "ACTION_FOR_EACH",
                    field("var", $._value),
                    "IN",
                    repeat1($._value),
                    optional("BEGIN"),
                    repeat($._action),
                    "END"
                )
            ),

        action_php_each: phpEachLoop("ACTION_PHP_EACH")(($) => $._action),

        // Variables
        outer_set_action: ($) =>
            seq(
                "OUTER_SET",
                choice(
                    seq(field("var", $._assignable), $._assign_op, field("value", $._value)),
                    seq(choice("++", "--"), field("var", $._assignable))
                )
            ),

        outer_sprint_action: sprintOp("OUTER_SPRINT"),
        outer_text_sprint_action: sprintOp("OUTER_TEXT_SPRINT"),

        with_tra_action: ($) =>
            seq("WITH_TRA", repeat1(field("file", $._value)), "BEGIN", repeat($._action), "END"),

        outer_patch_action: outerPatchAction("OUTER_PATCH"),
        outer_patch_save_action: outerPatchSaveAction("OUTER_PATCH_SAVE"),
        outer_inner_patch_action: outerPatchAction("OUTER_INNER_PATCH"),
        outer_inner_patch_save_action: outerPatchSaveAction("OUTER_INNER_PATCH_SAVE"),

        // Includes
        include_action: ($) => seq("INCLUDE", field("file", $._value)),

        // Functions/macros definitions (using helpers)
        define_action_macro: defineMacro("DEFINE_ACTION_MACRO", ($) => $._action),
        define_patch_macro: defineMacro("DEFINE_PATCH_MACRO", ($) => $._patch),
        define_action_function: defineFunction("DEFINE_ACTION_FUNCTION", ($) => $._action),
        define_patch_function: defineFunction("DEFINE_PATCH_FUNCTION", ($) => $._patch),

        _func_decl_param: ($) => choice($.int_var_decl, $.str_var_decl, $.ret_decl, $.ret_array_decl),

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

        _func_call_param: ($) => choice($.int_var_call, $.str_var_call, $.ret_call, $.ret_array_call),

        int_var_call: ($) => seq("INT_VAR", repeat(seq($._value, optional(seq("=", $._value))))),
        str_var_call: ($) => seq("STR_VAR", repeat1(seq($._value, optional(seq("=", $._value))))),
        ret_call: ($) => seq("RET", repeat1(seq($._value, optional(seq("=", $._value))))),
        ret_array_call: ($) => seq("RET_ARRAY", repeat1(seq($._value, optional(seq("=", $._value))))),

        // Arrays
        action_define_array: ($) =>
            seq(
                "ACTION_DEFINE_ARRAY",
                field("name", $._value),
                "BEGIN",
                repeat(choice($._value, $.assoc_entry)),
                "END"
            ),

        action_define_associative_array: defineAssocArray(
            "ACTION_DEFINE_ASSOCIATIVE_ARRAY",
            "DEFINE_ASSOCIATIVE_ARRAY"
        ),

        action_clear_array: clearArray("ACTION_CLEAR_ARRAY"),

        // String/tra operations
        string_set_action: ($) =>
            prec.right(
                seq(
                    choice("STRING_SET", "STRING_SET_EVALUATE"),
                    repeat1(seq(field("strref", $._value), field("value", $._value)))
                )
            ),

        load_tra_action: ($) => prec.right(seq("LOAD_TRA", repeat1(field("file", $._value)))),

        // Game data modification
        add_sectype_action: ($) => seq("ADD_SECTYPE", field("name", $._value), field("label", $._value)),

        add_area_type_action: ($) => seq("ADD_AREA_TYPE", field("name", $._value)),

        add_spell_action: ($) =>
            prec.right(
                seq(
                    "ADD_SPELL",
                    field("file", $._value),
                    field("level", $._value),
                    field("type", $._value),
                    field("name", $._value),
                    optional($._patches)
                )
            ),

        add_kit_action: ($) => prec.right(seq("ADD_KIT", repeat1(choice($._value, $.kit_say)))),

        kit_say: ($) => seq("SAY", $._value),

        add_projectile_action: ($) => seq("ADD_PROJECTILE", field("file", $._value)),

        // System/execution
        at_now_action: ($) =>
            seq("AT_NOW", optional(field("var", $.identifier)), field("command", $._value), optional("EXACT")),

        at_interactive_exit_action: ($) => seq("AT_INTERACTIVE_EXIT", field("command", $._value)),

        action_bash_for: ($) =>
            seq(
                "ACTION_BASH_FOR",
                field("directory", $._value),
                field("pattern", $._value),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        decompress_biff_action: ($) => seq("DECOMPRESS_BIFF", field("file", $._value)),

        // Print/messaging (using helpers)
        print_action: printOp("PRINT"),
        warn_action: printOp("WARN"),
        fail_action: printOp("FAIL"),

        clear_memory_action: ($) =>
            choice(
                "CLEAR_MEMORY",
                "CLEAR_ARRAYS",
                "CLEAR_CODES",
                "CLEAR_INLINED",
                "CLEAR_EVERYTHING",
                "CLEAR_IDS_MAP"
            ),

        random_seed_action: ($) => seq("RANDOM_SEED", $._value),

        action_readln: ($) => seq("ACTION_READLN", $._value),

        silent_action: ($) => "SILENT",
        verbose_action: ($) => "VERBOSE",

        // Case conversion (using helpers)
        action_to_upper: caseConvert("ACTION_TO_UPPER"),
        action_to_lower: caseConvert("ACTION_TO_LOWER"),

        action_get_strref: ($) =>
            seq("ACTION_GET_STRREF", field("strref", $._value), field("var", $.identifier)),

        require_predicate_action: ($) =>
            prec(10, seq("REQUIRE_PREDICATE", field("predicate", $._value), field("message", $._value))),

        forbid_component_action: ($) =>
            prec(
                10,
                seq(
                    "FORBID_COMPONENT",
                    field("file", $._value),
                    field("component", $._value),
                    field("message", $._value)
                )
            ),

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
            prec.right(
                seq(
                    "LANGUAGE",
                    field("name", $._value),
                    field("directory", $._value),
                    repeat1(field("tra_file", $._value))
                )
            ),

        component: ($) =>
            prec(100, seq("BEGIN", field("name", $._value), repeat($._component_flag), repeat($._action))),

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
        require_component_flag: ($) =>
            seq(
                "REQUIRE_COMPONENT",
                field("file", $._value),
                field("component", $._value),
                field("message", $._value)
            ),

        always_block: ($) => seq("ALWAYS", repeat($._action), "END"),

        inlined_file: ($) =>
            seq(
                "<<<<<<<<",
                field("filename", $.inlined_filename),
                field("body", $.inlined_body),
                ">>>>>>>>"
            ),
        inlined_filename: ($) => /[^\n]+/,
        inlined_body: ($) => /[^>]*(?:>[^>][^>]*)*/,
    },
});
