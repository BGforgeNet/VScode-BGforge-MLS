// creator  aVENGER
// argument FLAMEN.DLG

REPLACE_STATE_TRIGGER ~AMNCEN1~ 0 ~ReputationLT(Player1,10) GlobalLT("Chapter","GLOBAL",8)~
ALTER_TRANS ~AMNCEN1~ // file name
BEGIN 0 END // state number (can be more than one)
BEGIN 0 END // transition number (can be more than one)
BEGIN // list of changes, see below for flags
  "ACTION" ~Shout(1) Enemy()~
END

APPEND ~AMNCEN1~

IF ~ReputationLT(Player1,10) GlobalGT("Chapter","GLOBAL",7)~ THEN BEGIN RR#INTOB
  SAY #71641 // Looting will not be permitted!  Looters shall be executed!!
  IF ~~ THEN DO ~Shout(1) Enemy()~ EXIT
END

IF ~ReputationGT(Player1,9)~ THEN BEGIN RR#INSOA
  SAY @9819 // Stop where you are, thief! You are under arrest for robbery.
  IF ~CheckStatGT(LastTalkedToBy(Myself),9,CHR)~ THEN REPLY  @9800  GOTO RR#00 // \[Charisma\] - This is simply a misunderstanding, I assure you. I will gladly pay the appropriate fine and resolve this issue peacefully.
  IF ~ReputationGT(LastTalkedToBy(Myself),9)~ THEN REPLY  @9801  GOTO RR#01 // \[Reputation\] - My sincere apologies, officer. As an upstanding citizen, I would prefer to pay the appropriate fine and settle this matter in a civilized manner.
  IF ~~ THEN REPLY  @9810  GOTO RR#22 // You'll never take me alive!
END

IF ~~ THEN BEGIN RR#00
  SAY @9820 // Well now, according to the rule book, the appropriate fine for this misbehavior would be...
  IF ~CheckStatGT(LastTalkedToBy(Myself),9,CHR) CheckStatLT(LastTalkedToBy(Myself),12,CHR)~ THEN GOTO RR#10 // 1500 gold pieces.
  IF ~CheckStatGT(LastTalkedToBy(Myself),11,CHR) CheckStatLT(LastTalkedToBy(Myself),14,CHR)~ THEN GOTO RR#11 // 1000 gold pieces.
  IF ~CheckStatGT(LastTalkedToBy(Myself),13,CHR) CheckStatLT(LastTalkedToBy(Myself),16,CHR)~ THEN GOTO RR#12 // 750 gold pieces.
  IF ~CheckStatGT(LastTalkedToBy(Myself),15,CHR) CheckStatLT(LastTalkedToBy(Myself),18,CHR)~ THEN GOTO RR#13 // 500 gold pieces.
  IF ~CheckStatGT(LastTalkedToBy(Myself),17,CHR)~ THEN GOTO RR#14 // 250 gold pieces.
END

IF ~~ THEN BEGIN RR#01
  SAY @9820 // Well now, according to the rule book, the appropriate fine for this misbehavior would be...
  IF ~ReputationGT(LastTalkedToBy(Myself),9) ReputationLT(LastTalkedToBy(Myself),12)~ THEN GOTO RR#10 // 1500 gold pieces.
  IF ~ReputationGT(LastTalkedToBy(Myself),11) ReputationLT(LastTalkedToBy(Myself),14)~ THEN GOTO RR#11 // 1000 gold pieces.
  IF ~ReputationGT(LastTalkedToBy(Myself),13) ReputationLT(LastTalkedToBy(Myself),16)~ THEN GOTO RR#12 // 750 gold pieces.
  IF ~ReputationGT(LastTalkedToBy(Myself),15) ReputationLT(LastTalkedToBy(Myself),18)~ THEN GOTO RR#13 // 500 gold pieces.
  IF ~ReputationGT(LastTalkedToBy(Myself),17)~ THEN GOTO RR#14 // 250 gold pieces.
END

IF ~~ THEN BEGIN RR#10
  SAY @9821 // 1500 gold pieces.
  IF ~PartyGoldGT(1499)~ THEN REPLY @9840 DO ~TakePartyGold(1500)~ GOTO RR#20 // Alright, I will pay.
  IF ~~ THEN REPLY @9841 GOTO RR#21 // I don't have that much gold.
  IF ~~ THEN REPLY @9842 GOTO RR#22 // Not a chance! I'm not giving you anything.
END

IF ~~ THEN BEGIN RR#11
  SAY @9822 // 1000 gold pieces.
  IF ~PartyGoldGT(999)~ THEN REPLY @9840 DO ~TakePartyGold(1000)~ GOTO RR#20 // Alright, I will pay.
  IF ~~ THEN REPLY @9841 GOTO RR#21 // I don't have that much gold.
  IF ~~ THEN REPLY @9842 GOTO RR#22 // Not a chance! I'm not giving you anything.
END

IF ~~ THEN BEGIN RR#12
  SAY @9823 // 750 gold pieces.
  IF ~PartyGoldGT(749)~ THEN REPLY @9840 DO ~TakePartyGold(750)~ GOTO RR#20 // Alright, I will pay.
  IF ~~ THEN REPLY @9841 GOTO RR#21 // I don't have that much gold.
  IF ~~ THEN REPLY @9842 GOTO RR#22 // Not a chance! I'm not giving you anything.
END

IF ~~ THEN BEGIN RR#13
  SAY @9824 // 500 gold pieces.
  IF ~PartyGoldGT(499)~ THEN REPLY @9840 DO ~TakePartyGold(500)~ GOTO RR#20 // Alright, I will pay.
  IF ~~ THEN REPLY @9841 GOTO RR#21 // I don't have that much gold.
  IF ~~ THEN REPLY @9842 GOTO RR#22 // Not a chance! I'm not giving you anything.
END

IF ~~ THEN BEGIN RR#14
  SAY @9825 // 250 gold pieces.
  IF ~PartyGoldGT(249)~ THEN REPLY @9840 DO ~TakePartyGold(250)~ GOTO RR#20 // Alright, I will pay.
  IF ~~ THEN REPLY @9841 GOTO RR#21 // I don't have that much gold.
  IF ~~ THEN REPLY @9842 GOTO RR#22 // Not a chance! I'm not giving you anything.
END

IF ~~ THEN BEGIN RR#20
  SAY @9850 // Thank you for your cooperation.
  IF ~~ THEN DO ~Shout(2) Wait(1) EscapeArea()~ EXIT
END

IF ~~ THEN BEGIN RR#21
  SAY @9851 // In that case, I must confiscate all of your belongings instead.
  IF ~~ THEN REPLY @9843 DO ~ActionOverride(LastTalkedToBy(Myself),DestroyAllEquipment())~ GOTO RR#20 // Fine, you can have all of my possessions.
  IF ~~ THEN REPLY @9842 GOTO RR#22 // Not a chance! I'm not giving you anything.
END

IF ~~ THEN BEGIN RR#22
  SAY @9852 // Resisting arrest? To arms then!
  IF ~~ THEN DO ~Shout(1) Enemy()~ EXIT
END
END