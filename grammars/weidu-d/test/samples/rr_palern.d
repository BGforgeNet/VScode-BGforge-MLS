// creator  : aVENGER
// argument : PALERN.DLG

REPLACE_TRIGGER_TEXT ~PALERN~ ~NumDeadGT("Flyfgt",6)~ ~NumTimesTalkedTo(0) CombatCounter(0) !Detect([EVILCUTOFF]) StateCheck("RR#SFL04",STATE_REALLY_DEAD)~

APPEND PALERN

IF ~NumTimesTalkedTo(0) CombatCounter(0) !Detect([EVILCUTOFF]) !StateCheck("RR#SFL04",STATE_REALLY_DEAD)~ THEN BEGIN RR#00
SAY @750
=
@751
  IF ~!StateCheck("RR#SFL04",STATE_REALLY_DEAD) PartyHasItem("POTN10")~ THEN REPLY @763 DO ~TakePartyItemNum("POTN10",1)~ GOTO RR#01
  IF ~!StateCheck("RR#SFL04",STATE_REALLY_DEAD)
       OR(3)
       HaveSpellParty(WIZARD_INVISIBILITY)
       HaveSpellParty(WIZARD_INVISIBILITY_10_FOOT)
       HaveSpellParty(WIZARD_IMPROVED_INVISIBILITY)~ THEN REPLY @760 GOTO RR#02
  IF ~!StateCheck("RR#SFL04",STATE_REALLY_DEAD)~ THEN REPLY @761 GOTO RR#03
END

IF ~~ THEN BEGIN RR#01
  SAY @754
IF ~~ THEN DO ~SetGlobal("RescuedPalern","GLOBAL",1)
AddexperienceParty(12500)
DisplayStringHead(Myself,46150) //  quaffs a potion
UseItem("POTN10",Myself) // Potion of Invisibility
EscapeAreaDestroy(2)~ EXIT
END

IF ~~ THEN BEGIN RR#02
  SAY @752
IF ~~ THEN EXIT
END

IF ~~ THEN BEGIN RR#03
  SAY @753
IF ~~ THEN EXIT
END

IF ~NumTimesTalkedToGT(0) CombatCounter(0) !Detect([EVILCUTOFF])~ THEN BEGIN RR#04
SAY @755
  IF ~!StateCheck("RR#SFL04",STATE_REALLY_DEAD) PartyHasItem("POTN10")~ THEN REPLY @763 DO ~TakePartyItemNum("POTN10",1)~ GOTO RR#01
  IF ~!StateCheck("RR#SFL04",STATE_REALLY_DEAD)
       OR(3)
       HaveSpellParty(WIZARD_INVISIBILITY)
       HaveSpellParty(WIZARD_INVISIBILITY_10_FOOT)
       HaveSpellParty(WIZARD_IMPROVED_INVISIBILITY)~ THEN REPLY @760 GOTO RR#02
  IF ~!StateCheck("RR#SFL04",STATE_REALLY_DEAD)~ THEN REPLY @761 GOTO RR#03
  IF ~StateCheck("RR#SFL04",STATE_REALLY_DEAD)~ THEN REPLY @762 GOTO RR#05
END

IF ~~ THEN BEGIN RR#05
  SAY @756
IF ~~ THEN DO ~SetGlobal("RescuedPalern","GLOBAL",1) EscapeAreaDestroy(5)~ EXIT
END
END