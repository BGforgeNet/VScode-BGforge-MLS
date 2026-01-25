// creator  : aVENGER
// argument : RR#PICKP.DLG

BEGIN ~RR#PICKP~

IF ~Global("RR#STLN","LOCALS",0)~ THEN BEGIN RR#PP50
SAY @9700
  IF ~CheckStatGT(LastTrigger,11,INT)~ THEN REPLY  @9501  GOTO RR#PP02
  IF ~CheckStatGT(LastTrigger,11,WIS)~ THEN REPLY  @9502  GOTO RR#PP02
  IF ~CheckStatGT(LastTrigger,11,CHR)~ THEN REPLY  @9503  GOTO RR#PP02
  IF ~CheckStatGT(LastTrigger,19,LORE)~ THEN REPLY  @9500  GOTO RR#PP02
  IF ~ReputationGT(LastTrigger,13)~ THEN REPLY  @9504  GOTO RR#PP02
  IF ~ReputationLT(LastTrigger,8)~ THEN REPLY  @9505  GOTO RR#PP02
  IF ~~ THEN REPLY @9050 GOTO RR#PP10
END

IF ~Global("RR#STLN","LOCALS",1)~ THEN BEGIN RR#PP51
SAY @9201
  IF ~CheckStatGT(LastTrigger,14,INT)~ THEN REPLY  @9501  GOTO RR#PP03
  IF ~CheckStatGT(LastTrigger,14,WIS)~ THEN REPLY  @9502  GOTO RR#PP03
  IF ~CheckStatGT(LastTrigger,14,CHR)~ THEN REPLY  @9503  GOTO RR#PP03
  IF ~CheckStatGT(LastTrigger,34,LORE)~ THEN REPLY  @9500  GOTO RR#PP03
  IF ~ReputationGT(LastTrigger,16)~ THEN REPLY  @9504  GOTO RR#PP03
  IF ~ReputationLT(LastTrigger,6)~ THEN REPLY  @9505  GOTO RR#PP03
  IF ~~ THEN REPLY @9050 GOTO RR#PP10
END

IF ~Global("RR#STLN","LOCALS",2)~ THEN BEGIN RR#PP52
SAY @9702
  IF ~CheckStatGT(LastTrigger,17,INT)~ THEN REPLY  @9501  GOTO RR#PP04
  IF ~CheckStatGT(LastTrigger,17,WIS)~ THEN REPLY  @9502  GOTO RR#PP04
  IF ~CheckStatGT(LastTrigger,17,CHR)~ THEN REPLY  @9503  GOTO RR#PP04
  IF ~CheckStatGT(LastTrigger,49,LORE)~ THEN REPLY  @9500  GOTO RR#PP04
  IF ~ReputationGT(LastTrigger,19)~ THEN REPLY  @9504  GOTO RR#PP04
  IF ~ReputationLT(LastTrigger,2)~ THEN REPLY  @9505  GOTO RR#PP04
  IF ~~ THEN REPLY @9050 GOTO RR#PP10
END

/*
 * Deduct a NumTimesTalkedTo() so we avoid screwing up the reliance on that check
 */

IF ~~ THEN BEGIN RR#PP02
  SAY @9100
=
@9104
  IF ~~ THEN DO ~IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
END

IF ~~ THEN BEGIN RR#PP03
  SAY @9105
  IF ~~ THEN DO ~IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
END

IF ~~ THEN BEGIN RR#PP04
  SAY @9106
  IF ~~ THEN DO ~IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) IncrementGlobal("RR#STLN","LOCALS",1)~ EXIT
END

IF ~~ THEN BEGIN RR#PP10
  SAY @9101
  IF ~~ THEN DO ~ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
END

IF ~GlobalGT("RR#STLN","LOCALS",2) GlobalLT("RR#STLN","LOCALS",10)~ THEN BEGIN RR#PP20
  SAY @9103
=
@9107
  IF ~~ THEN DO ~ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#PPF0")~ EXIT
END

IF ~Global("RR#STLN","LOCALS",10)~ THEN BEGIN RR#PP21
  SAY @9603
  IF ~~ THEN DO ~ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) ReputationInc(-2)~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) ReputationInc(-2)~ EXIT
END
