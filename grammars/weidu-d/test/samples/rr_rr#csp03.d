// creator  : aVENGER
// argument : BOTSMITH.DLG

EXTEND_BOTTOM BOTSMITH 4
  IF ~PartyHasItem("RR#SCAXE")~ THEN GOTO RR#UPGD00
END
  
APPEND BOTSMITH
  IF ~~ THEN BEGIN RR#UPGD00 SAY @7030
    IF ~PartyHasItem("RR#SCAXE")
	OR(2)
          !PartyHasItem("COMPON08")
          !PartyHasItem("RR#LAPIS")~ THEN GOTO RR#UPGD01
    IF ~PartyHasItem("RR#SCAXE")
        PartyHasItem("COMPON08")
        PartyHasItem("RR#LAPIS")~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @7031
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @7032
    IF ~PartyGoldLT(10000)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(9999)~ THEN REPLY #66664 DO ~SetGlobal("RR#TOBItems","GLOBAL",3)
                                                 SetGlobal("ImpForgeStuff","GLOBAL",1)
						 SetGlobal("RR#TOBCraft","GLOBAL",1)
                                                 TakePartyGold(10000)
                                                 DestroyGold(10000)
                                                 TakePartyItemNum("RR#SCAXE",1)
                                                 DestroyItem("RR#SCAXE")
                                                 TakePartyItemNum("COMPON08",1)
                                                 DestroyItem("COMPON08")
                                                 TakePartyItemNum("RR#LAPIS",1)
                                                 DestroyItem("RR#LAPIS")~ GOTO 11
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @7003
   COPY_TRANS BOTSMITH 4
  END
END