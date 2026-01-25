// creator  : aVENGER
// argument : RR#STLN1.DLG

BEGIN ~RR#STLN1~

IF ~Global("RR#STLN","LOCALS",0)~ THEN BEGIN RR#STL50
SAY @9200
  IF ~CheckStatGT(LastTalkedToBy(Myself),11,INT)~ THEN REPLY  @9001  GOTO RR#STL02
  IF ~CheckStatGT(LastTalkedToBy(Myself),11,WIS)~ THEN REPLY  @9002  GOTO RR#STL02
  IF ~CheckStatGT(LastTalkedToBy(Myself),11,CHR)~ THEN REPLY  @9003  GOTO RR#STL02
  IF ~CheckStatGT(LastTalkedToBy(Myself),19,LORE)~ THEN REPLY  @9000  GOTO RR#STL02
  IF ~ReputationGT(LastTalkedToBy(Myself),13)~ THEN REPLY  @9004  GOTO RR#STL02
  IF ~ReputationLT(LastTalkedToBy(Myself),8)~ THEN REPLY  @9005  GOTO RR#STL02
  IF ~~ THEN REPLY @9050 GOTO RR#STL10
END

IF ~Global("RR#STLN","LOCALS",1)~ THEN BEGIN RR#STL51
SAY @9201
  IF ~CheckStatGT(LastTalkedToBy(Myself),14,INT)~ THEN REPLY  @9001  GOTO RR#STL03
  IF ~CheckStatGT(LastTalkedToBy(Myself),14,WIS)~ THEN REPLY  @9002  GOTO RR#STL03
  IF ~CheckStatGT(LastTalkedToBy(Myself),14,CHR)~ THEN REPLY  @9003  GOTO RR#STL03
  IF ~CheckStatGT(LastTalkedToBy(Myself),34,LORE)~ THEN REPLY  @9000  GOTO RR#STL03
  IF ~ReputationGT(LastTalkedToBy(Myself),16)~ THEN REPLY  @9004  GOTO RR#STL03
  IF ~ReputationLT(LastTalkedToBy(Myself),6)~ THEN REPLY  @9005  GOTO RR#STL03
  IF ~~ THEN REPLY @9050 GOTO RR#STL10
END

IF ~Global("RR#STLN","LOCALS",2)~ THEN BEGIN RR#STL52
SAY @9202
  IF ~CheckStatGT(LastTalkedToBy(Myself),17,INT)~ THEN REPLY  @9001  GOTO RR#STL04
  IF ~CheckStatGT(LastTalkedToBy(Myself),17,WIS)~ THEN REPLY  @9002  GOTO RR#STL04
  IF ~CheckStatGT(LastTalkedToBy(Myself),17,CHR)~ THEN REPLY  @9003  GOTO RR#STL04
  IF ~CheckStatGT(LastTalkedToBy(Myself),49,LORE)~ THEN REPLY  @9000  GOTO RR#STL04
  IF ~ReputationGT(LastTalkedToBy(Myself),19)~ THEN REPLY  @9004  GOTO RR#STL04
  IF ~ReputationLT(LastTalkedToBy(Myself),2)~ THEN REPLY  @9005  GOTO RR#STL04
  IF ~~ THEN REPLY @9050 GOTO RR#STL10
END

/*
 * Deduct a NumTimesTalkedTo() so we avoid screwing up the reliance on that check
 */

IF ~~ THEN BEGIN RR#STL02
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

IF ~~ THEN BEGIN RR#STL03
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

IF ~~ THEN BEGIN RR#STL04
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

IF ~~ THEN BEGIN RR#STL10
  SAY @9101
  IF ~~ THEN DO ~ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
END

IF ~GlobalGT("RR#STLN","LOCALS",2) GlobalLT("RR#STLN","LOCALS",10)~ THEN BEGIN RR#STL20
  SAY @9103
=
@9107
  IF ~~ THEN DO ~ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(11)~ DO ~SetNumTimesTalkedTo(10) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(10)~ DO ~SetNumTimesTalkedTo(9) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(9)~ DO ~SetNumTimesTalkedTo(8) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(8)~ DO ~SetNumTimesTalkedTo(7) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(7)~ DO ~SetNumTimesTalkedTo(6) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(6)~ DO ~SetNumTimesTalkedTo(5) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(5)~ DO ~SetNumTimesTalkedTo(4) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(4)~ DO ~SetNumTimesTalkedTo(3) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(3)~ DO ~SetNumTimesTalkedTo(2) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(2)~ DO ~SetNumTimesTalkedTo(1) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
  IF ~NumTimesTalkedTo(1)~ DO ~SetNumTimesTalkedTo(0) ReputationInc(-2) SetGlobal("RR#STLN","LOCALS",10) SetDialogue("RR#STLN0")~ EXIT
END

IF ~Global("RR#STLN","LOCALS",10)~ THEN BEGIN RR#STL21
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
