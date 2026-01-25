// creator  : aVENGER
// argument : FFBART.DLG
// New dialogue options for the Five Flaggons inkeeper related to Arledrian's Silverblaze quest

EXTEND_BOTTOM ~FFBART~ 0 
  IF ~PartyHasItem("RR#BK04")~ THEN REPLY  @170 DO ~TakePartyItem("RR#BK04")
DestroyItem("RR#BK04")
EraseJournalEntry(@652)~ GOTO RR#HaerArled01
END

EXTEND_BOTTOM ~FFBART~ 8 
  IF ~PartyHasItem("RR#BK04")~ THEN REPLY  @171 DO ~TakePartyItem("RR#BK04")
DestroyItem("RR#BK04")
EraseJournalEntry(@652)~ GOTO RR#HaerArled01
END

APPEND FFBART 
IF ~~ THEN BEGIN A01
  SAY @173
=
@174
  IF ~~ THEN REPLY @175 GOTO A02
  IF ~~ THEN REPLY @176 GOTO A02
END

IF ~~ THEN BEGIN A02
  SAY @177
  IF ~~ THEN GOTO RR#YoshiArled01
END

IF ~~ THEN BEGIN A03
  SAY @179
  IF ~~ THEN REPLY @180 UNSOLVED_JOURNAL @654 EXIT
  IF ~~ THEN REPLY @181 UNSOLVED_JOURNAL @654 EXIT
END
END


// Haer'Dalis comments on the theather plays
CHAIN FFBART RR#HaerArled01
@172
== HAERDAJ IF ~InParty("HaerDalis") InMyArea("HaerDalis") !StateCheck("HaerDalis",CD_STATE_NOTVALID)~ THEN @1500 END
IF ~~ THEN GOTO A01


// Yoshimo remarks on Arledrian's locked room and Keldorn reprehends him
CHAIN FFBART RR#YoshiArled01
@178
== YOSHJ IF ~InParty("Yoshimo") InMyArea("Yoshimo") !StateCheck("Yoshimo",CD_STATE_NOTVALID)~ THEN @1501
== KELDORJ IF ~InParty("Yoshimo") InMyArea("Yoshimo") !StateCheck("Yoshimo",CD_STATE_NOTVALID) InParty("Keldorn") InMyArea("Keldorn") !StateCheck("Keldorn",CD_STATE_NOTVALID)~ THEN @1502 END
IF ~~ THEN GOTO A03