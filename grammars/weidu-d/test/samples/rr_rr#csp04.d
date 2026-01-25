// creator  : aVENGER
// argument : BOTSMITH.DLG

EXTEND_BOTTOM BOTSMITH 4
  IF ~PartyHasItem("SW1H10")~ THEN GOTO RR#UPGD00
END
  
APPEND BOTSMITH
  IF ~~ THEN BEGIN RR#UPGD00 SAY @7040
    IF ~PartyHasItem("SW1H10")
        NumItemsPartyLT("MISC45",5)~ THEN GOTO RR#UPGD01
    IF ~PartyHasItem("SW1H10")
        NumItemsPartyGT("MISC45",4)~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @7041
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @7042
    IF ~PartyGoldLT(10000)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(9999)~ THEN REPLY #66664 DO ~SetGlobal("RR#TOBItems","GLOBAL",4)
                                                 SetGlobal("ImpForgeStuff","GLOBAL",1)
						 SetGlobal("RR#TOBCraft","GLOBAL",1)
                                                 TakePartyGold(10000)
                                                 DestroyGold(10000)
                                                 TakePartyItemNum("SW1H10",1)
                                                 DestroyItem("SW1H10")
                                                 TakePartyItemNum("MISC45",5)
                                                 DestroyItem("MISC45")
                                                 DestroyItem("MISC45")
                                                 DestroyItem("MISC45")
                                                 DestroyItem("MISC45")
                                                 DestroyItem("MISC45")~ GOTO 11
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @7003
   COPY_TRANS BOTSMITH 4
  END
END