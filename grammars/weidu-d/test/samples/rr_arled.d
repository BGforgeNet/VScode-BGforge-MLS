// creator  : aVENGER
// argument : ARLED.DLG

ADD_STATE_TRIGGER ~ARLED~ 0 ~!AreaCheck("AR0801") Global("WorkingForBodhi","GLOBAL",0)~
ADD_STATE_TRIGGER ~ARLED~ 1 ~!AreaCheck("AR0801") Global("WorkingForBodhi","GLOBAL",0)~


// Dialogue options for stealing the Slverblaze dagger

EXTEND_BOTTOM ~ARLED~ 1 
  IF ~Global("RR#SB_STOLEN","GLOBAL",0)
      OR(2)
      CheckStatGT(LastTalkedToBy(Myself),11,INT)
      CheckStatGT(LastTalkedToBy(Myself),11,WIS)~ THEN REPLY @1100 GOTO 10a
  IF ~Global("RR#SB_STOLEN","GLOBAL",1)
      OR(2)
      CheckStatGT(LastTalkedToBy(Myself),11,INT)
      CheckStatGT(LastTalkedToBy(Myself),11,WIS)~ THEN REPLY @1100 GOTO 10b
END


// Bioware NPC Interjections

// Aerie heals Arledrian
APPEND AERIEJ
  IF ~~ THEN BEGIN RR#AerieHealsArled
    SAY @1524 = @1525 = @1526 = @1527 = @1528
    IF ~~ THEN EXTERN ARLED 32d
  END
END

// Jaheira heals Arledrian
APPEND JAHEIRAJ 
  IF ~~ THEN BEGIN RR#JaheiraHealsArled
    SAY @1529 = @1530 = @1531 = @1527 = @1532
    IF ~~ THEN EXTERN ARLED 32d
  END
END

// Anomen heals Arledrian
APPEND ANOMENJ
  IF ~~ THEN BEGIN RR#AnomenHealsArled
    SAY @1533 = @1534 = @1535 = @1527 = @1536
    IF ~~ THEN EXTERN ARLED 32d
  END
END

APPEND ARLED

IF ~~ THEN BEGIN 10a
SAY @1101
=
@1102
=
@1103

IF ~~ THEN REPLY @1104 GOTO 11a
IF ~OR(2)
    Class(LastTalkedToBy(Myself),BARD_ALL)
    Class(LastTalkedToBy(Myself),THIEF_ALL)
    CheckStatLT(LastTalkedToBy(Myself),125,PICKPOCKET)
    OR(2)
    CheckStatGT(LastTalkedToBy(Myself),13,INT)
    CheckStatGT(LastTalkedToBy(Myself),13,WIS)~ THEN REPLY @1105 EXIT

IF ~OR(2)
    Class(LastTalkedToBy(Myself),BARD_ALL)
    Class(LastTalkedToBy(Myself),THIEF_ALL)
    CheckStatLT(LastTalkedToBy(Myself),125,PICKPOCKET)~ THEN REPLY @1106 GOTO 12b

IF ~OR(2)
    Class(LastTalkedToBy(Myself),BARD_ALL)
    Class(LastTalkedToBy(Myself),THIEF_ALL)
    CheckStatGT(LastTalkedToBy(Myself),124,PICKPOCKET)~ THEN REPLY @1106 GOTO 12a
END


IF ~~ THEN BEGIN 10b
SAY @1101
=
@1107

IF ~OR(2)
    Class(LastTalkedToBy(Myself),BARD_ALL)
    Class(LastTalkedToBy(Myself),THIEF_ALL)
    CheckStatGT(LastTalkedToBy(Myself),149,PICKPOCKET)~ THEN REPLY @1106 GOTO 12a

IF ~OR(2)
    Class(LastTalkedToBy(Myself),BARD_ALL)
    Class(LastTalkedToBy(Myself),THIEF_ALL)
    CheckStatLT(LastTalkedToBy(Myself),150,PICKPOCKET)~ THEN REPLY @1108 EXIT
END


IF ~~ THEN BEGIN 11a
SAY @1109
=
@1110
=
@1111
=
@1112
IF ~~ THEN REPLY @1113 DO ~StartStore("arled",LastTalkedToBy())~ EXIT
IF ~~ THEN REPLY @1114 EXIT
END



