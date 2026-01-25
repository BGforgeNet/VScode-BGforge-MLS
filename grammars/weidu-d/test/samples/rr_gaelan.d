// creator  : aVENGER
// argument : GALEAN.DLG

ADD_STATE_TRIGGER ~GAELAN~ 67 ~Global("RR#ARLED_QUEST","GLOBAL",0)~

APPEND GAELAN

IF ~Global("Linvail","GLOBAL",1)
    Global("RR#ARLED_QUEST","GLOBAL",2)~ THEN BEGIN z1
  SAY @1300
IF ~GlobalGT("RR#ARLED_VAMP_SPAWN","GLOBAL",0)~ THEN REPLY @1301 GOTO a15
IF ~PartyHasItem("RR#BK04")~ THEN REPLY @1302 DO ~EraseJournalEntry(@652)~ GOTO z2
IF ~PartyHasItem("RR#BK03")~ THEN REPLY @1303  DO ~EraseJournalEntry(@660)
	      EraseJournalEntry(@661)~ GOTO z3
IF ~OR(2)
PartyHasItem("RR#BK01")
PartyHasItem("RR#BK02")
Global("RR#ARLED_SECRET","GLOBAL",1)~ THEN REPLY @1304 DO ~EraseJournalEntry(@662)~ GOTO z4
IF ~~ THEN REPLY @1305 EXIT
END


IF ~~ THEN BEGIN z2
  SAY @1306
=
@1307
IF ~~ THEN REPLY @1308  UNSOLVED_JOURNAL @653 EXIT
IF ~~ THEN REPLY @1309  UNSOLVED_JOURNAL @653 EXIT
END


IF ~~ THEN BEGIN z3
  SAY @1310
=
@1311
=
@1312
IF ~~ THEN DO ~SetGlobal("RR#ARLED_JOURNAL","GLOBAL",4)
		EraseJournalEntry(@653)~ UNSOLVED_JOURNAL @663 EXIT
END

IF ~~ THEN BEGIN z4
  SAY @1313
IF ~~ THEN REPLY @1314 GOTO z5
IF ~~ THEN REPLY @1315 DO ~SetGlobal("RR#ARLED_SECRET","GLOBAL",2)~ GOTO z6
END

IF ~~ THEN BEGIN z5
  SAY @1316
=
@1317
IF ~~ THEN REPLY @1318 EXIT
IF ~~ THEN REPLY @1319 EXIT
END


IF ~~ THEN BEGIN z6
  SAY @1320
=
@1321
=
@1322
=
@1323
IF ~~ THEN REPLY @1308 DO ~GiveItemCreate("MISC45",Player1,1,1,1)~ EXIT
END


IF ~Global("Linvail","GLOBAL",1)
    Global("RR#ARLED_QUEST","GLOBAL",1)~ THEN BEGIN a1
  SAY @1324
IF ~~ THEN REPLY @1325 DO ~EraseJournalEntry(@650)
SetGlobal("RR#ARLED_QUEST","GLOBAL",2)~ GOTO a2
IF ~~ THEN REPLY @1326 DO ~EraseJournalEntry(@650)
SetGlobal("RR#ARLED_QUEST","GLOBAL",2)~ GOTO a2
END


IF ~~ THEN BEGIN a2
  SAY @1327
IF ~~ THEN REPLY @1328 GOTO a3
IF ~~ THEN REPLY @1329 GOTO a3
END


IF ~~ THEN BEGIN a3
  SAY @1330
=
@1331
IF ~OR(2)
    CheckStatGT(LastTalkedToBy(Myself),9,INT)
    CheckStatGT(LastTalkedToBy(Myself),9,WIS)~ THEN REPLY @1332 GOTO a7
IF ~~ THEN REPLY @1333 GOTO a4
IF ~~ THEN REPLY @1334 GOTO a5
IF ~~ THEN REPLY @1335 GOTO a6
END


IF ~~ THEN BEGIN a4
  SAY @1336
IF ~OR(2)
    CheckStatGT(LastTalkedToBy(Myself),9,INT)
    CheckStatGT(LastTalkedToBy(Myself),9,WIS)~ THEN REPLY @1332 GOTO a7
IF ~~ THEN REPLY @1334 GOTO a5
IF ~~ THEN REPLY @1335 GOTO a6
IF ~~ THEN REPLY @1337 EXIT
END


IF ~~ THEN BEGIN a5
  SAY @1338
=
@1339
IF ~OR(2)
    CheckStatGT(LastTalkedToBy(Myself),9,INT)
    CheckStatGT(LastTalkedToBy(Myself),9,WIS)~ THEN REPLY @1332 GOTO a7
IF ~~ THEN REPLY @1335 GOTO a6
IF ~~ THEN REPLY @1333 GOTO a4
IF ~~ THEN REPLY @1337 EXIT
END


