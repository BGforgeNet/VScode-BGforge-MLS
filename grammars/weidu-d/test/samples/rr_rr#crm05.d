// creator  : aVENGER
// argument : WSMITH01.DLG

EXTEND_BOTTOM WSMITH01 13
  IF ~PartyHasItem("RR#RWARD")~ THEN GOTO RR#UPGD00
END
  
APPEND WSMITH01
  IF ~~ THEN BEGIN RR#UPGD00 SAY @6040
    IF ~PartyHasItem("RR#RWARD")
	OR(2)
          !PartyHasItem("DWDUST")
          !PartyHasItem("MISC45")~ THEN GOTO RR#UPGD01
    IF ~PartyHasItem("RR#RWARD")
        PartyHasItem("DWDUST")
        PartyHasItem("MISC45")~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @6041
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @6042
    IF ~PartyGoldLT(5000)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(4999)~ THEN REPLY #66664 DO ~SetGlobal("RR#Items","ar0334",5)
                                                 SetGlobal("ForgeStuff","GLOBAL",1)
                                                 TakePartyGold(5000)
                                                 TakePartyItemNum("RR#RWARD",1)
                                                 DestroyItem("RR#RWARD")
                                                 TakePartyItemNum("DWDUST",1)
                                                 DestroyItem("DWDUST")
                                                 TakePartyItemNum("MISC45",1)
                                                 DestroyItem("MISC45")
                                                 DestroyGold(5000)~ GOTO 56
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @6003
   COPY_TRANS WSMITH01 13
  END
END