IF ~~ THEN BEGIN 12a
SAY @1115
=
@1116
=
@1117
=
@1118
IF ~~ THEN REPLY @1119 DO ~GiveItem("RR#SILV",LastTalkedToBy(Myself))
SetGlobal("RR#SB_STOLEN","GLOBAL",2)~ EXIT
END


IF ~~ THEN BEGIN 12b
SAY @1120
=
@1121
=
@1122
=
@1123
IF ~CheckStatGT(LastTalkedToBy(Myself),13,CHR)~ THEN REPLY @1124 DO ~SetGlobal("RR#SB_STOLEN","GLOBAL",1)~ GOTO 13a
IF ~~ THEN REPLY @1125 DO ~SetGlobal("RR#SB_STOLEN","GLOBAL",1)~ GOTO 13b
END


IF ~~ THEN BEGIN 13a
SAY @1126
=
@1127
=
@1128
=
@1129
IF ~~ THEN REPLY @1130 EXIT
IF ~~ THEN REPLY @1131 EXIT
END

IF ~~ THEN BEGIN 13b
SAY @1132
=
@1133
=
@1134
IF ~~ THEN REPLY @1135 GOTO 14a
IF ~~ THEN REPLY @1136 GOTO 13a
END



IF ~~ THEN BEGIN 14a
SAY @1137
=
@1138
= 
@1139
=
@1140
=
@1141 
=
@1142
IF ~PartyGoldGT(499)~ THEN REPLY @1143 GOTO 15a
IF ~PartyGoldLT(500)~ THEN REPLY @1144 GOTO 15b
IF ~PartyGoldGT(499)~ THEN REPLY @1145 GOTO 15b
END



IF ~~ THEN BEGIN 15a
SAY @1146
IF ~~ THEN DO ~TakePartyGold(500)~ EXIT
END

IF ~~ THEN BEGIN 15b
SAY @1147
=
@1148
=
@1149
IF ~~ THEN DO ~TakePartyGold(1000)~ EXIT
END


IF ~~ THEN BEGIN 31a
SAY @1150
=
@1151
=
@1152
IF ~Class(LastTalkedToBy(Myself),PALADIN_ALL) !Kit(LastTalkedToBy(Myself),INQUISITOR) !Kit(LastTalkedToBy(Myself),UNDEADHUNTER) HaveSpellParty(PALADIN_LAY_ON_HANDS)~ THEN REPLY @1153 GOTO 32d
IF ~OR(4)
Class(LastTalkedToBy(Myself),CLERIC_ALL)
Class(LastTalkedToBy(Myself),DRUID_ALL)
Class(LastTalkedToBy(Myself),PALADIN_ALL)
Class(LastTalkedToBy(Myself),RANGER_ALL)
OR(7)
HaveSpellParty(3101)
HaveSpellParty(CLERIC_CURE_LIGHT_WOUNDS)
HaveSpellParty(CLERIC_CURE_MEDIUM_WOUNDS)
HaveSpellParty(CLERIC_CURE_SERIOUS_WOUNDS)
HaveSpellParty(CLERIC_CURE_CRITICAL_WOUNDS)
HaveSpellParty(CLERIC_MASS_CURE)
HaveSpellParty(CLERIC_HEAL)~ THEN REPLY @1154 DO ~IncrementGlobal("RR#HELPED_ARLED","GLOBAL",1)~ GOTO 32d
IF ~!Class(LastTalkedToBy(Myself),CLERIC_ALL)
!Class(LastTalkedToBy(Myself),DRUID_ALL)
!Class(LastTalkedToBy(Myself),PALADIN_ALL)
!Class(LastTalkedToBy(Myself),RANGER_ALL)
HaveSpellParty(3101)~ THEN REPLY @1154 GOTO 32d
IF ~PartyHasItem("POTN08")
!PartyHasItem("POTN52")~ THEN REPLY @1155 DO ~TakePartyItemNum("POTN08",1)
IncrementGlobal("RR#HEPED_ARLED","GLOBAL",1)
ReputationInc(1)
DestroyItem("POTN08")~ GOTO 32a
IF ~PartyHasItem("POTN52")~ THEN REPLY @1156 DO ~TakePartyItemNum("POTN52",1)
IncrementGlobal("RR#HELPED_ARLED","GLOBAL",1)
ReputationInc(1)
DestroyItem("POTN52")~ GOTO 32a
IF ~PartyHasItem("POTN26")
!Alignment(Player1,MASK_GOOD)~ THEN REPLY @1157 GOTO RR#ArledIncinerated1
IF ~PartyHasItem("POTN13")
!Alignment(Player1,MASK_GOOD)~ THEN REPLY @1158 GOTO RR#ArledIncinerated2
IF ~~ THEN REPLY @1159 GOTO 32b
END

