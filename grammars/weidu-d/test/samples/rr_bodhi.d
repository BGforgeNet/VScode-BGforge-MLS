// creator  aVENGER
// argument BODHI.DLG

ADD_TRANS_TRIGGER BODHI 31 ~CheckStatLT(Player1,25,LORE) CheckStatLT(Player1,13,INT) CheckStatLT(Player1,13,WIS) CheckStatLT(Player1,13,CHR)~

EXTEND_BOTTOM BODHI 31
  IF ~CheckStatGT(Player1,24,LORE)~ THEN REPLY  @725  GOTO RR#B2
  IF ~CheckStatGT(Player1,12,INT)~ THEN REPLY  @726  GOTO RR#B2
  IF ~CheckStatGT(Player1,12,WIS)~ THEN REPLY  @727  GOTO RR#B2
  IF ~CheckStatGT(Player1,12,CHR)~ THEN REPLY  @728  GOTO RR#B2
END

APPEND BODHI 
IF ~~ THEN BEGIN RR#B2
  SAY @735
  IF ~~ THEN GOTO 1
END
END

REPLACE_TRIGGER_TEXT ~BODHI~ ~NumDeadLT("Flyfgt",7)~ ~Global("RescuedPalern","GLOBAL",0)~
REPLACE_TRIGGER_TEXT ~BODHI~ ~NumDeadGT("Flyfgt",6)~ ~!Global("RescuedPalern","GLOBAL",0)~