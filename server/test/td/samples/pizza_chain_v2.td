/**
 * Kelsey-Imoen pizza banter chain.
 * Multi-speaker chain dialog with conditional branches based on inventory.
 */

chain(
  Global("KelseyImoenPizza", "LOCALS", 0)
  && InParty("Imoen2")
  && See("Imoen2")
  && !StateCheck("Imoen2", STATE_SLEEPING),
  "BJKLSY", "pizzachain",
  () => {
    // @100 = ~Imoen, what do you like on your pizza?~
    say(tra(100))
    action(SetGlobal("KelseyImoenPizza", "LOCALS", 1))

    from("IMOEN2J")
    // @101 = ~Oregano.~
    say(tra(101))
    // @102 = ~Oh, and maybe with a little basil mixed in.~
    say(tra(102))

    from("BJKLSY")
    // @103 = ~Well, yeah, but anything else?~
    say(tra(103))

    from("IMOEN2J")
    // @104 = ~Sauce is good.~
    say(tra(104))

    fromWhen("BJKLSY", PartyHasItem("pepperoni"))
    // @105 = ~Look, we HAVE pepperoni. Why don't I just use that? I'll eat it,\nanyway. If you don't like it, have yogurt instead.~
    say(tra(105))

    fromWhen("IMOEN2J", !PartyHasItem("pepperoni"))
    // @106 = ~Crust. I like crust on my pizza. Cooked crust is better.~
    say(tra(106))

    fromWhen("BJKLSY", !PartyHasItem("pepperoni"))
    // @107 = ~Do you want me to make you this pizza or not?~
    say(tra(107))
    // @108 = ~It WAS your idea.~
    say(tra(108))

    fromWhen("IMOEN2J", !PartyHasItem("pepperoni"))
    // @109 = ~I can't decide. Never mind, I'm just gonna have yogurt.~
    say(tra(109))

    fromWhen("BJKLSY", !PartyHasItem("pepperoni"))
    // @110 = ~(sigh)~
    say(tra(110))

    exit()
  }
)
