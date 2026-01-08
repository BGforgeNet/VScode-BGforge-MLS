/* Generated from test_features.td - do not edit */

EXTEND_BOTTOM TESTDLG state1 #2
    +~PartyHasItem("SWORD01")~+ @300 + state2
END

BEGIN TESTDLG

IF ~~ state1
    SAY @100
    +~Global("quest","GLOBAL",0)~+ @101 DO ~SetGlobal("quest","GLOBAL",1)~ JOURNAL @200 + state2
    ++ @102 EXIT
END

IF ~~ state2
    SAY @103
    +~Global("quest","GLOBAL",1)~+ @104 DO ~SetGlobal("quest","GLOBAL",2)~ SOLVED_JOURNAL @201 + state3
    ++ @105 UNSOLVED_JOURNAL @202 EXTERN OTHERDLG otherstate
END

IF ~~ state3
    SAY @106
    ++ @107 FLAGS 256 EXIT
END