IF ~~ THEN BEGIN a6
  SAY @1340
=
@1341
IF ~OR(2)
    CheckStatGT(LastTalkedToBy(Myself),9,INT)
    CheckStatGT(LastTalkedToBy(Myself),9,WIS)~ THEN REPLY @1332 GOTO a7
IF ~~ THEN REPLY @1334 GOTO a5
IF ~~ THEN REPLY @1333 GOTO a4
IF ~~ THEN REPLY @1337 EXIT
END


IF ~~ THEN BEGIN a7
  SAY @1342
=
@1343
IF ~~ THEN REPLY @1344 EXIT
IF ~~ THEN REPLY @1333 GOTO a4
IF ~~ THEN REPLY @1334 GOTO a5
IF ~~ THEN REPLY @1335 GOTO a6
IF ~~ THEN REPLY @1337 EXIT
END


IF ~~ THEN BEGIN a15
  SAY @1345
IF ~Dead("Arledrian")~ THEN REPLY @1346 GOTO a20
IF ~!Dead("Arledrian")
Global("RR#ARLED_SECRET","GLOBAL",1)~ THEN REPLY @1347 DO ~SetGlobal("RR#ARLED_SECRET","GLOBAL",2)~ GOTO a16
IF ~!Dead("Arledrian")
Global("RR#ARLED_SECRET","GLOBAL",2)~ THEN REPLY @1348 GOTO RR#G100
IF ~!Dead("Arledrian")~ THEN REPLY @1349 GOTO a17
END

IF ~~ THEN BEGIN a16
  SAY @1320
=
@1321
=
@1350
IF ~~ THEN DO ~SetGlobal("RR#ARLED_QUEST","GLOBAL",3)
GiveItemCreate("MISC41",Player1,1,1,1)
GiveItemCreate("MISC42",Player1,1,1,1)
GiveItemCreate("MISC43",Player1,1,1,1)
GiveItemCreate("MISC44",Player1,1,1,1)
EraseJournalEntry(@651)
EraseJournalEntry(@652)
EraseJournalEntry(@653)
EraseJournalEntry(@654)
EraseJournalEntry(@660)
EraseJournalEntry(@661)
EraseJournalEntry(@662)
EraseJournalEntry(@663)
EraseJournalEntry(@664)
EraseJournalEntry(@665)
EraseJournalEntry(@666)
AddXPObject(Player1,1000)
AddXPObject(Player2,1000)
AddXPObject(Player3,1000)
AddXPObject(Player4,1000)
AddXPObject(Player5,1000)
AddXPObject(Player6,1000)~ SOLVED_JOURNAL @670 EXIT
END


IF ~~ THEN BEGIN a17
  SAY @1351
=
@1352
=
@1353
IF ~~ THEN DO ~SetGlobal("RR#ARLED_QUEST","GLOBAL",3)
GiveItemCreate("MISC41",Player1,1,1,1)
GiveItemCreate("MISC42",Player1,1,1,1)
GiveItemCreate("MISC43",Player1,1,1,1)
GiveItemCreate("MISC44",Player1,1,1,1)
EraseJournalEntry(@651)
EraseJournalEntry(@652)
EraseJournalEntry(@653)
EraseJournalEntry(@654)
EraseJournalEntry(@660)
EraseJournalEntry(@661)
EraseJournalEntry(@662)
EraseJournalEntry(@663)
EraseJournalEntry(@664)
EraseJournalEntry(@665)
EraseJournalEntry(@666)
AddXPObject(Player1,1000)
AddXPObject(Player2,1000)
AddXPObject(Player3,1000)
AddXPObject(Player4,1000)
AddXPObject(Player5,1000)
AddXPObject(Player6,1000)~ SOLVED_JOURNAL @671 EXIT
END


IF ~~ THEN BEGIN a18
  SAY @1355
IF ~~ THEN DO ~SetGlobal("RR#ARLED_QUEST","GLOBAL",3)
EraseJournalEntry(@651)
EraseJournalEntry(@652)
EraseJournalEntry(@653)
EraseJournalEntry(@654)
EraseJournalEntry(@660)
EraseJournalEntry(@661)
EraseJournalEntry(@662)
EraseJournalEntry(@663)
EraseJournalEntry(@664)
EraseJournalEntry(@665)
EraseJournalEntry(@666)
AddXPObject(Player1,1000)
AddXPObject(Player2,1000)
AddXPObject(Player3,1000)
AddXPObject(Player4,1000)
AddXPObject(Player5,1000)
AddXPObject(Player6,1000)~ SOLVED_JOURNAL @673 EXIT
END


IF ~~ THEN BEGIN a20
  SAY @1356