IF ~~ THEN BEGIN 31b
SAY @1160
IF ~~ THEN DO ~TakePartyItemNum("POTN26",1)
ReputationInc(-2)
SetGlobal("RR#ATTACKED_ARLED","GLOBAL",1)
SetGlobal("RR#INCINERATE_ARLED","GLOBAL",1)~ UNSOLVED_JOURNAL @665 EXIT
END

IF ~~ THEN BEGIN 31c
SAY @1161
IF ~~ THEN DO ~TakePartyItemNum("POTN13",1)
ReputationInc(-2)
SetGlobal("RR#ATTACKED_ARLED","GLOBAL",1)
SetGlobal("RR#INCINERATE_ARLED","GLOBAL",1)~ UNSOLVED_JOURNAL @665 EXIT
END

IF ~~ THEN BEGIN 32a
SAY @1162
=
@1163
=
@1164
=
@1165
IF ~OR(2)
Global("RR#ARLED_JOURNAL","GLOBAL",5)
GlobalGT("RR#ARLED_SECRET","GLOBAL",0)~ THEN REPLY @1166 GOTO 33a
IF ~!Global("RR#ARLED_JOURNAL","GLOBAL",5)
Global("RR#ARLED_SECRET","GLOBAL",0)~ THEN REPLY @1167 GOTO 34a
END

IF ~~ THEN BEGIN 32b
SAY @1168
IF ~~ THEN GOTO 32c
IF ~InParty("Aerie") InMyArea("Aerie") !StateCheck("Aerie",CD_STATE_NOTVALID)~ THEN EXTERN AERIEJ RR#AerieHealsArled
IF ~InParty("Jaheira") InMyArea("Jaheira") !StateCheck("Jaheira",CD_STATE_NOTVALID)~ THEN EXTERN JAHEIRAJ RR#JaheiraHealsArled
IF ~InParty("Anomen") InMyArea("Anomen") !StateCheck("Anomen",CD_STATE_NOTVALID)~ THEN EXTERN ANOMENJ RR#AnomenHealsArled
END

IF ~~ THEN BEGIN 32c
SAY @1169
=
@1170
IF ~~ THEN DO ~Kill(Myself)~ EXIT
END

IF ~~ THEN BEGIN 32d
SAY @1171
=
@1172
IF ~~ THEN DO ~IncrementGlobal("RR#HELPED_ARLED","GLOBAL",1)
ReputationInc(1)~ GOTO 32e
END

IF ~~ THEN BEGIN 32e
SAY @1163
=
@1164
=
@1165

IF ~OR(2)
Global("RR#ARLED_JOURNAL","GLOBAL",5)
GlobalGT("RR#ARLED_SECRET","GLOBAL",0)~ THEN REPLY @1173 GOTO 33a
IF ~!Global("RR#ARLED_JOURNAL","GLOBAL",5)
Global("RR#ARLED_SECRET","GLOBAL",0)~ THEN REPLY @1167 GOTO 34a
END

