/* Generated from pizza_chain_v2.td - do not edit */

CHAIN
IF ~Global("KelseyImoenPizza","LOCALS",0) InParty("Imoen2") See("Imoen2") !StateCheck("Imoen2",STATE_SLEEPING)~ THEN BJKLSY pizzachain
@100
DO ~SetGlobal("KelseyImoenPizza","LOCALS",1)~
== IMOEN2J
@101
= @102
== BJKLSY
@103
== IMOEN2J
@104
== BJKLSY IF ~PartyHasItem("pepperoni")~ THEN
@105
== IMOEN2J IF ~!PartyHasItem("pepperoni")~ THEN
@106
== BJKLSY IF ~!PartyHasItem("pepperoni")~ THEN
@107
= @108
== IMOEN2J IF ~!PartyHasItem("pepperoni")~ THEN
@109
== BJKLSY IF ~!PartyHasItem("pepperoni")~ THEN
@110
EXIT
