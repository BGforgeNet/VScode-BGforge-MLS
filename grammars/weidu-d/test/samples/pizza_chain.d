CHAIN
IF ~Global("KelseyImoenPizza","LOCALS",0)
    InParty("Imoen2")
    See("Imoen2")
    !StateCheck("Imoen2",STATE_SLEEPING)~ THEN BJKLSY pizzachain
~Imoen, what do you like on your pizza?~
DO ~SetGlobal("KelseyImoenPizza","LOCALS",1)~
== IMOEN2J
~Oregano.~
=
~Oh, and maybe with a little basil mixed in.~

== BJKLSY
~Well, yeah, but anything else?~

== IMOEN2J
~Sauce is good.~

== BJKLSY IF ~PartyHasItem("pepperoni")~ THEN
~Look, we HAVE pepperoni. Why don't I just use that? I'll eat it,
anyway. If you don't like it, have yogurt instead.~

== IMOEN2J IF ~!PartyHasItem("pepperoni")~ THEN
~Crust. I like crust on my pizza. Cooked crust is better.~
== BJKLSY IF ~!PartyHasItem("pepperoni")~ THEN
~Do you want me to make you this pizza or not?~
=
~It WAS your idea.~

== IMOEN2J IF ~!PartyHasItem("pepperoni")~ THEN
~I can't decide. Never mind, I'm just gonna have yogurt.~
== BJKLSY IF ~!PartyHasItem("pepperoni")~ THEN
~(sigh)~
EXIT
