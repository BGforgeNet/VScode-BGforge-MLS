/**
 * Tree-sitter grammar for WeiDU D (dialog) files.
 * Subset: BEGIN, APPEND, EXTEND_TOP, EXTEND_BOTTOM, states, transitions.
 */

export default grammar({
    name: "weidu_d",

    extras: ($) => [/\s/, $.comment, $.line_comment],

    conflicts: ($) => [
        [$.macro_expansion, $._state_label],
        [$.macro_expansion, $._filename],
    ],

    rules: {
        source_file: ($) => repeat($._d_action),

        _d_action: ($) =>
            choice(
                $.begin_action,
                $.append_action,
                $.extend_action,
                $.chain_action,
                $.interject_action,
                $.interject_copy_trans,
                $.replace_action,
                $.replace_action_text,
                $.replace_action_text_regexp,
                $.replace_action_text_process,
                $.alter_trans,
                $.replace_trans_trigger,
                $.replace_trans_action,
                $.replace_trigger_text,
                $.replace_trigger_text_regexp,
                $.replace_state_trigger,
                $.replace_say,
                $.set_weight,
                $.add_state_trigger,
                $.add_trans_trigger,
                $.add_trans_action
            ),

        // BEGIN filename [nonPausing] state list
        begin_action: ($) =>
            seq(
                "BEGIN",
                field("file", $._filename),
                optional(field("non_pausing", $.number)),
                repeat($.state)
            ),

        // APPEND [IF_FILE_EXISTS] filename state list END
        append_action: ($) =>
            seq(
                choice("APPEND", "APPEND_EARLY"),
                optional("IF_FILE_EXISTS"),
                field("file", $._filename),
                repeat($.state),
"END"
            ),

        // EXTEND_TOP/EXTEND_BOTTOM filename stateLabel list [#positionNumber] transition list END
        extend_action: ($) =>
            seq(
                choice("EXTEND_TOP", "EXTEND_BOTTOM"),
                field("file", $._filename),
                field("states", repeat1($._state_label)),
                optional(seq("#", $.number)),
                repeat($.transition),
"END"
            ),

        // CHAIN [IF [WEIGHT #weight] trigger THEN] [IF_FILE_EXISTS] entryFile entryLabel chainText chainEpilogue
        chain_action: ($) =>
            seq(
                "CHAIN",
                optional(
                    seq(
                        "IF",
                        optional(seq("WEIGHT", $._weight_value)),
                        field("trigger", $.string),
                        optional("THEN")
                    )
                ),
                optional("IF_FILE_EXISTS"),
                field("file", $._filename),
                field("label", $._state_label),
                repeat($.chain_text),
                $.chain_epilogue
            ),

        // INTERJECT entryFile entryLabel globalVar chain_speaker* chainEpilogue
        interject_action: ($) =>
            seq(
                "INTERJECT",
                field("file", $._filename),
                field("label", $._state_label),
                field("global_var", $.identifier),
                repeat($.chain_speaker),
                $.chain_epilogue
            ),

        // INTERJECT_COPY_TRANS[2-4] [SAFE] entryFile entryLabel globalVar chain_speaker* chainEpilogue
        interject_copy_trans: ($) =>
            seq(
                choice(
                    "INTERJECT_COPY_TRANS",
                    "INTERJECT_COPY_TRANS2",
                    "INTERJECT_COPY_TRANS3",
                    "INTERJECT_COPY_TRANS4"
                ),
                optional("SAFE"),
                field("file", $._filename),
                field("label", $._state_label),
                field("global_var", $.identifier),
                repeat($.chain_speaker),
                $.chain_epilogue
            ),

        // chainText: [IF trigger THEN] sayText [== ... | BRANCH ...]
        chain_text: ($) =>
            seq(
                optional($._if_trigger_then),
                $.say_text,
                optional($.do_feature),
                repeat(choice($.chain_speaker, $.chain_branch))
            ),

        // == [IF_FILE_EXISTS] fileName [IF trigger [THEN]] sayText [DO action]
        chain_speaker: ($) =>
            seq(
                "==",
                optional("IF_FILE_EXISTS"),
                field("file", $._filename),
                optional($._if_trigger_then),
                $.say_text,
                optional($.do_feature)
            ),

        // BRANCH trigger BEGIN [== fileName [IF trigger THEN] sayText ...] END
        chain_branch: ($) =>
            seq(
                "BRANCH",
                field("trigger", $.string),
                "BEGIN",
                repeat($.chain_speaker),
"END"
            ),

        // chainEpilogue: END file state | EXTERN file state | COPY_TRANS file state | EXIT | END transitions
        chain_epilogue: ($) =>
            choice(
                seq("END", $._filename, $._state_label),
                seq("EXTERN", $._filename, $._state_label),
                seq(
                    choice("COPY_TRANS", "COPY_TRANS_LATE"),
                    optional("SAFE"),
                    $._filename,
                    $._state_label
                ),
                "EXIT",
                seq("END", repeat($.transition))
            ),

        // REPLACE filename state list END
        replace_action: ($) =>
            seq(
                "REPLACE",
                field("file", $._filename),
                repeat($.state),
"END"
            ),

        // REPLACE_ACTION_TEXT filename oldText newText [moreFilenames] [dActionWhen]
        replace_action_text: ($) =>
            seq(
                "REPLACE_ACTION_TEXT",
                field("file", $._filename),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($._filename),
                repeat($.d_action_when)
            ),

        // REPLACE_ACTION_TEXT_REGEXP filenameRegexp oldText newText [moreFilenameRegexps] [dActionWhen]
        replace_action_text_regexp: ($) =>
            seq(
                "REPLACE_ACTION_TEXT_REGEXP",
                field("file", $.string),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.string),
                repeat($.d_action_when)
            ),

        // REPLACE_ACTION_TEXT_PROCESS / R_A_T_P_R filename oldText newText [moreFilenames] [dActionWhen]
        replace_action_text_process: ($) =>
            seq(
                choice(
                    "REPLACE_ACTION_TEXT_PROCESS",
                    "REPLACE_ACTION_TEXT_PROCESS_REGEXP",
                    "R_A_T_P_R"
                ),
                field("file", $._filename),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($._filename),
                repeat($.d_action_when)
            ),

        // ALTER_TRANS filename BEGIN stateNumber list END BEGIN transNumber list END BEGIN changes END
        alter_trans: ($) =>
            seq(
                "ALTER_TRANS",
                field("file", $._filename),
                $._state_label_list,
                $._trans_number_list,
                "BEGIN",
                repeat($.alter_trans_change),
"END"
            ),

        alter_trans_change: ($) =>
            seq($.double_string, $.string),

        // REPLACE_TRANS_TRIGGER filename BEGIN states END BEGIN trans END oldText newText [dActionWhen]
        replace_trans_trigger: ($) =>
            seq(
                "REPLACE_TRANS_TRIGGER",
                field("file", $._filename),
                $._state_label_list,
                $._trans_number_list,
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_TRANS_ACTION filename BEGIN states END BEGIN trans END oldText newText [dActionWhen]
        replace_trans_action: ($) =>
            seq(
                "REPLACE_TRANS_ACTION",
                field("file", $._filename),
                $._state_label_list,
                $._trans_number_list,
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_TRIGGER_TEXT filename oldText newText [dActionWhen]
        replace_trigger_text: ($) =>
            seq(
                "REPLACE_TRIGGER_TEXT",
                field("file", $._filename),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_TRIGGER_TEXT_REGEXP filenameRegexp oldText newText [dActionWhen]
        replace_trigger_text_regexp: ($) =>
            seq(
                "REPLACE_TRIGGER_TEXT_REGEXP",
                field("file", $.string),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_STATE_TRIGGER filename stateNumber triggerString [moreStateNumbers] [dActionWhen]
        replace_state_trigger: ($) =>
            seq(
                "REPLACE_STATE_TRIGGER",
                field("file", $._filename),
                field("state", $._state_label),
                field("trigger", $.string),
                repeat($._state_label),
                repeat($.d_action_when)
            ),

        // REPLACE_SAY filename stateLabel sayText
        replace_say: ($) =>
            seq(
                "REPLACE_SAY",
                field("file", $._filename),
                field("state", $._state_label),
                field("text", $._text)
            ),

        // SET_WEIGHT filename stateLabel #stateWeight
        set_weight: ($) =>
            seq(
                "SET_WEIGHT",
                field("file", $._filename),
                field("state", $._state_label),
                field("weight", $._weight_value)
            ),

        // ADD_STATE_TRIGGER filename stateN [dActionWhen] triggerString
        add_state_trigger: ($) =>
            seq(
                "ADD_STATE_TRIGGER",
                field("file", $._filename),
                field("state", $._state_label),
                optional($.d_action_when),
                field("trigger", $.string)
            ),

        // ADD_TRANS_TRIGGER filename stateN triggerString [moreStates] [DO transNumbers] [dActionWhen]
        add_trans_trigger: ($) =>
            seq(
                "ADD_TRANS_TRIGGER",
                field("file", $._filename),
                field("state", $._state_label),
                field("trigger", $.string),
                repeat($._state_label),
                optional(seq("DO", repeat1($.number))),
                repeat($.d_action_when)
            ),

        // ADD_TRANS_ACTION filename BEGIN states END BEGIN trans END [dActionWhen] actionString
        add_trans_action: ($) =>
            seq(
                "ADD_TRANS_ACTION",
                field("file", $._filename),
                $._state_label_list,
                $._trans_number_list,
                optional($.d_action_when),
                field("action", $.string)
            ),

        // dActionWhen - conditional for D actions
        d_action_when: ($) =>
            choice(
                seq("IF", field("condition", $.string)),
                seq("UNLESS", field("condition", $.string))
            ),

        // IF [WEIGHT #n] ~trigger~ [THEN] [BEGIN] label SAY text [= text...] transitions END
        state: ($) =>
            seq(
                "IF",
                optional(seq("WEIGHT", field("weight", $._weight_value))),
                field("trigger", $.string),
                optional("THEN"),
                optional("BEGIN"),
                field("label", $._state_label),
                "SAY",
                field("say", $.say_text),
                repeat($.transition),
"END"
            ),

        // SAY text [= text ...]
        say_text: ($) => seq($._text, repeat(seq("=", $._text))),

        // Transitions
        transition: ($) =>
            choice(
                $.transition_full,
                $.transition_short,
                $.copy_trans,
                $.macro_expansion
            ),

        // WeiDU macro expansion (bare %var% in transition position)
        macro_expansion: ($) => $.variable_ref,

        // IF ~trigger~ [THEN] transFeatures transNext
        transition_full: ($) =>
            seq(
                "IF",
                field("trigger", $.string),
                optional("THEN"),
                repeat($._trans_feature),
                $._trans_next
            ),

        // + [~trigger~] + replyText transFeatures transNext
        // Also handles ++ form (no trigger)
        transition_short: ($) =>
            seq(
                "+",
                optional(field("trigger", $.string)),
                "+",
                field("reply", $._text),
                repeat($._trans_feature),
                $._trans_next
            ),

        // COPY_TRANS [SAFE] filename stateLabel
        copy_trans: ($) =>
            seq(
                choice("COPY_TRANS", "COPY_TRANS_LATE"),
                optional("SAFE"),
                field("file", $._filename),
                field("state", $._state_label)
            ),

        // Transaction features
        _trans_feature: ($) =>
            choice(
                $.reply_feature,
                $.do_feature,
                $.journal_feature,
                $.flags_feature
            ),

        reply_feature: ($) => seq("REPLY", field("text", $._text)),

        do_feature: ($) => seq("DO", field("action", $.string)),

        journal_feature: ($) =>
            seq(
                choice(
                    "JOURNAL",
                    "SOLVED_JOURNAL",
"UNSOLVED_JOURNAL"
                ),
                field("text", $._text)
            ),

        flags_feature: ($) => seq("FLAGS", $.number),

        // Transaction next (where to go)
        _trans_next: ($) =>
            choice(
                $.goto_next,
                $.extern_next,
                $.exit_next,
                $.short_goto
            ),

        goto_next: ($) => seq("GOTO", field("label", $._state_label)),

        extern_next: ($) =>
            seq(
                "EXTERN",
                optional("IF_FILE_EXISTS"),
                field("file", $._filename),
                field("label", $._state_label)
            ),

        exit_next: ($) => "EXIT",

        // + stateLabel (shorthand for GOTO)
        short_goto: ($) => seq("+", field("label", $._state_label)),

        // Filename can be identifier, string, or variable ref
        _filename: ($) => choice($.identifier, $.string, $.variable_ref),

        // State label can be number, identifier, alphanumeric (like 4a), or variable ref
        _state_label: ($) => choice($.state_label_alnum, $.identifier, $.variable_ref),

        // Alphanumeric state label (can start with digit, like "4a", "100", "foo")
        state_label_alnum: ($) => /[A-Za-z0-9_]+/,

        // Weight value: #[-]number
        _weight_value: ($) => seq("#", optional("-"), $.number),

        // BEGIN...END state label list
        _state_label_list: ($) => seq("BEGIN", repeat($._state_label), "END"),

        // BEGIN...END transaction number list
        _trans_number_list: ($) => seq("BEGIN", repeat($.number), "END"),

        // IF trigger [THEN] pattern
        _if_trigger_then: ($) => seq("IF", field("trigger", $.string), optional("THEN")),

        // Text types
        _text: ($) =>
            choice(
                $.string,
                $.tra_ref,
                $.tlk_ref,
                $.at_var_ref
            ),

        // String literals
        // Supported: ~text~, "text"
        // Not supported:
        //   - %text% : conflicts with variable_ref (%name%), would need GLR
        //   - ~~~~~text~~~~~ : tree-sitter regex doesn't support lookahead
        //   - String ^ String : concatenation, rarely used
        string: ($) =>
            choice(
                $.tilde_string,
                $.double_string
            ),

        tilde_string: ($) => seq("~", optional($.tilde_content), "~"),
        tilde_content: ($) => /[^~]+/,

        double_string: ($) => seq('"', optional($.double_content), '"'),
        double_content: ($) => /[^"]+/,

        // References
        tra_ref: ($) => token(seq("@", /[0-9]+/)),
        tlk_ref: ($) => token(seq("#", /[0-9]+/)),
        at_var_ref: ($) => seq("(", "AT", $.double_string, ")"),

        // WeiDU variable reference %name%
        variable_ref: ($) => token(seq("%", /[A-Za-z_][A-Za-z0-9_]*/, "%")),

        // Basic tokens
        identifier: ($) => /[A-Za-z_][A-Za-z0-9_]*/,
        number: ($) => /[0-9]+/,

        // Comments
        comment: ($) => seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
        line_comment: ($) => seq("//", /[^\n]*/),
    },
});
