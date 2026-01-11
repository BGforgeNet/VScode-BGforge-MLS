// Based on grammars/weidu-d/test/samples/botsmith.d
// Faster forging - Cespenar item type menu

const dlg = "BOTSMITH";
const startState = "0";

// Note: Original uses %cespenar_weapon%, %cespenar_armor%, %cespenar_trinket%
// These are TP2 macros that insert transitions. For this test we use comments.

extendBottom(dlg, startState, () => {
    reply(tra(20));
    goTo(g_item_type);
});

function g_item_type() {
    say(tra(21));

    reply(tra(3));
    goTo(g_weapon);

    reply(tra(4));
    goTo(g_armor);

    reply(tra(5));
    goTo(g_trinket);

    reply(tra(6));
    goTo(startState);
}

function g_weapon() {
    say(tra(22));
    // %cespenar_weapon% transitions would be inserted here by TP2

    reply(tra(10));
    goTo(g_item_type);

    reply(tra(6));
    goTo(startState);
}

function g_armor() {
    say(tra(23));
    // %cespenar_armor% transitions would be inserted here by TP2

    reply(tra(10));
    goTo(g_item_type);

    reply(tra(6));
    goTo(startState);
}

function g_trinket() {
    say(tra(24));
    // %cespenar_trinket% transitions would be inserted here by TP2

    reply(tra(10));
    goTo(g_item_type);

    reply(tra(6));
    goTo(startState);
}

append(dlg, [g_item_type, g_weapon, g_armor, g_trinket]);
