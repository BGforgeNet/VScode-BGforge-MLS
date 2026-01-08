/* Generated from g_bags.td - do not edit */

BEGIN G_BAGS

IF ~NumTimesTalkedTo(0)~ state0
    SAY @20
    ++ @21 + state1
    ++ @22 + state2
END

IF ~~ state1
    SAY @23
    ++ @24 DO ~SetNumTimesTalkedTo(0) GiveItemCreate("BAG01",LastTalkedToBy,1,0,0) EscapeArea()~ EXIT
END

IF ~~ state2
    SAY @25
    IF ~~ THEN DO ~SetNumTimesTalkedTo(0) EscapeArea()~ EXIT
END