IF ~~ THEN BEGIN 33a
SAY @1174
IF ~OR(2)
PartyHasItem("RR#BK01")
PartyHasItem("RR#BK02")~ THEN REPLY @1175 DO ~TakePartyItem("RR#BK01")
TakePartyItem("RR#BK02")
DestroyItem("RR#BK01")
DestroyItem("RR#BK02")~ GOTO 34b
IF ~OR(2)
PartyHasItem("RR#BK01")
PartyHasItem("RR#BK02")~ THEN REPLY @1176 DO ~TakePartyItem("RR#BK01")
TakePartyItem("RR#BK02")
DestroyItem("RR#BK01")
DestroyItem("RR#BK02")~ GOTO 34b
IF ~!PartyHasItem("RR#BK01")
!PartyHasItem("RR#BK02")~ THEN REPLY @1177 GOTO 34b
IF ~!PartyHasItem("RR#BK01")
!PartyHasItem("RR#BK02")~ THEN REPLY @1178 GOTO 34b
IF ~Global("RR#ARLED_JOURNAL","GLOBAL",5)
PartyHasItem("RR#BK03")~ THEN REPLY @1179 DO ~TakePartyItem("RR#BK03")
DestroyItem("RR#BK03")~ GOTO 34a
IF ~Global("RR#ARLED_JOURNAL","GLOBAL",5)
!PartyHasItem("RR#BK03")~ THEN REPLY @1180 GOTO 34a
END

IF ~~ THEN BEGIN 34a
SAY @1181
=
@1182
=
@1183
=
@1184
IF ~~ THEN DO ~SetGlobal("RR#ARLED_RUN","LOCALS",1)
SetGlobalTimer("RR#ARLED_ESCAPE","LOCALS",6)~ EXIT
END

IF ~~ THEN BEGIN 34b
SAY @1185
=
@1186
IF ~~ THEN REPLY @1187 GOTO 35a
IF ~~ THEN REPLY @1188 GOTO 35b
END

IF ~~ THEN BEGIN 35a
SAY @1189
=
@1190
=
@1191
IF ~Global("AranJob","GLOBAL",3)
GlobalGT("RR#HELPED_ARLED","GLOBAL",1)
GlobalLT("RR#SB_STOLEN","GLOBAL",2)~ THEN REPLY @1192 GOTO 36a
IF ~GlobalGT("RR#HELPED_ARLED","GLOBAL",1) GlobalLT("RR#SB_STOLEN","GLOBAL",2)~ THEN REPLY @1193 GOTO 36a
IF ~Global("AranJob","GLOBAL",3)
OR(2)
GlobalLT("RR#HELPED_ARLED","GLOBAL",2)
Global("RR#SB_STOLEN","GLOBAL",2)~ THEN REPLY @1192 GOTO 36b
IF ~OR(2)
GlobalLT("RR#HELPED_ARLED","GLOBAL",2)
Global("RR#SB_STOLEN","GLOBAL",2)~ THEN REPLY @1193 GOTO 36b
END

IF ~~ THEN BEGIN 35b
SAY @1194
=
@1195
IF ~~ THEN REPLY @1196 GOTO 35c
IF ~~ THEN REPLY @1197 GOTO 35a
END

IF ~~ THEN BEGIN 35c
SAY @1198
=
@1199
IF ~~ THEN REPLY @1200 DO ~GivePartyAllEquipment()~ GOTO 35d
IF ~~ THEN REPLY @1201 DO ~GivePartyAllEquipment()~ GOTO 35d
END

IF ~~ THEN BEGIN 35d
SAY @1202
IF ~~ THEN DO ~SetGlobal("RR#ARLED_RUN","LOCALS",1)
SetGlobalTimer("RR#ARLED_ESCAPE","LOCALS",5)~ EXIT
END

IF ~~ THEN BEGIN 36a
SAY @1203
=
@1204
=
@1205
=
@1206
=
@1207
=
@1183
IF ~~ THEN DO ~GiveItem("RR#SILV",Player1)
SetGlobal("RR#ARLED_RUN","LOCALS",1)
SetGlobalTimer("RR#ARLED_ESCAPE","LOCALS",5)~ EXIT
END

IF ~~ THEN BEGIN 36b
SAY @1208
=
@1209
=
@1210
=
@1183
IF ~~ THEN DO ~SetGlobal("RR#ARLED_RUN","LOCALS",1)
SetGlobalTimer("RR#ARLED_ESCAPE","LOCALS",5)~ EXIT
END


IF ~Global("WorkingForBodhi","GLOBAL",1)
    !Race(Player1,ELF)
    !Race(Player1,HALF_ELF)~ THEN BEGIN 20a
SAY @1211
=
@1212
IF ~~ THEN DO ~SetGlobal("RR#ArledAttacks","GLOBAL",1)
		Enemy()~ EXIT
