// creator  : aVENGER
// argument : RR#VWARD

BEGIN ~RR#VWARD~

IF ~NumTimesTalkedTo(0)~ THEN BEGIN 0
SAY @2100

IF ~~ THEN REPLY @2101 GOTO 1a

IF ~!Class(Player1,MAGE_ALL)
	!Class(Player1,BARD_ALL)
	!Class(Player1,CLERIC_ALL)
	!Class(Player1,DRUID_ALL)
	!Class(Player1,PALADIN_ALL)
	!Class(Player1,RANGER_ALL)
	!Class(Player1,THIEF_ALL)~ THEN REPLY @2102 GOTO 1
IF ~OR(7)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)
	Class(Player1,CLERIC_ALL)
	Class(Player1,DRUID_ALL)
	Class(Player1,PALADIN_ALL)
	Class(Player1,RANGER_ALL)
	Class(Player1,THIEF_ALL)~ THEN REPLY @2102 GOTO 1b
END

IF ~~ THEN BEGIN 1
SAY @2103
IF ~~ THEN REPLY @2101 GOTO 1a
IF ~~ THEN REPLY @2104 GOTO 3
END


IF ~~ THEN BEGIN 1a
SAY @2105
=
@2106

IF ~!Class(Player1,MAGE_ALL)
	!Class(Player1,BARD_ALL)
	!Class(Player1,CLERIC_ALL)
	!Class(Player1,DRUID_ALL)
	!Class(Player1,PALADIN_ALL)
	!Class(Player1,RANGER_ALL)
	!Class(Player1,THIEF_ALL)~ THEN REPLY @2102 GOTO 1

IF ~OR(7)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)
	Class(Player1,CLERIC_ALL)
	Class(Player1,DRUID_ALL)
	Class(Player1,PALADIN_ALL)
	Class(Player1,RANGER_ALL)
	Class(Player1,THIEF_ALL)~ THEN REPLY @2102 GOTO 1b

IF ~~ THEN REPLY @2104 GOTO 3
END


IF ~~ THEN BEGIN 1b
SAY @2107
IF ~~ THEN REPLY @2108 GOTO 1a
IF ~OR(2)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)~ THEN REPLY @2109 GOTO 2
IF ~OR(2)
	Class(Player1,THIEF_ALL)
	Class(Player1,BARD_ALL)~ THEN REPLY @2110 GOTO 2
IF ~OR(6)
	Class(Player1,CLERIC_ALL)
	Class(Player1,DRUID_ALL)
	Class(Player1,PALADIN_ALL)
	Class(Player1,RANGER_ALL)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)~ THEN REPLY @2111 GOTO 2
IF ~~ THEN REPLY @2112 GOTO 3
END

IF ~~ THEN BEGIN 2
SAY @2113
=
@2114
IF ~~ THEN REPLY @2115 GOTO 4
IF ~~ THEN REPLY @2112 GOTO 3
END

IF ~~ THEN BEGIN 3
SAY @2116
IF ~~ THEN DO ~SetGlobal("RR#VWARD","GLOBAL",1)
        ClearAllActions()
        StartCutSceneMode()
        TriggerActivation("RR#BLUP",FALSE)
        TriggerActivation("RR#BLDN",FALSE)
        CreateCreature("RR#OBSRV",[870.408],0) // No such index
        StartCutScene("RR#CEND2")~ EXIT
END

IF ~~ THEN BEGIN 4
SAY @2117
IF ~~ THEN DO ~SetGlobal("RR#VWARD","GLOBAL",1)
	ClearAllActions()
        StartCutSceneMode()
        TriggerActivation("RR#BLUP",FALSE)
        TriggerActivation("RR#BLDN",FALSE)
        CreateCreature("RR#OBSRV",[870.408],0) // No such index
        StartCutScene("RR#CEND1")~ EXIT
END