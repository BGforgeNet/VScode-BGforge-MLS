// creator  aVENGER
// argument BMTHIEF.DLG

EXTEND_BOTTOM ~BMTHIEF~ 0 
  IF ~!Class(LastTalkedToBy(Myself),THIEF_ALL)
      !Class(LastTalkedToBy(Myself),BARD_ALL)~ THEN REPLY  @1000  GOTO a5
  IF ~Global("RR#KnowMarina","GLOBAL",0)
	OR(2)	 Class(LastTalkedToBy(Myself),THIEF_ALL)
		 Class(LastTalkedToBy(Myself),BARD_ALL)~ THEN REPLY  @1001 GOTO RR#THFCNT
  IF ~PartyHasItem("RR#BK03")
Global("RR#ARLED_JOURNAL","GLOBAL",4)~ THEN REPLY  @1002 GOTO a20
END

EXTEND_BOTTOM ~BMTHIEF~ 4 
  IF ~!Class(LastTalkedToBy(Myself),THIEF_ALL)
      !Class(LastTalkedToBy(Myself),BARD_ALL)~ THEN REPLY  @1000  GOTO a5
  IF ~Global("RR#KnowMarina","GLOBAL",0)
	OR(2)	 Class(LastTalkedToBy(Myself),THIEF_ALL)
			 Class(LastTalkedToBy(Myself),BARD_ALL)~ THEN REPLY  @1001 GOTO RR#THFCNT
IF ~!Global("RR#KnowMarina","GLOBAL",0)
	OR(2)	 Class(LastTalkedToBy(Myself),THIEF_ALL)
			 Class(LastTalkedToBy(Myself),BARD_ALL)~ THEN REPLY  @1003 GOTO a8

IF ~Global("RR#KnowMarina","GLOBAL",2)~ THEN REPLY  @1004 GOTO a9
  IF ~PartyHasItem("RR#BK03")
Global("RR#ARLED_JOURNAL","GLOBAL",4)~ THEN REPLY  @1002 GOTO a20
  IF ~GlobalGT("RR#ARLED_VAMP_SPAWN","GLOBAL",0)
      Global("RR#TOLD_MARINA_ABOUT_ARLED","GLOBAL",0)~ THEN REPLY  @1005 GOTO a35
END


APPEND BMTHIEF 
IF ~~ THEN BEGIN a5
  SAY @1006
  IF ~PartyGoldGT(49)~ THEN REPLY #26177  /* Ok */ DO ~TakePartyGold(50)~ GOTO a6
  IF ~~ THEN REPLY #21353 /* No thanks */ GOTO 3
END

IF ~~ THEN BEGIN a6
  SAY #57318 /* ~Take a look at some of these items.  You won't be disappointed.~ */
  IF ~~ THEN DO ~StartStore("RR#MARIN",LastTalkedToBy(Myself))~ EXIT
END

IF ~Global("RR#KnowMarina","GLOBAL",0)~ THEN BEGIN a7
  SAY @1008
  IF ~~ THEN DO ~SetGlobal("RR#KnowMarina","GLOBAL",1)~ GOTO a6
END

IF ~Global("RR#KnowMarina","GLOBAL",0)~ THEN BEGIN a8
  SAY @1009
  IF ~~ THEN DO ~StartStore("RR#MARIN",LastTalkedToBy(Myself))~ EXIT
END

IF ~~ THEN BEGIN a9
  SAY @1010
=
@1011
=
@1012
=
@1013
=
@1014
  IF ~!Dead("RR#SELI")~ THEN REPLY @1015 GOTO a10
  IF ~Dead("RR#SELI")~ THEN REPLY @1016 GOTO a12
  IF ~Dead("RR#SELI")
      !Alignment(LastTalkedToBy(Myself),MASK_GOOD)
      !Class(LastTalkedToBy(Myself),PALADIN_ALL)~ THEN REPLY @1017 GOTO a11
  IF ~!Class(LastTalkedToBy(Myself),PALADIN_ALL)
      Dead("RR#SELI")~ THEN REPLY @1018 DO ~ReputationInc(-1) SetGlobal("RR#KnowMarina","GLOBAL",1)~  EXIT

END

IF ~~ THEN BEGIN a10
  SAY @1019
=
@1020
=
@1021
=
@1022
=
@1023
=
@1024
  IF ~~ THEN DO ~GiveItemCreate("MISC45",LastTalkedToBy(Myself),1,1,1)
ReputationInc(1)
AddXPObject(Player1,1500)
AddXPObject(Player2,1500)
AddXPObject(Player3,1500)
AddXPObject(Player4,1500)
AddXPObject(Player5,1500)
AddXPObject(Player6,1500)
EscapeArea() ~ EXIT
END

IF ~~ THEN BEGIN a11
  SAY @1025
=
@1026
=
@1027
=
@1028
  IF ~~ THEN DO ~ReputationInc(-1)
