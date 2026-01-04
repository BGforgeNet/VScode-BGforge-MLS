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
                caseInsensitive("BEGIN"),
                field("file", $._filename),
                optional(field("non_pausing", $.number)),
                repeat($.state)
            ),

        // APPEND [IF_FILE_EXISTS] filename state list END
        append_action: ($) =>
            seq(
                choice(caseInsensitive("APPEND"), caseInsensitive("APPEND_EARLY")),
                optional(caseInsensitive("IF_FILE_EXISTS")),
                field("file", $._filename),
                repeat($.state),
                caseInsensitive("END")
            ),

        // EXTEND_TOP/EXTEND_BOTTOM filename stateLabel list [#positionNumber] transition list END
        extend_action: ($) =>
            seq(
                choice(caseInsensitive("EXTEND_TOP"), caseInsensitive("EXTEND_BOTTOM")),
                field("file", $._filename),
                field("states", repeat1($._state_label)),
                optional(seq("#", $.number)),
                repeat($.transition),
                caseInsensitive("END")
            ),

        // CHAIN [IF [WEIGHT #weight] trigger THEN] [IF_FILE_EXISTS] entryFile entryLabel chainText chainEpilogue
        chain_action: ($) =>
            seq(
                caseInsensitive("CHAIN"),
                optional(
                    seq(
                        caseInsensitive("IF"),
                        optional(seq(caseInsensitive("WEIGHT"), "#", $.number)),
                        field("trigger", $.string),
                        caseInsensitive("THEN")
                    )
                ),
                optional(caseInsensitive("IF_FILE_EXISTS")),
                field("file", $._filename),
                field("label", $._state_label),
                repeat($.chain_text),
                $.chain_epilogue
            ),

        // INTERJECT entryFile entryLabel globalVar chainText chainEpilogue
        interject_action: ($) =>
            seq(
                caseInsensitive("INTERJECT"),
                field("file", $._filename),
                field("label", $._state_label),
                field("global_var", $.identifier),
                repeat($.chain_text),
                $.chain_epilogue
            ),

        // INTERJECT_COPY_TRANS[2-4] [SAFE] entryFile entryLabel globalVar chainText
        interject_copy_trans: ($) =>
            seq(
                choice(
                    caseInsensitive("INTERJECT_COPY_TRANS"),
                    caseInsensitive("INTERJECT_COPY_TRANS2"),
                    caseInsensitive("INTERJECT_COPY_TRANS3"),
                    caseInsensitive("INTERJECT_COPY_TRANS4")
                ),
                optional(caseInsensitive("SAFE")),
                field("file", $._filename),
                field("label", $._state_label),
                field("global_var", $.identifier),
                repeat($.chain_text)
            ),

        // chainText: [IF trigger THEN] sayText [== ... | BRANCH ...]
        chain_text: ($) =>
            seq(
                optional(seq(caseInsensitive("IF"), field("trigger", $.string), caseInsensitive("THEN"))),
                $.say_text,
                repeat(choice($.chain_speaker, $.chain_branch))
            ),

        // == [IF_FILE_EXISTS] fileName [IF trigger THEN] sayText
        chain_speaker: ($) =>
            seq(
                "==",
                optional(caseInsensitive("IF_FILE_EXISTS")),
                field("file", $._filename),
                optional(seq(caseInsensitive("IF"), field("trigger", $.string), caseInsensitive("THEN"))),
                $.say_text
            ),

        // BRANCH trigger BEGIN [== fileName [IF trigger THEN] sayText ...] END
        chain_branch: ($) =>
            seq(
                caseInsensitive("BRANCH"),
                field("trigger", $.string),
                caseInsensitive("BEGIN"),
                repeat($.chain_speaker),
                caseInsensitive("END")
            ),

        // chainEpilogue: END file state | EXTERN file state | COPY_TRANS file state | EXIT | END transitions
        chain_epilogue: ($) =>
            choice(
                seq(caseInsensitive("END"), $._filename, $._state_label),
                seq(caseInsensitive("EXTERN"), $._filename, $._state_label),
                seq(
                    choice(caseInsensitive("COPY_TRANS"), caseInsensitive("COPY_TRANS_LATE")),
                    optional(caseInsensitive("SAFE")),
                    $._filename,
                    $._state_label
                ),
                caseInsensitive("EXIT"),
                seq(caseInsensitive("END"), repeat($.transition))
            ),

        // REPLACE filename state list END
        replace_action: ($) =>
            seq(
                caseInsensitive("REPLACE"),
                field("file", $._filename),
                repeat($.state),
                caseInsensitive("END")
            ),

        // REPLACE_ACTION_TEXT filename oldText newText [moreFilenames] [dActionWhen]
        replace_action_text: ($) =>
            seq(
                caseInsensitive("REPLACE_ACTION_TEXT"),
                field("file", $._filename),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($._filename),
                repeat($.d_action_when)
            ),

        // REPLACE_ACTION_TEXT_REGEXP filenameRegexp oldText newText [moreFilenameRegexps] [dActionWhen]
        replace_action_text_regexp: ($) =>
            seq(
                caseInsensitive("REPLACE_ACTION_TEXT_REGEXP"),
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
                    caseInsensitive("REPLACE_ACTION_TEXT_PROCESS"),
                    caseInsensitive("REPLACE_ACTION_TEXT_PROCESS_REGEXP"),
                    caseInsensitive("R_A_T_P_R")
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
                caseInsensitive("ALTER_TRANS"),
                field("file", $._filename),
                caseInsensitive("BEGIN"),
                repeat($._state_label),
                caseInsensitive("END"),
                caseInsensitive("BEGIN"),
                repeat($.number),
                caseInsensitive("END"),
                caseInsensitive("BEGIN"),
                repeat($.alter_trans_change),
                caseInsensitive("END")
            ),

        alter_trans_change: ($) =>
            seq($.double_string, $.string),

        // REPLACE_TRANS_TRIGGER filename BEGIN states END BEGIN trans END oldText newText [dActionWhen]
        replace_trans_trigger: ($) =>
            seq(
                caseInsensitive("REPLACE_TRANS_TRIGGER"),
                field("file", $._filename),
                caseInsensitive("BEGIN"),
                repeat($._state_label),
                caseInsensitive("END"),
                caseInsensitive("BEGIN"),
                repeat($.number),
                caseInsensitive("END"),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_TRANS_ACTION filename BEGIN states END BEGIN trans END oldText newText [dActionWhen]
        replace_trans_action: ($) =>
            seq(
                caseInsensitive("REPLACE_TRANS_ACTION"),
                field("file", $._filename),
                caseInsensitive("BEGIN"),
                repeat($._state_label),
                caseInsensitive("END"),
                caseInsensitive("BEGIN"),
                repeat($.number),
                caseInsensitive("END"),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_TRIGGER_TEXT filename oldText newText [dActionWhen]
        replace_trigger_text: ($) =>
            seq(
                caseInsensitive("REPLACE_TRIGGER_TEXT"),
                field("file", $._filename),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_TRIGGER_TEXT_REGEXP filenameRegexp oldText newText [dActionWhen]
        replace_trigger_text_regexp: ($) =>
            seq(
                caseInsensitive("REPLACE_TRIGGER_TEXT_REGEXP"),
                field("file", $.string),
                field("old_text", $.string),
                field("new_text", $.string),
                repeat($.d_action_when)
            ),

        // REPLACE_STATE_TRIGGER filename stateNumber triggerString [moreStateNumbers] [dActionWhen]
        replace_state_trigger: ($) =>
            seq(
                caseInsensitive("REPLACE_STATE_TRIGGER"),
                field("file", $._filename),
                field("state", $._state_label),
                field("trigger", $.string),
                repeat($._state_label),
                repeat($.d_action_when)
            ),

        // REPLACE_SAY filename stateLabel sayText
        replace_say: ($) =>
            seq(
                caseInsensitive("REPLACE_SAY"),
                field("file", $._filename),
                field("state", $._state_label),
                field("text", $._text)
            ),

        // SET_WEIGHT filename stateLabel #stateWeight
        set_weight: ($) =>
            seq(
                caseInsensitive("SET_WEIGHT"),
                field("file", $._filename),
                field("state", $._state_label),
                "#",
                field("weight", $.number)
            ),

        // ADD_STATE_TRIGGER filename stateN [dActionWhen] triggerString
        add_state_trigger: ($) =>
            seq(
                caseInsensitive("ADD_STATE_TRIGGER"),
                field("file", $._filename),
                field("state", $._state_label),
                optional($.d_action_when),
                field("trigger", $.string)
            ),

        // ADD_TRANS_TRIGGER filename stateN triggerString [moreStates] [DO transNumbers] [dActionWhen]
        add_trans_trigger: ($) =>
            seq(
                caseInsensitive("ADD_TRANS_TRIGGER"),
                field("file", $._filename),
                field("state", $._state_label),
                field("trigger", $.string),
                repeat($._state_label),
                optional(seq(caseInsensitive("DO"), repeat1($.number))),
                repeat($.d_action_when)
            ),

        // ADD_TRANS_ACTION filename BEGIN states END BEGIN trans END [dActionWhen] actionString
        add_trans_action: ($) =>
            seq(
                caseInsensitive("ADD_TRANS_ACTION"),
                field("file", $._filename),
                caseInsensitive("BEGIN"),
                repeat($._state_label),
                caseInsensitive("END"),
                caseInsensitive("BEGIN"),
                repeat($.number),
                caseInsensitive("END"),
                optional($.d_action_when),
                field("action", $.string)
            ),

        // dActionWhen - conditional for D actions
        d_action_when: ($) =>
            choice(
                seq(caseInsensitive("IF"), field("condition", $.string)),
                seq(caseInsensitive("UNLESS"), field("condition", $.string))
            ),

        // IF [WEIGHT #n] ~trigger~ [THEN] [BEGIN] label SAY text [= text...] transitions END
        state: ($) =>
            seq(
                caseInsensitive("IF"),
                optional(seq(caseInsensitive("WEIGHT"), "#", field("weight", $.number))),
                field("trigger", $.string),
                optional(caseInsensitive("THEN")),
                optional(caseInsensitive("BEGIN")),
                field("label", $._state_label),
                caseInsensitive("SAY"),
                field("say", $.say_text),
                repeat($.transition),
                caseInsensitive("END")
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
                caseInsensitive("IF"),
                field("trigger", $.string),
                optional(caseInsensitive("THEN")),
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
                choice(caseInsensitive("COPY_TRANS"), caseInsensitive("COPY_TRANS_LATE")),
                optional(caseInsensitive("SAFE")),
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

        reply_feature: ($) => seq(caseInsensitive("REPLY"), field("text", $._text)),

        do_feature: ($) => seq(caseInsensitive("DO"), field("action", $.string)),

        journal_feature: ($) =>
            seq(
                choice(
                    caseInsensitive("JOURNAL"),
                    caseInsensitive("SOLVED_JOURNAL"),
                    caseInsensitive("UNSOLVED_JOURNAL")
                ),
                field("text", $._text)
            ),

        flags_feature: ($) => seq(caseInsensitive("FLAGS"), $.number),

        // Transaction next (where to go)
        _trans_next: ($) =>
            choice(
                $.goto_next,
                $.extern_next,
                $.exit_next,
                $.short_goto
            ),

        goto_next: ($) => seq(caseInsensitive("GOTO"), field("label", $._state_label)),

        extern_next: ($) =>
            seq(
                caseInsensitive("EXTERN"),
                optional(caseInsensitive("IF_FILE_EXISTS")),
                field("file", $._filename),
                field("label", $._state_label)
            ),

        exit_next: ($) => caseInsensitive("EXIT"),

        // + stateLabel (shorthand for GOTO)
        short_goto: ($) => seq("+", field("label", $._state_label)),

        // Filename can be identifier, string, or variable ref
        _filename: ($) => choice($.identifier, $.string, $.variable_ref),

        // State label can be number, identifier, alphanumeric (like 4a), or variable ref
        _state_label: ($) => choice($.state_label_alnum, $.identifier, $.variable_ref),

        // Alphanumeric state label (can start with digit, like "4a", "100", "foo")
        state_label_alnum: ($) => /[A-Za-z0-9_]+/,

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
        at_var_ref: ($) => seq("(", caseInsensitive("AT"), $.double_string, ")"),

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

// Case-insensitive keyword helper
function caseInsensitive(keyword) {
    return new RegExp(
        keyword
            .split("")
            .map((c) => (/[a-zA-Z]/.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c))
            .join("")
    );
}
