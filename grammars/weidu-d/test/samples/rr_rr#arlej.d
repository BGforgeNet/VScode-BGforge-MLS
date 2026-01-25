// creator  : aVENGER
// argument : RR#ARLEJ

BEGIN ~RR#ARLEJ~

IF ~NumTimesTalkedTo(0)~ THEN BEGIN a0
SAY @1250

IF ~!Class(Player1,BARD_ALL)
    !Class(Player1,THIEF_ALL)
    !Race(Player1,ELF)
    !Race(Player1,HALF_ELF)
    CheckStatLT(Player1,25,LORE)~ THEN REPLY @1251 GOTO a1

IF ~GlobalLT("RR#SB_STOLEN","GLOBAL",2)
    OR(2)
    Race(Player1,ELF)
    Race(Player1,HALF_ELF)~ THEN REPLY @1252 DO ~TakePartyItem("RR#BK03")
DestroyItem("RR#BK03")
GiveItemCreate("RR#BK01",Player1,0,0,0)
EraseJournalEntry(@653)
SetGlobal("RR#ARLED_JOURNAL","GLOBAL",2)
SetGlobal("RR#ARLED_SECRET","GLOBAL",1)
AddXPObject(Player1,250)
AddXPObject(Player2,250)
AddXPObject(Player3,250)
AddXPObject(Player4,250)
AddXPObject(Player5,250)
AddXPObject(Player6,250)~ UNSOLVED_JOURNAL @662 EXIT

IF ~Global("RR#SB_STOLEN","GLOBAL",2)
    OR(2)
    Race(Player1,ELF)
    Race(Player1,HALF_ELF)~ THEN REPLY @1252 DO ~TakePartyItem("RR#BK03")
DestroyItem("RR#BK03")
GiveItemCreate("RR#BK02",Player1,0,0,0)
EraseJournalEntry(@653)
SetGlobal("RR#ARLED_SECRET","GLOBAL",1)
SetGlobal("RR#ARLED_JOURNAL","GLOBAL",2)
AddXPObject(Player1,250)
AddXPObject(Player2,250)
AddXPObject(Player3,250)
AddXPObject(Player4,250)
AddXPObject(Player5,250)
AddXPObject(Player6,250)~ UNSOLVED_JOURNAL @662 EXIT

IF ~OR(2)
    Class(Player1,BARD_ALL)
    Class(Player1,THIEF_ALL)
    !Race(Player1,ELF)
    !Race(Player1,HALF_ELF)~ THEN REPLY @1253 GOTO a3

IF ~CheckStatGT(Player1,24,LORE)
    !Race(Player1,ELF)
    !Race(Player1,HALF_ELF)~ THEN REPLY @1254 GOTO a3
END

IF ~~ THEN BEGIN a1
SAY @1255
IF ~~ GOTO a2
END

IF ~~ THEN BEGIN a2
SAY @1256
IF ~InParty(Player2)
    InMyArea(Player2)
    !StateCheck(Player2,CD_STATE_NOTVALID)
    OR(2)
     Race(Player2,ELF) 
     Race(Player2,HALF_ELF)~ THEN REPLY @1270 GOTO iPlayer2
IF ~InParty(Player3)
    InMyArea(Player3)
    !StateCheck(Player3,CD_STATE_NOTVALID)
    OR(2)
     Race(Player3,ELF) 
     Race(Player3,HALF_ELF)~ THEN REPLY @1271 GOTO iPlayer3
IF ~InParty(Player4)
    InMyArea(Player4)
    !StateCheck(Player4,CD_STATE_NOTVALID)
    OR(2)
     Race(Player4,ELF) 
     Race(Player4,HALF_ELF)~ THEN REPLY @1272 GOTO iPlayer4
IF ~InParty(Player5)
    InMyArea(Player5)
    !StateCheck(Player5,CD_STATE_NOTVALID)
    OR(2)
     Race(Player5,ELF) 
     Race(Player5,HALF_ELF)~ THEN REPLY @1273 GOTO iPlayer5
IF ~InParty(Player6)
    InMyArea(Player6)
    !StateCheck(Player6,CD_STATE_NOTVALID)
    OR(2)
     Race(Player6,ELF) 
     Race(Player6,HALF_ELF)~ THEN REPLY @1274 GOTO iPlayer6
