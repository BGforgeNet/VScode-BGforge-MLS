// Test CHAIN - multi-speaker conversations

const DIALOG1 = "PLAYER1";
const DIALOG2 = "EDWIN";
const DIALOG3 = "MINSC";

function next_state() {
    say(tra(502));
    reply(tra(503));
    exit();
}

// Export state in BEGIN
export default begin(DIALOG1, [next_state]);

// Simple two-speaker chain
chain(function greeting_chain() {
    say(DIALOG1, tra(100));
    say(DIALOG2, tra(101));
    say(DIALOG1, tra(102));
    exit();
});

// Chain with multisay
chain(function multisay_chain() {
    say(DIALOG1, tra(200));
    say(tra(201)); // Continue same speaker
    say(tra(202)); // Continue same speaker
    say(DIALOG2, tra(203));
    say(tra(204)); // Continue DIALOG2
    exit();
});

// Chain with actions
chain(function action_chain() {
    say(DIALOG1, tra(300));
    action(GiveItemCreate("SWORD01", "EDWIN", 1, 0, 0));
    say(DIALOG2, tra(301));
    action(
        SetGlobal("quest_started", "GLOBAL", 1),
        AddexperienceParty(1000)
    );
    say(DIALOG1, tra(302));
    exit();
});

// Chain with conditional
chain(function conditional_chain() {
    say(DIALOG1, tra(400));

    if (PartyHasItem("SWORD01")) {
        say(DIALOG2, tra(401));
    }

    say(DIALOG3, tra(402));
    exit();
});

// Chain with goto epilogue
chain(function goto_chain() {
    say(DIALOG1, tra(500));
    say(DIALOG2, tra(501));
    goTo(next_state);
});

// Chain with entry trigger
chain(Global("quest_active", "GLOBAL", 1), function triggered_chain() {
    say(DIALOG1, tra(600));
    say(DIALOG2, tra(601));
    exit();
});