END

IF ~Global("WorkingForBodhi","GLOBAL",1)
    OR(2)
    Race(Player1,ELF)
    Race(Player1,HALF_ELF)~ THEN BEGIN 20b
SAY @1211
=
@1213
=
@1214
=
@1215
=
@1216
=
@1217
=
@1218
IF ~~ THEN DO ~SetGlobal("RR#ArledAttacks","GLOBAL",1)
		ChangeEnemyAlly(Myself,NEUTRAL)
		UseItem("POTN10",Myself) // Potion of Invisibility
		DisplayStringHead(Myself,46150) //  quaffs a potion
		EscapeArea()~ EXIT
END

IF ~AreaCheck("AR0801")
Global("RR#HELPED_ARLED","GLOBAL",0)~ THEN BEGIN 30a
SAY @1219
=
@1220
=
@1221
IF ~CheckStatGT(Player1,13,CHR)
OR(6)
HasItemEquipedReal("RR#SILV",Player1)
HasItemEquipedReal("RR#SILV",Player2)
HasItemEquipedReal("RR#SILV",Player3)
HasItemEquipedReal("RR#SILV",Player4)
HasItemEquipedReal("RR#SILV",Player5)
HasItemEquipedReal("RR#SILV",Player6)~ THEN REPLY @1222 GOTO 40a

IF ~CheckStatLT(Player1,14,CHR)
OR(6)
HasItemEquipedReal("RR#SILV",Player1)
HasItemEquipedReal("RR#SILV",Player2)
HasItemEquipedReal("RR#SILV",Player3)
HasItemEquipedReal("RR#SILV",Player4)
HasItemEquipedReal("RR#SILV",Player5)
HasItemEquipedReal("RR#SILV",Player6)~ THEN REPLY @1223 GOTO 40a

IF ~!HasItemEquipedReal("RR#SILV",Player1)
!HasItemEquipedReal("RR#SILV",Player2)
!HasItemEquipedReal("RR#SILV",Player3)
!HasItemEquipedReal("RR#SILV",Player4)
!HasItemEquipedReal("RR#SILV",Player5)
!HasItemEquipedReal("RR#SILV",Player6)
CheckStatGT(Player1,13,CHR)~ THEN REPLY @1222 GOTO 31a

IF ~!HasItemEquipedReal("RR#SILV",Player1)
!HasItemEquipedReal("RR#SILV",Player2)
!HasItemEquipedReal("RR#SILV",Player3)
!HasItemEquipedReal("RR#SILV",Player4)
!HasItemEquipedReal("RR#SILV",Player5)
!HasItemEquipedReal("RR#SILV",Player6)~ THEN REPLY @1223 GOTO 31a
END

IF ~AreaCheck("AR0801")
GlobalGT("RR#HELPED_ARLED","GLOBAL",0)~ THEN BEGIN 30b
SAY @1224
=
@1225
IF ~~ THEN REPLY @1226 GOTO 31a
IF ~~ THEN REPLY @1227 GOTO 31a
END

IF ~~ THEN BEGIN 31d
SAY @1228
IF ~~ THEN REPLY @1229 GOTO 31b
IF ~~ THEN REPLY @1230 GOTO 32c
END

IF ~~ THEN BEGIN 31e
SAY @1228
IF ~~ THEN REPLY @1229 GOTO 31c
IF ~~ THEN REPLY @1230 GOTO 32c
END

IF ~~ THEN BEGIN 40a
SAY @1232
=
@1233
=
@1234
=
@1235