IF ~OR(2)
    CheckStatGT(Player1,9,INT)
    CheckStatGT(Player1,9,WIS)~ THEN REPLY @1257 DO ~AddXPObject(Player1,250)
			EraseJournalEntry(@653)
			SetGlobal("RR#ARLED_JOURNAL","GLOBAL",3)~ UNSOLVED_JOURNAL @660 EXIT
IF ~CheckStatLT(Player1,10,INT)
    CheckStatLT(Player1,10,WIS)~ THEN REPLY @1258 DO ~EraseJournalEntry(@653)
		  SetGlobal("RR#ARLED_JOURNAL","GLOBAL",3)~ UNSOLVED_JOURNAL @661 EXIT
END

IF ~~ THEN BEGIN a3
SAY @1259
IF ~GlobalLT("RR#SB_STOLEN","GLOBAL",2)~ DO ~TakePartyItem("RR#BK03")
DestroyItem("RR#BK03")
GiveItemCreate("RR#BK01",Player1,0,0,0)
EraseJournalEntry(@653)
SetGlobal("RR#ARLED_JOURNAL","GLOBAL",2)
SetGlobal("RR#ARLED_SECRET","GLOBAL",1)
AddXPObject(Player1,250)
AddXPObject(Player2,250)
AddXPObject(Player3,250)
AddXPObject(Player4,250)
AddXPObject(Player5,250)
AddXPObject(Player6,250)
~ UNSOLVED_JOURNAL @662 EXIT
IF ~Global("RR#SB_STOLEN","GLOBAL",2)~ DO ~TakePartyItem("RR#BK03")
DestroyItem("RR#BK03")
GiveItemCreate("RR#BK02",Player1,0,0,0)
EraseJournalEntry(@653)
SetGlobal("RR#ARLED_JOURNAL","GLOBAL",2)
SetGlobal("RR#ARLED_SECRET","GLOBAL",1)
AddXPObject(Player1,250)
AddXPObject(Player2,250)
AddXPObject(Player3,250)
AddXPObject(Player4,250)
AddXPObject(Player5,250)
AddXPObject(Player6,250)~ UNSOLVED_JOURNAL @662 EXIT
END

IF ~~ THEN BEGIN a4
SAY @1261
IF ~GlobalLT("RR#SB_STOLEN","GLOBAL",2)~ THEN DO ~TakePartyItem("RR#BK03")
DestroyItem("RR#BK03")
GiveItemCreate("RR#BK01",Player1,0,0,0)
EraseJournalEntry(@653)
SetGlobal("RR#ARLED_JOURNAL","GLOBAL",2)
SetGlobal("RR#ARLED_SECRET","GLOBAL",1)
AddXPObject(Player1,250)
AddXPObject(Player2,250)
AddXPObject(Player3,250)
AddXPObject(Player4,250)
AddXPObject(Player5,250)
AddXPObject(Player6,250)~ UNSOLVED_JOURNAL @662 EXIT
IF ~Global("RR#SB_STOLEN","GLOBAL",2)~ THEN DO ~TakePartyItem("RR#BK03")
DestroyItem("RR#BK03")
GiveItemCreate("RR#BK02",Player1,0,0,0)
EraseJournalEntry(@653)
SetGlobal("RR#ARLED_JOURNAL","GLOBAL",2)
SetGlobal("RR#ARLED_SECRET","GLOBAL",1)
AddXPObject(Player1,750)~ UNSOLVED_JOURNAL @662 EXIT
END


// Player 2 translates Arledrian's journal (this is for non-Bioware elven and half-elven NPCs)

IF ~~ THEN BEGIN iPlayer2
SAY @1280
IF ~~ THEN GOTO a4
END

// Player 3 translates Arledrian's journal (this is for non-Bioware elven and half-elven NPCs)

IF ~~ THEN BEGIN iPlayer3
SAY @1281
IF ~~ THEN GOTO a4
END

// Player 4 translates Arledrian's journal (this is for non-Bioware elven and half-elven NPCs)

IF ~~ THEN BEGIN iPlayer4
SAY @1282
IF ~~ THEN GOTO a4
END

// Player 5 translates Arledrian's journal (this is for non-Bioware elven and half-elven NPCs)

IF ~~ THEN BEGIN iPlayer5
SAY @1283
IF ~~ THEN GOTO a4
END

// Player 6 translates Arledrian's journal (this is for non-Bioware elven and half-elven NPCs)

IF ~~ THEN BEGIN iPlayer6
SAY @1284
IF ~~ THEN GOTO a4
END