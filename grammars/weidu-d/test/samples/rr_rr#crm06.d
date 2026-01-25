// creator  : aVENGER
// argument : WSMITH01.DLG

EXTEND_BOTTOM WSMITH01 13
  IF ~PartyHasItem("RR#STON")~ THEN GOTO RR#UPGD00
END
  
APPEND WSMITH01
  IF ~~ THEN BEGIN RR#UPGD00 SAY @6050
    IF ~PartyHasItem("RR#STON")
        !PartyHasItem("BOOK90")~ THEN GOTO RR#UPGD01
    IF ~PartyHasItem("RR#STON")
        PartyHasItem("BOOK90")~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @6051
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @6052
    IF ~PartyGoldLT(5000)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(4999)~ THEN REPLY #66664 DO ~SetGlobal("RR#Items","ar0334",6)
                                                 SetGlobal("ForgeStuff","GLOBAL",1)
                                                 TakePartyGold(5000)
                                                 TakePartyItemNum("RR#STON",1)
                                                 DestroyItem("RR#STON")
                                                 TakePartyItemNum("BOOK90",1)
                                                 DestroyItem("BOOK90")
                                                 DestroyGold(5000)~ GOTO 56
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @6003
   COPY_TRANS WSMITH01 13
  END
END