IF ~Class(LastTalkedToBy(Myself),PALADIN_ALL) !Kit(LastTalkedToBy(Myself),INQUISITOR) !Kit(LastTalkedToBy(Myself),UNDEADHUNTER) HaveSpellParty(PALADIN_LAY_ON_HANDS)~ THEN REPLY @1153 DO ~IncrementGlobal("RR#HELPED_ARLED","GLOBAL",1) ReputationInc(1)~ GOTO 32d
IF ~OR(4)
Class(LastTalkedToBy(Myself),CLERIC_ALL)
Class(LastTalkedToBy(Myself),DRUID_ALL)
Class(LastTalkedToBy(Myself),PALADIN_ALL)
Class(LastTalkedToBy(Myself),RANGER_ALL)
OR(7)
HaveSpellParty(3101)
HaveSpellParty(CLERIC_CURE_LIGHT_WOUNDS)
HaveSpellParty(CLERIC_CURE_MEDIUM_WOUNDS)
HaveSpellParty(CLERIC_CURE_SERIOUS_WOUNDS)
HaveSpellParty(CLERIC_CURE_CRITICAL_WOUNDS)
HaveSpellParty(CLERIC_MASS_CURE)
HaveSpellParty(CLERIC_HEAL)~ THEN REPLY @1154 DO ~IncrementGlobal("RR#HELPED_ARLED","GLOBAL",1)
ReputationInc(1)~ GOTO 32d
IF ~!Class(LastTalkedToBy(Myself),CLERIC_ALL)
!Class(LastTalkedToBy(Myself),DRUID_ALL)
!Class(LastTalkedToBy(Myself),PALADIN_ALL)
!Class(LastTalkedToBy(Myself),RANGER_ALL)
HaveSpellParty(3101)~ THEN REPLY @1154 DO ~IncrementGlobal("RR#HELPED_ARLED","GLOBAL",1)
ReputationInc(1)~ GOTO 32d
IF ~PartyHasItem("POTN08")
!PartyHasItem("POTN52")~ THEN REPLY @1155 DO ~TakePartyItemNum("POTN08",1)
IncrementGlobal("RR#HEPED_ARLED","GLOBAL",1)
ReputationInc(1)
DestroyItem("POTN08")~ GOTO 32a
IF ~PartyHasItem("POTN52")~ THEN REPLY @1156 DO ~TakePartyItemNum("POTN52",1)
IncrementGlobal("RR#HELPED_ARLED","GLOBAL",1)
ReputationInc(1)
DestroyItem("POTN52")~ GOTO 32a
IF ~PartyHasItem("POTN26")
!Alignment(Player1,MASK_GOOD)~ THEN REPLY @1157 GOTO 31e
IF ~PartyHasItem("POTN13")
!Alignment(Player1,MASK_GOOD)~ THEN REPLY @1158 GOTO 31d
IF ~~ THEN REPLY @1159 GOTO 32b
END
END

CHAIN ARLED RR#ArledIncinerated1
@1160
== KELDORJ IF ~InParty("Keldorn") InMyArea("Keldorn") !StateCheck("Keldorn",CD_STATE_NOTVALID)~ THEN @1537
== JAHEIRAJ IF ~InParty("Jaheira") InMyArea("Jaheira") !StateCheck("Jaheira",CD_STATE_NOTVALID)~ THEN @1538
== AERIEJ IF ~InParty("Aerie") InMyArea("Aerie") !StateCheck("Aerie",CD_STATE_NOTVALID)~ THEN @1539
== VICONIJ IF ~InParty("Viconia") InMyArea("Viconia") !StateCheck("Viconia",CD_STATE_NOTVALID)~ THEN @1540
== KORGANJ IF ~InParty("Korgan") InMyArea("Korgan") !StateCheck("Korgan",CD_STATE_NOTVALID)~ THEN @1541 END
IF ~~ THEN GOTO 31d

CHAIN ARLED RR#ArledIncinerated2
@1161
== KELDORJ IF ~InParty("Keldorn") InMyArea("Keldorn") !StateCheck("Keldorn",CD_STATE_NOTVALID)~ THEN @1537
== JAHEIRAJ IF ~InParty("Jaheira") InMyArea("Jaheira") !StateCheck("Jaheira",CD_STATE_NOTVALID)~ THEN @1538
== AERIEJ IF ~InParty("Aerie") InMyArea("Aerie") !StateCheck("Aerie",CD_STATE_NOTVALID)~ THEN @1539
== VICONIJ IF ~InParty("Viconia") InMyArea("Viconia") !StateCheck("Viconia",CD_STATE_NOTVALID)~ THEN @1540
== KORGANJ IF ~InParty("Korgan") InMyArea("Korgan") !StateCheck("Korgan",CD_STATE_NOTVALID)~ THEN @1542 END
IF ~~ THEN GOTO 31e