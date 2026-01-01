/**
 * @file Fallout 2 Star-Trek Scripting Language
 * @author BGforge <dev@bgforge.net>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "ssl",

  extras: ($) => [/\s/, $.comment, $.line_comment],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => repeat($._top_level),

    _top_level: ($) =>
      choice(
        $.preprocessor,
        $.procedure_forward,
        $.procedure,
        $.variable_decl,
        $.export_decl
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
        seq(optional("import"), "variable", commaSep($.var_init), ";"),
        seq("variable", "begin", repeat(seq($.var_init, ";")), "end")
      ),

    var_init: ($) =>
      seq(field("name", $.identifier), optional(seq(choice(":=", "="), field("value", $._expression)))),

    // Export: export variable name;
    export_decl: ($) =>
      seq("export", "variable", field("name", $.identifier), ";"),

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
        $.call_stmt,
        $.assignment,
        $.expression_stmt
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

    foreach_stmt: ($) =>
      seq(
        "foreach",
        choice(
          // foreach var in expr
          seq(field("var", $.identifier), "in"),
          // foreach (var in expr) or foreach (k: v in expr)
          seq("(", optional("variable"), field("key", $.identifier), optional(seq(":", field("value", $.identifier))), "in")
        ),
        field("iter", $._expression),
        optional(")"),
        field("body", $._stmt_or_block)
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

    // call procedure_name; or call func(args);
    call_stmt: ($) =>
      seq("call", choice(
        field("target", $.identifier),
        field("target", $.call_expr)
      ), ";"),

    assignment: ($) =>
      seq(field("left", choice($.identifier, $.subscript_expr)), choice(":=", "=", "+=", "-=", "*=", "/="), field("right", $._expression), ";"),

    expression_stmt: ($) => seq($._expression, optional(";")),

    _stmt_or_block: ($) => choice($._statement, $.block),

    block: ($) => seq(/[Bb]egin/, repeat($._statement), /[Ee]nd/),

    // Expressions
    _expression: ($) =>
      choice(
        $.binary_expr,
        $.unary_expr,
        $.call_expr,
        $.subscript_expr,
        $.paren_expr,
        $.array_expr,
        $.map_expr,
        $.proc_ref,
        $.identifier,
        $.number,
        $.boolean,
        $.string
      ),

    // Procedure reference: @procedure_name
    proc_ref: ($) => seq("@", $.identifier),

    // Array/map subscript access: arr[index]
    subscript_expr: ($) =>
      prec(11, seq(field("object", $.identifier), "[", field("index", $._expression), "]")),

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
          [/[Oo][Rr]/, 1],
          [/[Aa][Nn][Dd]/, 2],
          [/[Bb][Ww][Oo][Rr]/, 3],
          [/[Bb][Ww][Xx][Oo][Rr]/, 4],
          [/[Bb][Ww][Aa][Nn][Dd]/, 5],
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
        ].map(([op, p]) =>
          prec.left(p, seq(field("left", $._expression), field("op", op), field("right", $._expression)))
        )
      ),

    unary_expr: ($) =>
      choice(
        prec(10, seq(field("op", choice(/[Nn][Oo][Tt]/, /[Bb][Nn][Oo][Tt]/, "-")), field("expr", $._expression))),
        // Pre-increment/decrement
        prec(10, seq(field("op", choice("++", "--")), field("expr", $.identifier))),
        // Post-increment/decrement
        prec(10, seq(field("expr", $.identifier), field("op", choice("++", "--"))))
      ),

    call_expr: ($) =>
      prec(11, seq(field("func", $.identifier), "(", field("args", optional(commaSep($._expression))), ")")),

    paren_expr: ($) => seq("(", $._expression, ")"),

    // Terminals
    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    number: ($) => token(choice(/\d+\.\d+/, /\d+/, /0x[0-9a-fA-F]+/)),

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
