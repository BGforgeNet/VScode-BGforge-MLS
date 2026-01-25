// creator  : aVENGER
// argument : WSMITH01.DLG

EXTEND_BOTTOM WSMITH01 13
  IF ~PartyHasItem("RR#FDART")~ THEN GOTO RR#UPGD00
END
  
APPEND WSMITH01
  IF ~~ THEN BEGIN RR#UPGD00 SAY @6010
    IF ~PartyHasItem("RR#FDART")
        !PartyHasItem("MISCAL")~ THEN GOTO RR#UPGD01
    IF ~PartyHasItem("RR#FDART")
        PartyHasItem("MISCAL")~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @6011
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @6012
    IF ~PartyGoldLT(5000)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(4999)~ THEN REPLY #66664 DO ~SetGlobal("RR#Items","ar0334",2)
                                                 SetGlobal("ForgeStuff","GLOBAL",1)
                                                 TakePartyGold(5000)
                                                 TakePartyItemNum("RR#FDART",1)
                                                 DestroyItem("RR#FDART")
                                                 TakePartyItemNum("MISCAL",1)
                                                 DestroyItem("MISCAL")
                                                 DestroyGold(5000)~ GOTO 56
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @6003
   COPY_TRANS WSMITH01 13
  END
END