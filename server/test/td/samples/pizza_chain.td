// Real-world CHAIN example - Kelsey and Imoen pizza conversation

const BJKLSY = "BJKLSY";
const IMOEN2J = "IMOEN2J";

// Chain with entry trigger, DO action, and complex conditionals
chain(
    Global("KelseyImoenPizza", "LOCALS", 0) &&
    InParty("Imoen2") &&
    See("Imoen2") &&
    !StateCheck("Imoen2", STATE_SLEEPING),
    function pizzachain() {
        say(BJKLSY, tra(1));
        action(SetGlobal("KelseyImoenPizza", "LOCALS", 1));

        say(IMOEN2J, tra(2));
        say(tra(3)); // Multisay continuation

        say(BJKLSY, tra(4));

        say(IMOEN2J, tra(5));

        // Conditional branches based on pepperoni
        if (PartyHasItem("pepperoni")) {
            say(BJKLSY, tra(6));
        }

        if (!PartyHasItem("pepperoni")) {
            say(IMOEN2J, tra(7));
        }

        if (!PartyHasItem("pepperoni")) {
            say(BJKLSY, tra(8));
            say(tra(9)); // Multisay
        }

        if (!PartyHasItem("pepperoni")) {
            say(IMOEN2J, tra(10));
        }

        if (!PartyHasItem("pepperoni")) {
            say(BJKLSY, tra(11));
        }

        exit();
    }
);
