/**
 * @file Fallout 2 Star-Trek Scripting Language
 * @author BGforge <dev@bgforge.net>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "ssl",

  extras: ($) => [
    /\s/,
    $.comment,
    $.line_comment,
    /\\\r?\n/,  // Line continuation with backslash
  ],

  word: ($) => $.identifier,

  // Conflicts arise from ambiguous parsing situations:
  // - var_init: `variable a = 1` could be parsed with `=` as assignment or initialization
  conflicts: ($) => [
    [$.var_init],
  ],

  rules: {
    source_file: ($) => repeat($._top_level),

    _top_level: ($) =>
      choice(
        $.preprocessor,
        $.procedure_forward,
        $.procedure,
        $.variable_decl,
        $.export_decl,
        $.macro_call_stmt  // Top-level macro invocation
      ),

    // Preprocessor: #define, #include, etc. (handles \ line continuation and multi-line comments)
    preprocessor: ($) =>
      token(seq(
        "#",
        /[a-zA-Z_][a-zA-Z0-9_]*/,  // directive name
        optional(seq("(", /[^)]*/, ")")),  // optional macro params
        // macro body: handles line continuation, multi-line comments
        repeat(choice(
          /[^\n\\\/]+/,           // regular chars
          /\\./,                  // escaped char
          /\\\r?\n/,              // line continuation
          /\/\*[^*]*\*+([^/*][^*]*\*+)*\//, // multi-line comment
          /\/\/[^\n]*/,           // line comment
          /\/[^*\/\n]/,           // single slash
        ))
      )),

    // Forward declaration: procedure name; or procedure name(params);
    procedure_forward: ($) =>
      seq(/[Pp]rocedure/, field("name", $.identifier), optional(field("params", $.param_list)), ";"),

    // Procedure definition: procedure name begin ... end
    procedure: ($) =>
      seq(
        /[Pp]rocedure/,
        field("name", $.identifier),
        optional(field("params", $.param_list)),
        /[Bb]egin/,
        field("body", repeat($._statement)),
        /[Ee]nd/
      ),

    param_list: ($) =>
      seq("(", optional(commaSep($.param)), ")"),

    param: ($) =>
      seq(optional("variable"), field("name", $.identifier), optional(seq("=", field("default", $._expression)))),

    // Variable: variable name; or variable name := expr; or variable a = 1, b = 2;
    variable_decl: ($) =>
      choice(
        seq(optional("import"), "variable", commaSep($.var_init), optional(";")),
        seq("variable", "begin", repeat(seq($.var_init, ";")), "end")
      ),

    var_init: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq("[", field("size", $._expression), "]")),  // static array: variable a[10]
        optional(seq(choice(":=", "="), field("value", $._expression)))
      ),

    // Export: export variable name := value; (with optional init and optional semicolon)
    export_decl: ($) =>
      seq("export", "variable", field("name", $.identifier),
          optional(seq(choice(":=", "="), field("value", $._expression))),
          optional(";")),

    // Statements
    _statement: ($) =>
      choice(
        $.preprocessor,
        $.variable_decl,
        $.if_stmt,
        $.while_stmt,
        $.for_stmt,
        $.foreach_stmt,
        $.switch_stmt,
        $.return_stmt,
        $.break_stmt,
        $.continue_stmt,
        $.call_stmt,
        $.assignment,
        $.expression_stmt  // Covers function calls, macro calls, bare identifiers
      ),

    if_stmt: ($) =>
      prec.right(
        seq(
          "if",
          field("cond", $._expression),
          "then",
          field("then", $._stmt_or_block),
          optional(seq("else", field("else", $._stmt_or_block)))
        )
      ),

    while_stmt: ($) =>
      seq("while", field("cond", $._expression), "do", field("body", $._stmt_or_block)),

    for_stmt: ($) =>
      seq(
        "for",
        "(",
        field("init", optional(choice($.for_var_decl, $._expression))),
        ";",
        field("cond", optional($._expression)),
        ";",
        field("update", optional($._expression)),
        ")",
        field("body", $._stmt_or_block)
      ),

    // Variable declaration in for loop init: variable i = 0
    for_var_decl: ($) =>
      seq("variable", field("name", $.identifier), choice(":=", "="), $._expression),

    // foreach has two forms:
    // - foreach var in expr body
    // - foreach (var in expr) body  or  foreach (k: v in expr) body
    // The parenthesized form can have optional "while condition" before closing paren.
    foreach_stmt: ($) =>
      seq(
        "foreach",
        choice(
          // foreach var in expr body (no parens)
          seq(
            field("var", $.identifier),
            "in",
            field("iter", $._expression),
            field("body", $._stmt_or_block)
          ),
          // foreach (var in expr) body or foreach (k: v in expr while cond) body
          seq(
            "(",
            optional("variable"),
            field("key", $.identifier),
            optional(seq(":", field("value", $.identifier))),
            "in",
            field("iter", $._expression),
            optional(seq("while", field("while_cond", $._expression))),
            ")",
            field("body", $._stmt_or_block)
          )
        )
      ),

    switch_stmt: ($) =>
      seq(
        "switch",
        field("value", $._expression),
        "begin",
        repeat($.case_clause),
        optional($.default_clause),
        "end"
      ),

    case_clause: ($) =>
      seq("case", field("value", $._expression), ":", repeat($._statement)),

    default_clause: ($) =>
      seq("default", ":", repeat($._statement)),

    return_stmt: ($) => seq("return", optional($._expression), ";"),

    break_stmt: ($) => seq("break", ";"),

    continue_stmt: ($) => seq("continue", ";"),

    // call procedure_name; or call func(args); or call proc in ticks;
    call_stmt: ($) =>
      seq("call", choice(
        field("target", $.identifier),
        field("target", $.call_expr)
      ), optional(seq("in", field("delay", $._expression))), ";"),

    // Macro invocation at top-level (outside procedures).
    // Preprocessor macros can appear anywhere in SSL code:
    // - At top-level: handled by macro_call_stmt
    // - Inside procedures: handled by expression_stmt (via identifier or call_expr)
    // - Inside expressions: handled by identifier or call_expr
    // This rule is only needed for top-level since expression_stmt isn't in _top_level.
    macro_call_stmt: ($) =>
      prec.right(seq(
        choice(
          seq(field("name", $.identifier), "(", optional(commaSep($._expression)), ")"),
          field("name", $.identifier)  // Bare macro without parens
        ),
        optional(";")
      )),

    assignment: ($) =>
      seq(field("left", choice($.identifier, $.subscript_expr, $.member_expr)), choice(":=", "=", "+=", "-=", "*=", "/="), field("right", $._expression), ";"),

    expression_stmt: ($) => seq($._expression, optional(";")),

    _stmt_or_block: ($) => choice($._statement, $.block),

    block: ($) => seq(/[Bb]egin/, repeat($._statement), /[Ee]nd/),

    // Expressions
    _expression: ($) =>
      choice(
        $.ternary_expr,
        $.binary_expr,
        $.unary_expr,
        $.call_expr,
        $.subscript_expr,
        $.member_expr,
        $.paren_expr,
        $.array_expr,
        $.map_expr,
        $.proc_ref,
        $.identifier,
        $.number,
        $.boolean,
        $.string
      ),

    // Ternary expression: value_if_true if condition else value_if_false
    ternary_expr: ($) =>
      prec.right(-1, seq(
        field("true_value", $._expression),
        "if",
        field("cond", $._expression),
        "else",
        field("false_value", $._expression)
      )),

    // Procedure reference: @procedure_name
    proc_ref: ($) => seq("@", $.identifier),

    // Array/map subscript access: arr[index]
    subscript_expr: ($) =>
      prec(12, seq(field("object", choice($.identifier, $.subscript_expr, $.member_expr)), "[", field("index", $._expression), "]")),

    // Dot notation member access: obj.field
    member_expr: ($) =>
      prec(12, seq(field("object", choice($.identifier, $.subscript_expr, $.member_expr)), ".", field("member", $.identifier))),

    // sfall array literal: [1, 2, 3]
    array_expr: ($) =>
      seq("[", optional(commaSep($._expression)), "]"),

    // sfall map literal: {"key": value, ...}
    map_expr: ($) =>
      seq("{", optional(commaSep($.map_entry)), "}"),

    map_entry: ($) =>
      seq(field("key", choice($.string, $.number, $.identifier)), ":", field("value", $._expression)),

    binary_expr: ($) =>
      choice(
        ...[
          [alias(/[Oo][Rr]/, "or"), 1],
          [alias(/[Oo][Rr][Ee][Ll][Ss][Ee]/, "orelse"), 1],  // short-circuit or
          [alias(/[Aa][Nn][Dd]/, "and"), 2],
          [alias(/[Aa][Nn][Dd][Aa][Ll][Ss][Oo]/, "andalso"), 2],  // short-circuit and
          [alias(/[Bb][Ww][Oo][Rr]/, "bwor"), 3],
          [alias(/[Bb][Ww][Xx][Oo][Rr]/, "bwxor"), 4],
          [alias(/[Bb][Ww][Aa][Nn][Dd]/, "bwand"), 5],
          ["==", 6],
          ["!=", 6],
          ["<", 7],
          [">", 7],
          ["<=", 7],
          [">=", 7],
          ["+", 8],
          ["-", 8],
          ["*", 9],
          ["/", 9],
          ["%", 9],
          ["^", 10],  // exponentiation
        ].map(([op, p]) =>
          prec.left(p, seq(field("left", $._expression), field("op", op), field("right", $._expression)))
        )
      ),

    unary_expr: ($) =>
      choice(
        prec(11, seq(field("op", choice(alias(/[Nn][Oo][Tt]/, "not"), alias(/[Bb][Nn][Oo][Tt]/, "bnot"), "-")), field("expr", $._expression))),
        // Pre-increment/decrement
        prec(11, seq(field("op", choice("++", "--")), field("expr", $.identifier))),
        // Post-increment/decrement
        prec(11, seq(field("expr", $.identifier), field("op", choice("++", "--"))))
      ),

    call_expr: ($) =>
      prec(12, seq(field("func", $.identifier), "(", field("args", optional(commaSep($._expression))), ")")),

    paren_expr: ($) => seq("(", $._expression, ")"),

    // Terminals
    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    number: ($) => token(choice(/\d+\.\d+/, /\.\d+/, /\d+/, /0x[0-9a-fA-F]+/)),

    boolean: ($) => choice("true", "false"),

    string: ($) => /"[^"]*"/,

    comment: ($) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),

    line_comment: ($) => token(seq("//", /[^\n]*/)),
  },
});

/**
 * Comma-separated list
 */
function commaSep(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
