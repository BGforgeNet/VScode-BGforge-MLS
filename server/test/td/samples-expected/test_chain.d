/* Generated from test_chain.td - do not edit */

BEGIN PLAYER1

IF ~~ next_state
    SAY @502
    ++ @503 EXIT
END

CHAIN
DIALOG1 greeting_chain
@100
== DIALOG2
@101
== DIALOG1
@102
EXIT

CHAIN
DIALOG1 multisay_chain
@200
= @201
= @202
== DIALOG2
@203
= @204
EXIT

CHAIN
DIALOG1 action_chain
@300
DO ~GiveItemCreate("SWORD01", "EDWIN", 1, 0, 0)~
== DIALOG2
@301
DO ~SetGlobal("quest_started", "GLOBAL", 1) AddexperienceParty(1000)~
== DIALOG1
@302
EXIT

CHAIN
DIALOG1 conditional_chain
@400
== DIALOG2 IF ~PartyHasItem("SWORD01")~ THEN
@401
== DIALOG3
@402
EXIT

CHAIN
DIALOG1 goto_chain
@500
== DIALOG2
@501
END DIALOG1 next_state

CHAIN
IF ~Global("quest_active","GLOBAL",1)~ THEN DIALOG1 triggered_chain
@600
== DIALOG2
@601
EXIT
