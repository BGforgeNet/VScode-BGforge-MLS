// Based on grammars/weidu-d/test/samples/g_bags.d
// Simple starting bags dialog with 3 states

const dialog = "G_BAGS";

// Declare for TypeScript
declare function state0(): void;

if (NumTimesTalkedTo(0)) {
    function state0() {
        say(tra(20));

        reply(tra(21));
        goTo(state1);

        reply(tra(22));
        goTo(state2);
    }
}

function state1() {
    say(tra(23));

    reply(tra(24));
    action(
        SetNumTimesTalkedTo(0),
        GiveItemCreate("BAG01", LastTalkedToBy, 1, 0, 0),
        EscapeArea()
    );
    exit();
}

function state2() {
    say(tra(25));

    action(SetNumTimesTalkedTo(0), EscapeArea());
    exit();
}

export default begin(dialog, [state0, state1, state2]);
