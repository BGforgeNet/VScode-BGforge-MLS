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
        [$.action_copy],
        [$.action_copy_existing],
        [$.action_copy_existing_regexp],
        [$.action_create],
        [$.variable_ref, $._assignable],
        [$.variable_ref, $.action_at_now],
        [$.variable_ref, $.assoc_entry],
        [$.patch_remove_store_item],
        [$.patch_add_store_item],
        [$.patch_replace_cre_item],
        [$.patch_remove_cre_item],
        [$.patch_add_cre_item],
        [$.action_copy_all_gam_files],
        [$.action_copy_random],
        [$.action_match_case],
        [$._action, $._top_level],
        [$._assignable, $._primary],
        [$._assignable, $._expr],
        [$.patch_define_associative_array, $.action_define_associative_array],
        [$.patch_evaluate_buffer, $.action_extend_top],
        [$.patch_evaluate_buffer, $.action_extend_bottom],
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
                $.patch_write_byte,
                $.patch_write_short,
                $.patch_write_long,
                $.patch_write_ascii,
                $.patch_write_ascii_list,
                $.patch_write_asciil,
                // Read operations
                $.patch_read_byte,
                $.patch_read_short,
                $.patch_read_long,
                $.patch_read_ascii,
                $.patch_read_strref,
                $.patch_get_strref,
                $.patch_lookup_ids_symbol_of_int,
                // String operations
                $.patch_say,
                $.patch_sprint,
                $.patch_text_sprint,
                $.patch_snprint,
                $.patch_sprintf,
                $.patch_to_upper,
                $.patch_to_lower,
                $.patch_spaces,
                $.patch_quote,
                $.patch_source_biff,
                // Assignment
                $.patch_set,
                $.patch_assignment,
                $.patch_increment,
                $.patch_decrement,
                // Control flow
                $.patch_if,
                $.patch_match,
                $.patch_for,
                $.patch_while,
                $.patch_php_each,
                $.patch_for_each,
                // Text manipulation
                $.patch_replace,
                $.patch_replace_textually,
                $.patch_replace_evaluate,
                // Buffer operations
                $.patch_evaluate_buffer,
                $.patch_insert_bytes,
                $.patch_delete_bytes,
                $.patch_append_file,
                // 2DA operations
                $.patch_read_2da_entry,
                $.patch_read_2da_entries_now,
                $.patch_read_2da_entry_former,
                $.patch_set_2da_entry,
                $.patch_set_2da_entry_later,
                $.patch_set_2da_entries_now,
                $.patch_count_2da_cols,
                $.patch_count_2da_rows,
                $.patch_count_regexp_instances,
                $.patch_pretty_print_2da,
                $.patch_insert_2da_row,
                $.patch_remove_2da_row,
                // Offset array operations
                $.patch_get_offset_array,
                $.patch_get_offset_array2,
                // Store operations
                $.patch_remove_store_item,
                $.patch_add_store_item,
                // CRE item operations
                $.patch_replace_cre_item,
                $.patch_remove_cre_item,
                $.patch_add_cre_item,
                $.patch_add_memorized_spell,
                $.patch_remove_memorized_spells,
                $.patch_add_known_spell,
                $.patch_remove_known_spell,
                $.patch_remove_known_spells,
                $.patch_remove_cre_effects,
                $.patch_add_map_note,
                $.patch_set_bg2_proficiency,
                // Functions
                $.patch_launch_function,
                $.patch_launch_macro,
                $.patch_replace_bcs_block,
                // Arrays
                $.patch_define_array,
                $.patch_define_associative_array,
                $.patch_clear_array,
                $.patch_sort_array_indices,
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
                $.patch_compile_baf_to_bcs,
                $.patch_decompile_bcs_to_baf,
                $.patch_compile_d_to_dlg,
                $.patch_decompile_dlg_to_d,
                $.patch_decompile_and_patch,
                $.patch_decompress_replace_file,
                $.patch_compress_replace_file,
                $.patch_decompress_into_var
            ),

        // Write patches
        patch_write_byte: writePatch("WRITE_BYTE"),
        patch_write_short: writePatch("WRITE_SHORT"),
        patch_write_long: writePatch("WRITE_LONG"),

        patch_write_ascii: ($) =>
            prec.right(
                seq(
                    choice("WRITE_ASCII", "WRITE_ASCIIE", "WRITE_ASCIIT", "WRITE_ASCII_TERMINATE", "WRITE_EVALUATED_ASCII"),
                    field("offset", $._value),
                    field("string", $._value),
                    optional(choice(seq("#", field("length", $._value)), seq("(", field("length", $._value), ")")))
                )
            ),

        patch_write_ascii_list: ($) =>
            prec.right(seq("WRITE_ASCII_LIST", field("offset", $._value), repeat1($._value))),

        patch_write_asciil: ($) =>
            prec.right(seq("WRITE_ASCIIL", field("offset", $._value), repeat1($._value))),

        // Read patches
        patch_read_byte: readPatch("READ_BYTE", "READ_SBYTE"),
        patch_read_short: readPatch("READ_SHORT", "READ_SSHORT"),
        patch_read_long: readPatch("READ_LONG", "READ_SLONG"),

        patch_read_ascii: ($) =>
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

        patch_read_strref: ($) => seq("READ_STRREF", field("offset", $._value), field("var", $.identifier)),

        patch_get_strref: getStrref("GET_STRREF", "GET_STRREF_S"),

        patch_lookup_ids_symbol_of_int: ($) =>
            seq(
                "LOOKUP_IDS_SYMBOL_OF_INT",
                field("target", $.identifier),
                field("ids_file", $._value),
                field("value", $._value)
            ),

        // String operations
        patch_say: ($) =>
            seq(choice("SAY", "SAY_EVALUATED"), field("offset", $._value), field("text", $._value)),

        patch_sprint: sprintOp("SPRINT"),
        patch_text_sprint: sprintOp("TEXT_SPRINT"),

        patch_snprint: ($) =>
            seq("SNPRINT", field("length", $._value), field("var", $.identifier), field("value", $._value)),

        patch_sprintf: ($) =>
            prec.right(
                seq(
                    "SPRINTF",
                    field("var", $._value),
                    field("format", $._value),
                    optional(seq("(", repeat($._value), ")"))
                )
            ),

        patch_to_upper: caseConvert("TO_UPPER"),
        patch_to_lower: caseConvert("TO_LOWER"),

        patch_spaces: ($) => seq("SPACES", field("var", $.identifier), field("template", $._value)),
        patch_quote: ($) => seq("QUOTE", field("var", $.identifier), field("string", $._value)),
        patch_source_biff: ($) => seq("SOURCE_BIFF", field("var", $.identifier), field("filename", $._value)),

        // Assignment
        patch_set: ($) =>
            seq("SET", optional("EVAL"), field("var", $._assignable), $._assign_op, field("value", $._value)),

        patch_assignment: ($) =>
            prec(10, seq(field("var", $._assignable), $._assign_op, field("value", $._value))),

        patch_increment: ($) => seq("++", field("var", $._value)),
        patch_decrement: ($) => seq("--", field("var", $._value)),

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

        patch_for: forLoop("FOR", ($) => $._patch),
        patch_while: whileLoop("WHILE", ($) => $._patch),
        patch_php_each: phpEachLoop("PHP_EACH", "PATCH_PHP_EACH")(($) => $._patch),

        patch_for_each: ($) =>
            seq("PATCH_FOR_EACH", field("var", $._value), "IN", repeat1($._value), "BEGIN", repeat($._patch), "END"),

        // Text manipulation
        patch_replace: ($) =>
            seq("REPLACE", field("regexp", $._value), field("replacement", $._value), optional($.sound_ref)),

        sound_ref: ($) => seq("[", field("sound", $.identifier), "]"),

        patch_replace_textually: ($) =>
            prec.right(
                seq(
                    "REPLACE_TEXTUALLY",
                    optional($.search_flags),
                    field("regexp", $._value),
                    field("replacement", $._value),
                    optional(seq("(", field("count", $._value), ")"))
                )
            ),

        patch_replace_evaluate: ($) =>
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
        patch_evaluate_buffer: ($) => "EVALUATE_BUFFER",

        patch_insert_bytes: ($) =>
            seq("INSERT_BYTES", field("offset", $._value), field("length", $._value)),

        patch_delete_bytes: ($) =>
            seq("DELETE_BYTES", field("offset", $._value), field("length", $._value)),

        patch_append_file: ($) => seq("APPEND_FILE", field("file", $._value)),

        // 2DA operations
        patch_read_2da_entry: ($) =>
            seq(
                "READ_2DA_ENTRY",
                field("row", $._value),
                field("col", $._value),
                field("req_cols", $._value),
                field("var", $._value)
            ),

        patch_read_2da_entries_now: ($) =>
            seq("READ_2DA_ENTRIES_NOW", field("var", $._value), field("req_cols", $._value)),

        patch_read_2da_entry_former: ($) =>
            seq(
                "READ_2DA_ENTRY_FORMER",
                field("array", $._value),
                field("row", $._value),
                field("col", $._value),
                field("var", $._value)
            ),

        patch_set_2da_entry: ($) =>
            seq(
                "SET_2DA_ENTRY",
                field("row", $._value),
                field("col", $._value),
                field("req_cols", $._value),
                field("value", $._value)
            ),

        patch_set_2da_entry_later: ($) =>
            seq(
                "SET_2DA_ENTRY_LATER",
                field("array", $._value),
                field("row", $._value),
                field("col", $._value),
                field("value", $._value)
            ),

        patch_set_2da_entries_now: ($) =>
            seq("SET_2DA_ENTRIES_NOW", field("array", $._value), field("req_cols", $._value)),

        patch_count_2da_cols: ($) =>
            seq("COUNT_2DA_COLS", field("var", choice($.identifier, $.string))),

        patch_count_2da_rows: ($) =>
            seq("COUNT_2DA_ROWS", field("req_cols", $._value), field("var", choice($.identifier, $.string))),

        patch_count_regexp_instances: ($) =>
            seq(
                "COUNT_REGEXP_INSTANCES",
                optional("CASE_SENSITIVE"),
                optional("EXACT_MATCH"),
                field("pattern", $._value),
                field("var", $._value)
            ),

        patch_pretty_print_2da: ($) => "PRETTY_PRINT_2DA",

        patch_insert_2da_row: ($) =>
            seq("INSERT_2DA_ROW", field("row", $._value), field("req_cols", $._value), field("value", $._value)),

        patch_remove_2da_row: ($) =>
            seq("REMOVE_2DA_ROW", field("row", $._value), field("req_cols", $._value)),

        patch_get_offset_array: ($) =>
            prec.right(seq("GET_OFFSET_ARRAY", field("var", $.identifier), repeat1($._value))),

        patch_get_offset_array2: ($) =>
            prec.right(seq("GET_OFFSET_ARRAY2", field("var", $.identifier), repeat1($._value))),

        // Store/CRE item operations (using helpers)
        patch_remove_store_item: ($) =>
            seq("REMOVE_STORE_ITEM", repeat1(field("item", $._value))),

        patch_add_store_item: ($) =>
            seq("ADD_STORE_ITEM", optional($._opt_no_backup), repeat1(field("item", $._value))),

        patch_replace_cre_item: itemPatch("REPLACE_CRE_ITEM"),
        patch_remove_cre_item: itemPatch("REMOVE_CRE_ITEM"),
        patch_add_cre_item: itemPatch("ADD_CRE_ITEM"),

        patch_add_memorized_spell: ($) =>
            prec.right(
                seq(
                    "ADD_MEMORIZED_SPELL",
                    field("spell", $._value),
                    field("level", $._value),
                    field("type", $._value),
                    optional(seq("(", field("count", $._value), ")"))
                )
            ),

        patch_remove_memorized_spells: ($) => "REMOVE_MEMORIZED_SPELLS",
        patch_remove_known_spells: ($) => "REMOVE_KNOWN_SPELLS",
        patch_remove_cre_effects: ($) => "REMOVE_CRE_EFFECTS",

        patch_add_known_spell: ($) =>
            seq("ADD_KNOWN_SPELL", field("spell", $._value), field("level", $._value), field("type", $._value)),

        patch_remove_known_spell: ($) =>
            prec.right(seq("REMOVE_KNOWN_SPELL", repeat1(field("spell", $._value)))),

        patch_add_map_note: ($) =>
            seq(
                "ADD_MAP_NOTE",
                field("x", $._value),
                field("y", $._value),
                field("color", $._value),
                field("strref", $._value)
            ),

        patch_set_bg2_proficiency: ($) =>
            seq("SET_BG2_PROFICIENCY", field("proficiency", $._value), field("value", $._value)),

        // Functions
        patch_launch_function: ($) =>
            seq(
                choice("LAUNCH_PATCH_FUNCTION", "LPF"),
                field("name", choice($.identifier, $.string)),
                repeat($._func_call_param),
                "END"
            ),

        patch_launch_macro: ($) =>
            seq(choice("LAUNCH_PATCH_MACRO", "LPM"), field("name", choice($.identifier, $.string))),

        patch_replace_bcs_block: ($) =>
            prec.right(
                seq(
                    choice("REPLACE_BCS_BLOCK", "R_B_B"),
                    optional($._opt_case),
                    repeat1(field("file", $.string)),
                    optional(seq("ON_MISMATCH", repeat($._patch), "END"))
                )
            ),

        // Arrays
        patch_define_array: ($) =>
            seq("DEFINE_ARRAY", field("name", $._value), "BEGIN", repeat($._value), "END"),
        patch_define_associative_array: defineAssocArray("DEFINE_ASSOCIATIVE_ARRAY"),
        patch_clear_array: clearArray("CLEAR_ARRAY"),

        patch_sort_array_indices: ($) =>
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
        patch_compile_baf_to_bcs: ($) => "COMPILE_BAF_TO_BCS",
        patch_decompile_bcs_to_baf: ($) => "DECOMPILE_BCS_TO_BAF",
        patch_compile_d_to_dlg: ($) => "COMPILE_D_TO_DLG",
        patch_decompile_dlg_to_d: ($) => "DECOMPILE_DLG_TO_D",

        patch_decompile_and_patch: ($) => seq("DECOMPILE_AND_PATCH", "BEGIN", repeat($._patch), "END"),

        patch_decompress_replace_file: ($) =>
            seq(
                "DECOMPRESS_REPLACE_FILE",
                field("offset", $._value),
                field("compressed_size", $._value),
                field("uncompressed_size", $._value)
            ),

        patch_compress_replace_file: ($) =>
            seq(
                "COMPRESS_REPLACE_FILE",
                field("offset", $._value),
                field("uncompressed_size", $._value),
                field("level", $._value)
            ),

        patch_decompress_into_var: ($) =>
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
                $.action_copy,
                $.action_copy_existing,
                $.action_copy_existing_regexp,
                $.action_copy_large,
                $.action_copy_random,
                $.action_copy_all_gam_files,
                $.action_compile,
                $.action_create,
                $.action_extend_top,
                $.action_extend_bottom,
                $.action_append,
                $.action_append_col,
                $.action_append_outer,
                $.action_delete,
                $.action_move,
                $.action_mkdir,
                // Control flow
                $.action_if,
                $.action_match,
                $.action_try,
                $.outer_for,
                $.outer_while,
                $.action_for_each,
                $.action_php_each,
                // Variables
                $.action_outer_set,
                $.action_outer_sprint,
                $.action_outer_text_sprint,
                $.action_with_tra,
                $.action_outer_patch,
                $.action_outer_patch_save,
                $.action_outer_inner_patch,
                $.action_outer_inner_patch_save,
                // Includes
                $.action_include,
                // Functions/macros
                $.action_define_macro,
                $.action_define_patch_macro,
                $.action_define_function,
                $.action_define_patch_function,
                $.action_launch_macro,
                $.action_launch_function,
                // Arrays
                $.action_define_array,
                $.action_define_associative_array,
                $.action_clear_array,
                // String/tra
                $.action_string_set,
                $.action_load_tra,
                // Game data modification
                $.action_add_projectile,
                $.action_add_sectype,
                $.action_add_area_type,
                $.action_add_spell,
                $.action_add_kit,
                // System/execution
                $.action_at_now,
                $.action_at_interactive_exit,
                $.action_bash_for,
                $.action_decompress_biff,
                // Misc
                $.action_print,
                $.action_warn,
                $.action_fail,
                $.action_clear_memory,
                $.action_silent,
                $.action_verbose,
                $.action_to_upper,
                $.action_to_lower,
                $.action_get_strref,
                $.action_require_predicate,
                $.action_forbid_component,
                $.action_disable_from_key,
                $.action_random_seed,
                $.action_readln,
                $.inlined_file
            ),

        // File operations
        action_copy: ($) =>
            seq(
                "COPY",
                optional($._opt_no_backup),
                optional($._opt_glob),
                repeat1($.file_pair),
                optional($._patches),
                optional($._but_only)
            ),

        action_copy_existing: ($) =>
            seq(
                "COPY_EXISTING",
                optional($._opt_no_backup),
                repeat1($.file_pair),
                optional($._patches),
                optional($._but_only)
            ),

        action_copy_existing_regexp: ($) =>
            seq(
                "COPY_EXISTING_REGEXP",
                optional($._opt_no_backup),
                optional($._opt_glob),
                repeat1($.file_pair),
                optional($._patches),
                optional($._but_only)
            ),

        action_copy_large: ($) =>
            seq("COPY_LARGE", optional($._opt_no_backup), optional($._opt_glob), $.file_pair),

        action_copy_random: ($) =>
            seq("COPY_RANDOM", repeat1(seq("(", repeat1($._value), ")")), optional($._patches)),

        action_copy_all_gam_files: ($) => seq("COPY_ALL_GAM_FILES", optional($._patches)),

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

        action_compile: ($) =>
            prec.right(
                seq(
                    "COMPILE",
                    optional(choice("EVALUATE_BUFFER", "EVAL")),
                    repeat1(field("source", $._value)),
                    optional(choice("EVALUATE_BUFFER", "EVAL")),
                    optional(seq("USING", repeat1(field("tra", $._value))))
                )
            ),

        action_extend_top: extendAction("EXTEND_TOP"),
        action_extend_bottom: extendAction("EXTEND_BOTTOM"),

        action_append: appendAction("APPEND"),
        action_append_col: appendAction("APPEND_COL"),

        action_append_outer: ($) =>
            seq("APPEND_OUTER", field("file", $._value), field("text", $._value), optional("KEEP_CRLF")),

        action_delete: ($) =>
            prec.right(seq("DELETE", optional($._opt_no_backup), repeat1(field("file", $._value)))),

        action_move: ($) => seq("MOVE", field("from", $._value), field("to", $._value)),

        action_mkdir: ($) => seq("MKDIR", field("dir", $._value)),

        action_create: ($) =>
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
        action_outer_set: ($) =>
            seq(
                "OUTER_SET",
                choice(
                    seq(field("var", $._assignable), $._assign_op, field("value", $._value)),
                    seq(choice("++", "--"), field("var", $._assignable))
                )
            ),

        action_outer_sprint: sprintOp("OUTER_SPRINT"),
        action_outer_text_sprint: sprintOp("OUTER_TEXT_SPRINT"),

        action_with_tra: ($) =>
            seq("WITH_TRA", repeat1(field("file", $._value)), "BEGIN", repeat($._action), "END"),

        action_outer_patch: outerPatchAction("OUTER_PATCH"),
        action_outer_patch_save: outerPatchSaveAction("OUTER_PATCH_SAVE"),
        action_outer_inner_patch: outerPatchAction("OUTER_INNER_PATCH"),
        action_outer_inner_patch_save: outerPatchSaveAction("OUTER_INNER_PATCH_SAVE"),

        // Includes
        action_include: ($) => seq("INCLUDE", field("file", $._value)),

        // Functions/macros definitions (using helpers)
        action_define_macro: defineMacro("DEFINE_ACTION_MACRO", ($) => $._action),
        action_define_patch_macro: defineMacro("DEFINE_PATCH_MACRO", ($) => $._patch),
        action_define_function: defineFunction("DEFINE_ACTION_FUNCTION", ($) => $._action),
        action_define_patch_function: defineFunction("DEFINE_PATCH_FUNCTION", ($) => $._patch),

        _func_decl_param: ($) => choice($.int_var_decl, $.str_var_decl, $.ret_decl, $.ret_array_decl),

        int_var_decl: ($) =>
            seq("INT_VAR", repeat(seq(choice($.identifier, $.string), optional(seq("=", $._value))))),

        str_var_decl: ($) =>
            seq("STR_VAR", repeat(seq(choice($.identifier, $.string), optional(seq("=", $._value))))),

        ret_decl: ($) => seq("RET", repeat1($.identifier)),
        ret_array_decl: ($) => seq("RET_ARRAY", repeat1($.identifier)),

        // Function/macro calls
        action_launch_macro: ($) =>
            seq(choice("LAUNCH_ACTION_MACRO", "LAM"), field("name", choice($.identifier, $.string))),

        action_launch_function: ($) =>
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
        action_string_set: ($) =>
            prec.right(
                seq(
                    choice("STRING_SET", "STRING_SET_EVALUATE"),
                    repeat1(seq(field("strref", $._value), field("value", $._value)))
                )
            ),

        action_load_tra: ($) => prec.right(seq("LOAD_TRA", repeat1(field("file", $._value)))),

        // Game data modification
        action_add_sectype: ($) => seq("ADD_SECTYPE", field("name", $._value), field("label", $._value)),

        action_add_area_type: ($) => seq("ADD_AREA_TYPE", field("name", $._value)),

        action_add_spell: ($) =>
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

        action_add_kit: ($) => prec.right(seq("ADD_KIT", repeat1(choice($._value, $.kit_say)))),

        kit_say: ($) => seq("SAY", $._value),

        action_add_projectile: ($) => seq("ADD_PROJECTILE", field("file", $._value)),

        // System/execution
        action_at_now: ($) =>
            seq("AT_NOW", optional(field("var", $.identifier)), field("command", $._value), optional("EXACT")),

        action_at_interactive_exit: ($) => seq("AT_INTERACTIVE_EXIT", field("command", $._value)),

        action_bash_for: ($) =>
            seq(
                "ACTION_BASH_FOR",
                field("directory", $._value),
                field("pattern", $._value),
                "BEGIN",
                repeat($._action),
                "END"
            ),

        action_decompress_biff: ($) => seq("DECOMPRESS_BIFF", field("file", $._value)),

        // Print/messaging (using helpers)
        action_print: printOp("PRINT"),
        action_warn: printOp("WARN"),
        action_fail: printOp("FAIL"),

        action_clear_memory: ($) =>
            choice(
                "CLEAR_MEMORY",
                "CLEAR_ARRAYS",
                "CLEAR_CODES",
                "CLEAR_INLINED",
                "CLEAR_EVERYTHING",
                "CLEAR_IDS_MAP"
            ),

        action_random_seed: ($) => seq("RANDOM_SEED", $._value),

        action_readln: ($) => seq("ACTION_READLN", $._value),

        action_silent: ($) => "SILENT",
        action_verbose: ($) => "VERBOSE",

        // Case conversion (using helpers)
        action_to_upper: caseConvert("ACTION_TO_UPPER"),
        action_to_lower: caseConvert("ACTION_TO_LOWER"),

        action_get_strref: ($) =>
            seq("ACTION_GET_STRREF", field("strref", $._value), field("var", $.identifier)),

        action_require_predicate: ($) =>
            prec(10, seq("REQUIRE_PREDICATE", field("predicate", $._value), field("message", $._value))),

        action_forbid_component: ($) =>
            prec(
                10,
                seq(
                    "FORBID_COMPONENT",
                    field("file", $._value),
                    field("component", $._value),
                    field("message", $._value)
                )
            ),

        action_disable_from_key: ($) =>
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
