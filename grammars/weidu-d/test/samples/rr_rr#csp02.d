// creator  : aVENGER
// argument : BOTSMITH.DLG

EXTEND_BOTTOM BOTSMITH 4
  IF ~OR(2)
        PartyHasItem("RR#STON")
        PartyHasItem("RR#STON2")~ THEN GOTO RR#UPGD00
END
  
APPEND BOTSMITH
  IF ~~ THEN BEGIN RR#UPGD00 SAY @7020
    IF ~OR(2)
        PartyHasItem("RR#STON")
        PartyHasItem("RR#STON2")
        !PartyHasItem("TOME03")~ THEN GOTO RR#UPGD01
    IF ~OR(2)
        PartyHasItem("RR#STON")
        PartyHasItem("RR#STON2")
        PartyHasItem("TOME03")~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @7021
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @7022
    IF ~PartyGoldLT(5000)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(4999)~ THEN REPLY #66664 DO ~SetGlobal("RR#TOBItems","GLOBAL",2)
                                                 SetGlobal("ImpForgeStuff","GLOBAL",1)
						 SetGlobal("RR#TOBCraft","GLOBAL",1)
                                                 TakePartyGold(5000)
                                                 DestroyGold(5000)
                                                 TakePartyItemNum("RR#STON",1)
                                                 DestroyItem("RR#STON")
                                                 TakePartyItemNum("RR#STON2",1)
                                                 DestroyItem("RR#STON2")
                                                 TakePartyItemNum("TOME03",1)
                                                 DestroyItem("TOME03")~ GOTO 11
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @7003
   COPY_TRANS BOTSMITH 4
  END
END