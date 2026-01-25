// creator  : aVENGER
// argument : BOTSMITH.DLG

EXTEND_BOTTOM BOTSMITH 4
  IF ~PartyHasItem("RR#BEL01")~ THEN GOTO RR#UPGD00
END
  
APPEND BOTSMITH
  IF ~~ THEN BEGIN RR#UPGD00 SAY @7000
    IF ~PartyHasItem("RR#BEL01")
	OR(2)
          !PartyHasItem("SCRL93")
          !PartyHasItem("POTN36")~ THEN GOTO RR#UPGD01
    IF ~PartyHasItem("RR#BEL01")
        PartyHasItem("SCRL93")
        PartyHasItem("POTN36")~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @7001
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @7002
    IF ~PartyGoldLT(5000)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(4999)~ THEN REPLY #66664 DO ~SetGlobal("RR#TOBItems","GLOBAL",1)
                                                 SetGlobal("ImpForgeStuff","GLOBAL",1)
						 SetGlobal("RR#TOBCraft","GLOBAL",1)
                                                 TakePartyGold(5000)
                                                 DestroyGold(5000)
                                                 TakePartyItemNum("RR#BEL01",1)
                                                 DestroyItem("RR#BEL01")
                                                 TakePartyItemNum("SCRL93",1)
                                                 DestroyItem("SCRL93")
                                                 TakePartyItemNum("POTN36",1)
                                                 DestroyItem("POTN36")~ GOTO 11
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF WEIGHT #-1 ~GlobalGT("RR#TOBCraft","GLOBAL",0)~ THEN BEGIN RR#CRAFT SAY #70888
   IF ~~ THEN DO ~SetGlobal("RR#TOBCraft","GLOBAL",0)~ EXIT
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @7003
   COPY_TRANS BOTSMITH 4
  END
END