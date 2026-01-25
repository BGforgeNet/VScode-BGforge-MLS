// creator  : aVENGER
// argument : STGUARD1.DLG
// CreateCreature("MOOKFT02",[1469.1181],0) // Shadow Thief
REPLACE ~STGUARD1~

IF ~Global("WorkingForBodhi","GLOBAL",1)
~ THEN BEGIN 1 // from:
  SAY #21325 /* ~Ye've made quite th' mistake, showin' yer face around here!~ */
  IF ~~ THEN DO ~SetGlobal("StGuardAttack","AR0300",1)
CreateCreatureOffScreen("RR#STI01",0) // Shadow Thief
CreateCreatureOffScreen("RR#STI01",0) // Shadow Thief
CreateCreatureOffScreen("RR#STI01",0) // Shadow Thief
CreateCreatureOffScreen("RR#STI03",0) // Shadow Thief (ranged)
CreateCreatureOffScreen("RR#STI03",0) // Shadow Thief (ranged)
CreateCreatureOffScreen("RR#STI03",0) // Shadow Thief (ranged)
ChangeAIScript("",DEFAULT)
ChangeAIScript("",GENERAL)
ChangeAIScript("",RACE)
ChangeAIScript("",CLASS)
ChangeAIScript("RR#STF01",OVERRIDE)
Enemy()
UseItem("POTN10",Myself) // Potion of Invisibility
DisplayStringHead(Myself,46150) //  quaffs a potion
SetGlobalTimer("RR#Cast","LOCALS",6)~ EXIT
END
END