AddXPObject(Player1,1000)
AddXPObject(Player2,1000)
AddXPObject(Player3,1000)
AddXPObject(Player4,1000)
AddXPObject(Player5,1000)
AddXPObject(Player6,1000)
DisplayStringHead(Myself,46150) //  quaffs a potion
UseItem("POTN10",Myself) // Potion of Invisibility
EscapeArea()~ EXIT
END


IF ~~ THEN BEGIN a12
  SAY @1029
=
@1030
=
@1031
=
@1032
=
@1033
=
@1034
=
@1035
=
@1036
=
@1037
=
@1038
=
@1039
  IF ~~ THEN DO ~ReputationInc(1)
AddXPObject(Player1,1000)
AddXPObject(Player2,1000)
AddXPObject(Player3,1000)
AddXPObject(Player4,1000)
AddXPObject(Player5,1000)
AddXPObject(Player6,1000)
EscapeArea()~ EXIT
END


IF ~~ THEN BEGIN a20
  SAY @1040
=
@1041
  IF ~~ THEN REPLY @1042 DO ~SetGlobal("RR#ARLED_JOURNAL","GLOBAL",5)~ GOTO a21

END

IF ~~ THEN BEGIN a21
  SAY @1043
=
@1044
=
@1045
=
@1046
=
@1047

  IF ~~ THEN REPLY @1048 GOTO a22
END


IF ~~ THEN BEGIN a22
  SAY @1049
=
@1050
=
@1051
=
@1052
  IF ~~ THEN REPLY @1053 GOTO a23
  IF ~~ THEN REPLY @1054 GOTO a23
END


IF ~~ THEN BEGIN a23
  SAY @1055
=
@1056
  IF ~~ THEN REPLY @1057 UNSOLVED_JOURNAL @666 EXIT
  IF ~!Race(Player1,ELF)
      !Race(Player1,HALF_ELF)~ THEN REPLY @1058 UNSOLVED_JOURNAL @666 EXIT
END


IF ~~ THEN BEGIN a30
  SAY @1055
=
@1056
  IF ~~ THEN REPLY @1057 UNSOLVED_JOURNAL @666 EXIT
  IF ~!Race(Player1,ELF)
      !Race(Player1,HALF_ELF)~ THEN REPLY @1058 UNSOLVED_JOURNAL @666 EXIT
END

IF ~~ THEN BEGIN a35
  SAY @1059
=
@1060
  IF ~!Dead("Arledrian")~ THEN REPLY @1061 GOTO a36
  IF ~Dead("Arledrian")~ THEN REPLY @1062 GOTO a37
END

IF ~~ THEN BEGIN a36
  SAY @1063
  IF ~~ THEN DO ~SetGlobal("RR#TOLD_MARINA_ABOUT_ARLED","GLOBAL",1)
AddXPObject(Player1,500)
AddXPObject(Player2,500)
AddXPObject(Player3,500)
AddXPObject(Player4,500)
AddXPObject(Player5,500)
AddXPObject(Player6,500)~ EXIT
END

IF ~~ THEN BEGIN a37
  SAY @1064
  IF ~~ THEN DO ~SetGlobal("RR#TOLD_MARINA_ABOUT_ARLED","GLOBAL",1)
AddXPObject(Player1,250)
AddXPObject(Player2,250)
AddXPObject(Player3,250)
AddXPObject(Player4,250)
AddXPObject(Player5,250)
AddXPObject(Player6,250)~ EXIT
END
END


// Party member interjections for Marina's [Thieves' Cant] dialogue
CHAIN BMTHIEF RR#THFCNT
@1007
== YOSHJ IF ~!IsGabber("Yoshimo") InParty("Yoshimo") InMyArea("Yoshimo") !StateCheck("Yoshimo",CD_STATE_NOTVALID)~ THEN @1543
== JANJ IF ~!IsGabber("Jan") InParty("Jan") InMyArea("Jan") !StateCheck("Jan",CD_STATE_NOTVALID)~ THEN @1547
== NALIAJ IF ~!IsGabber("Nalia") InParty("Nalia") InMyArea("Nalia") !StateCheck("Nalia",CD_STATE_NOTVALID)~ THEN @1546
== HAERDAJ IF ~!IsGabber("HaerDalis") InParty("HaerDalis") InMyArea("HaerDalis") !StateCheck("HaerDalis",CD_STATE_NOTVALID)~ THEN @1548
== MINSCJ IF ~!IsGabber("Minsc") InParty("Minsc") InMyArea("Minsc") !StateCheck("Minsc",CD_STATE_NOTVALID)~ THEN @1544
== KORGANJ IF ~!IsGabber("Korgan") InParty("Korgan") InMyArea("Korgan") !StateCheck("Korgan",CD_STATE_NOTVALID)~ THEN @1545 END
IF ~~ THEN GOTO a7