IF ~Global("RR#ATTACKED_ARLED","GLOBAL",1)
Global("RR#ARLED_SECRET","GLOBAL",2)~ THEN REPLY @1357 GOTO RR#GaelArledKill2
IF ~Global("RR#ATTACKED_ARLED","GLOBAL",1)
Global("RR#ARLED_SECRET","GLOBAL",1)~ THEN REPLY @1358 DO ~SetGlobal("RR#ARLED_SECRET","GLOBAL",2)~ GOTO a16
IF ~Global("RR#ATTACKED_ARLED","GLOBAL",1)
Global("RR#ARLED_SECRET","GLOBAL",0)~ THEN REPLY @1359 GOTO RR#GaelArledKill1
IF ~Global("RR#ATTACKED_ARLED","GLOBAL",0)~ THEN REPLY @1360 GOTO RR#GaelArledKill2
IF ~CheckStatGT(LastTalkedToBy(Myself),13,CHR)
Global("RR#ATTACKED_ARLED","GLOBAL",1)~ THEN REPLY @1361 GOTO RR#GaelArledKill2
END


IF ~~ THEN BEGIN a21
  SAY @1363
IF ~~ THEN GOTO a18
END


IF ~~ THEN BEGIN a22
  SAY @1352
=
@1353
IF ~~ THEN DO ~SetGlobal("RR#ARLED_QUEST","GLOBAL",3)
GiveItemCreate("MISC41",Player1,1,1,1)
GiveItemCreate("MISC42",Player1,1,1,1)
GiveItemCreate("MISC43",Player1,1,1,1)
GiveItemCreate("MISC44",Player1,1,1,1)
EraseJournalEntry(@651)
EraseJournalEntry(@652)
EraseJournalEntry(@653)
EraseJournalEntry(@654)
EraseJournalEntry(@660)
EraseJournalEntry(@661)
EraseJournalEntry(@662)
EraseJournalEntry(@663)
EraseJournalEntry(@664)
EraseJournalEntry(@665)
EraseJournalEntry(@666)
AddXPObject(Player1,1000)
AddXPObject(Player2,1000)
AddXPObject(Player3,1000)
AddXPObject(Player4,1000)
AddXPObject(Player5,1000)
AddXPObject(Player6,1000)~ SOLVED_JOURNAL @672 EXIT
END

IF ~Global("Linvail","GLOBAL",1)
    Global("RR#ARLED_QUEST","GLOBAL",3)~ THEN BEGIN RR#G99
  SAY @1365
  IF ~~ THEN REPLY #21062 DO ~StartStore("arled",LastTalkedToBy(Myself))~ EXIT
  IF ~~ THEN REPLY #21353 EXIT
END

IF ~~ THEN BEGIN RR#G100
  SAY @1352
=
@1350
IF ~~ THEN DO ~SetGlobal("RR#ARLED_QUEST","GLOBAL",3)
GiveItemCreate("MISC41",Player1,1,1,1)
GiveItemCreate("MISC42",Player1,1,1,1)
GiveItemCreate("MISC43",Player1,1,1,1)
GiveItemCreate("MISC44",Player1,1,1,1)
EraseJournalEntry(@651)
EraseJournalEntry(@652)
EraseJournalEntry(@653)
EraseJournalEntry(@654)
EraseJournalEntry(@660)
EraseJournalEntry(@661)
EraseJournalEntry(@662)
EraseJournalEntry(@663)
EraseJournalEntry(@664)
EraseJournalEntry(@665)
EraseJournalEntry(@666)
AddXPObject(Player1,1000)
AddXPObject(Player2,1000)
AddXPObject(Player3,1000)
AddXPObject(Player4,1000)
AddXPObject(Player5,1000)
AddXPObject(Player6,1000)~ SOLVED_JOURNAL @670 EXIT
END
END

// Korgan and Viconia comment on Arledrian's death
CHAIN GAELAN RR#GaelArledKill1
@1362
== KORGANJ IF ~InParty("Korgan") InMyArea("Korgan") !StateCheck("Korgan",CD_STATE_NOTVALID)~ THEN @1522
== VICONIJ IF ~InParty("Viconia") InMyArea("Viconia") !StateCheck("Viconia",CD_STATE_NOTVALID)~ THEN @1523 END
IF ~~ THEN GOTO a21

CHAIN GAELAN RR#GaelArledKill2
@1354
== KORGANJ IF ~InParty("Korgan") InMyArea("Korgan") !StateCheck("Korgan",CD_STATE_NOTVALID)~ THEN @1522
== VICONIJ IF ~InParty("Viconia") InMyArea("Viconia") !StateCheck("Viconia",CD_STATE_NOTVALID)~ THEN @1523 END
IF ~~ THEN GOTO a18