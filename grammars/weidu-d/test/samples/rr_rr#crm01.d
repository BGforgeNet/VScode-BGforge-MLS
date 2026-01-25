// creator  : aVENGER
// argument : WSMITH01.DLG

EXTEND_BOTTOM WSMITH01 13
  IF ~PartyHasItem("RR#BUC01")~ THEN GOTO RR#UPGD00
END
  
APPEND WSMITH01
  IF ~~ THEN BEGIN RR#UPGD00 SAY @6000
    IF ~PartyHasItem("RR#BUC01")
        !PartyHasItem("KEY23")~ THEN GOTO RR#UPGD01
    IF ~PartyHasItem("RR#BUC01")
        PartyHasItem("KEY23")~ THEN GOTO RR#UPGD02
  END
  
  IF ~~ THEN BEGIN RR#UPGD01 SAY @6001
    IF ~~ THEN GOTO RR#NOTNX
  END
  
  IF ~~ THEN BEGIN RR#UPGD02 SAY @6002
    IF ~PartyGoldLT(7500)~ THEN REPLY #66662 GOTO RR#NOTNX
    IF ~PartyGoldGT(7499)~ THEN REPLY #66664 DO ~SetGlobal("RR#Items","ar0334",1)
                                                 SetGlobal("ForgeStuff","GLOBAL",1)
                                                 TakePartyGold(7500)
                                                 TakePartyItemNum("RR#BUC01",1)
                                                 DestroyItem("RR#BUC01")
                                                 TakePartyItemNum("KEY23",1)
                                                 DestroyItem("KEY23")
                                                 DestroyGold(7500)~ GOTO 56
    IF ~~ THEN REPLY #66770 GOTO RR#NOTNX
  END

  IF WEIGHT #-1 ~GlobalGT("RR#Craft","ar0334",0)~ THEN BEGIN RR#CRAFT SAY #59797
    IF ~~ THEN DO ~SetGlobal("RR#Craft","ar0334",0)~ EXIT
  END

  IF ~~ THEN BEGIN RR#NOTNX SAY @6003
   COPY_TRANS WSMITH01 13
  END
END