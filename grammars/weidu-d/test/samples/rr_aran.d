// creator  : aVENGER
// argument : ARAN.DLG

EXTEND_BOTTOM ~ARAN~ 8 IF ~!Dead("Arledrian") !InPartyAllowDead("Kova") !InPartyAllowDead("Kiyone")~ THEN GOTO a5 END
EXTEND_BOTTOM ~ARAN~ 88 IF ~!PartyHasItem("SW1H10")~ THEN GOTO a1 END

APPEND ARAN
IF ~Global("RR#GIVE_SSOB","GLOBAL",0)~ THEN BEGIN a1
  SAY @190
IF ~~ THEN REPLY #22424 /* ~Thank you.  I'll be on my way.~ */ DO ~SetGlobal("RR#GIVE_SSOB","GLOBAL",1) GiveItemCreate("SW1H10",LastTalkedToBy(Myself),1,1,1)~ GOTO 89
IF ~~ THEN REPLY #58744 /* ~I have no need of your sword.~ */ GOTO a2
END

IF ~Global("RR#GIVE_SSOB","GLOBAL",0)~ THEN BEGIN a2
  SAY #28781 /* ~Well, as you wish, I suppose.  I'm not about to twist your arm or anything.~ */
IF ~~ THEN DO ~SetGlobal("RR#GIVE_SSOB","GLOBAL",2)~ GOTO 89
END

IF ~~ THEN BEGIN a5
  SAY @191
=
@192
IF ~~ THEN DO ~SetGlobal("RR#ARLED_QUEST","GLOBAL",1)~ UNSOLVED_JOURNAL @650 GOTO 17
END
END