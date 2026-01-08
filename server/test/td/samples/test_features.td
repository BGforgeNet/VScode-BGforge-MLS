// Test JOURNAL, EXTERN, and EXTEND_BOTTOM position features

const dialog = "TESTDLG";

function state1() {
    say(tra(100));

    if (Global("quest", "GLOBAL", 0)) {
        reply(tra(101));
        action(SetGlobal("quest", "GLOBAL", 1));
        journal(tra(200));
        goto(state2);
    }

    reply(tra(102));
    exit();
}

function state2() {
    say(tra(103));

    if (Global("quest", "GLOBAL", 1)) {
        reply(tra(104));
        action(SetGlobal("quest", "GLOBAL", 2));
        solvedJournal(tra(201));
        goto(state3);
    }

    reply(tra(105));
    unsolvedJournal(tra(202));
    extern("OTHERDLG", "otherstate");
}

function state3() {
    say(tra(106));

    reply(tra(107));
    flags(0x100);
    exit();
}

// Test EXTEND_BOTTOM with position
extendBottom(dialog, state1, { position: 2 }, () => {
    if (PartyHasItem("SWORD01")) {
        reply(tra(300));
        goto(state2);
    }
});

export default dialog(dialog, [state1, state2, state3]);
