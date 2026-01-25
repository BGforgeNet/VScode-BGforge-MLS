////////////////////////////////////////////////////////////////////////
///  Summon the Five, banter with Sarevok
////////////////////////////////////////////////////////////////////////

/////////////////////////////////
// Initial summons - replace the same-string block from vanilla in case some NPC interjects
/////////////////////////////////

REPLACE finmel01

IF ~Global("FinalFight","AR6200",6)Global("TheFiveAreHere","AR6200",0)~ THEN BEGIN 8
  SAY #67804 
  IF ~Global("BalthazarFights","GLOBAL",0)~ 
  THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("finmel3a")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",1)DifficultyGT(EASY)~ 
  THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("finmel3b")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",1)DifficultyLT(NORMAL)~ THEN DO 
  ~ClearAllActions()StartCutSceneMode()StartCutScene("finmel3c")~ EXIT
END

END // end of REPLACE
    
/////////////////////////////////
// Banter about bringing the Five back, ending either with Sarevok brought back, or the fight starting, or entering a banter with in-party Sarevok
/////////////////////////////////

APPEND_EARLY finmel01 // APPEND_EARLY just because we APPEND_EARLY some other stuff and it's good to keep the logical order

IF ~Global("FinalFight","AR6200",6)Global("TheFiveAreHere","AR6200",1)~ THEN BEGIN mel_five_here
  SAY @616 /* ~I was going to resurrect them anyway, to serve as my conquering avatars.  And I prefer them far better this way...completely servile, obeying every order without question.~ #74355 */
  IF ~Global("BalthazarFights","GLOBAL",1)DifficultyGT(EASY)~ THEN GOTO mel_gromnir_too
  IF ~Global("BalthazarFights","GLOBAL",0)~ THEN GOTO mel_not_gromnir   // split this up to facilitate SCS substitution of the difficulty check
  IF ~DifficultyLT(NORMAL)~ THEN GOTO mel_not_gromnir
END

IF ~~ THEN BEGIN mel_gromnir_too
  SAY @617 /* ~And since you recruited Balthazar to your side, I've decided on the delicious irony of re-creating poor, pathetic Gromnir as well.  It delights me to no end to know that he was right about me all along...and yet it made no difference.  You murdered him still, as I knew you would.~  */
  IF ~Global("BalthazarFights","GLOBAL",1)!Dead("balth2")!StateCheck("balth2",STATE_SLEEPING)!StateCheck("balth2",STATE_STUNNED)~ THEN EXTERN balth2 balth_line
  IF ~Global("BalthazarFights","GLOBAL",1)OR(3)Dead("balth2")StateCheck("balth2",STATE_SLEEPING)StateCheck("balth2",STATE_STUNNED)~ THEN REPLY @618 GOTO mel_sarevok_checkpoint
END

IF ~~ THEN BEGIN mel_not_gromnir
  SAY @620 /* ~They provided a considerable challenge for you individually, <CHARNAME>.  I wonder how you will fare against them all?~ */
  IF ~Global("BalthazarFights","GLOBAL",1)!Dead("balth2")!StateCheck("balth2",STATE_SLEEPING)!StateCheck("balth2",STATE_STUNNED)~ THEN EXTERN balth2 balth_line
  IF ~OR(4)Dead("balth2")StateCheck("balth2",STATE_SLEEPING)StateCheck("balth2",STATE_STUNNED)Global("BalthazarFights","GLOBAL",0)~ THEN REPLY @618 GOTO mel_sarevok_checkpoint
END

IF ~~ THEN BEGIN mel_sarevok_checkpoint
  SAY @619 /* ~Perhaps.  But already I am immortal, which means I cannot be killed even by you.  And there is still more of your father's essence for me to take.~ #80486 */
  IF ~Dead("sarevok")~ THEN GOTO mel_exit_no_sarevok
  IF ~InPartyAllowDead("sarevok")!Dead("sarevok")~ THEN GOTO mel_sarev_offer_inparty
  IF ~!InPartyAllowDead("sarevok")!Dead("sarevok")OR(2)!Global("fin_sarev_redeemed","GLOBAL",0)Global("BalthazarFights","GLOBAL",1)~ THEN GOTO mel_summon_sarevok // split this up to facilitate SCS substitution
  IF ~!InPartyAllowDead("sarevok")!Dead("sarevok")DifficultyGT(2)~ THEN GOTO mel_summon_sarevok
  IF ~!InPartyAllowDead("sarevok")!Dead("sarevok")DifficultyLT(3)Global("BalthazarFights","GLOBAL",0)Global("fin_sarev_redeemed","GLOBAL",0)~ THEN GOTO mel_exit_no_sarevok
END

IF ~~ THEN BEGIN mel_summon_sarevok
  SAY @623 /* ~But...we don't have all your siblings accounted for just quite yet, do we?  Haven't you forgotten someone?~ #80489 */
  IF ~Global("fin_sarev_redeemed","GLOBAL",0)~ THEN DO ~ClearAllActions()SetGlobal("SarevokSummoned","AR6200",1)StartCutSceneMode()StartCutScene("finmel5")~ EXIT
  IF ~!Global("fin_sarev_redeemed","GLOBAL",0)~ THEN DO ~ClearAllActions()SetGlobal("SarevokSummoned","AR6200",1)StartCutSceneMode()StartCutScene("finmel5a")~ EXIT
END

END // end of APPEND

APPEND balth2 // the line Balthazar speaks in the above

IF ~~ THEN BEGIN balth_line
  SAY @1008 /* ~You are a fool, Melissan.  You should have kept what divine energy you had for yourself and not spread it amongst such servants.  It will prove your doom.~  */
  IF ~~ THEN EXTERN finmel01 mel_sarevok_checkpoint
END

END // end of APPEND

/////////////////////////////////
// banter with out-of-party Sarevok
/////////////////////////////////

CHAIN
IF ~NumTimesTalkedTo(0)~ THEN finsarev finsarev_intro
@26
== finmel01 @629
== finsarev @27
END
  IF ~~ THEN REPLY @28 GOTO finsarev_exit
  IF ~~ THEN REPLY @29 GOTO finsarev_exit
  IF ~~ THEN REPLY @30 GOTO finsarev_exit
  IF ~~ THEN REPLY @31 GOTO finsarev_exit

CHAIN
IF ~NumTimesTalkedTo(0)~ THEN finsare2 finsarev_intro_good
@26
== finmel01 @629
== finsare2 @270
END finmel01 mel_exit_anti_sarevok_2

APPEND_EARLY finsarev

IF ~~ THEN BEGIN finsarev_exit
SAY @32
IF ~~ THEN DO ~ActionOverride("finsarev",Enemy())~ EXTERN finmel01 mel_exit_sarevok
END

END // end APPEND

/////////////////////////////////
// banter with in-party Sarevok
/////////////////////////////////

CHAIN 
IF ~~ THEN finmel01 mel_sarev_offer_inparty
@622
== sarev25j @262
== finmel01 @624
END
  IF ~Global("SarevokOath","GLOBAL",1)~ THEN EXTERN sarev25j sarevok_vow
  IF ~!Global("SarevokOath","GLOBAL",1)~ THEN EXTERN sarev25j mel_sarev_2

CHAIN
IF ~~ THEN sarev25j sarevok_vow
@263
== finmel01 @625
END 
sarev25j mel_sarev_2

CHAIN 
IF ~~ THEN sarev25j mel_sarev_2
@264
== finmel01 @626
END
  IF ~!Alignment("sarevok",MASK_EVIL)~ THEN EXTERN sarev25j sarev_good
  IF ~Alignment("sarevok",MASK_EVIL)DifficultyLT(4)~ THEN EXTERN sarev25j sarev_evil_nojoin
  IF ~Alignment("sarevok",MASK_EVIL)!DifficultyLT(4)OR(2)!Alignment(Player1,MASK_EVIL)!ReputationLT(Player1,10)~ THEN EXTERN sarev25j sarev_evil_join
  IF ~Alignment("sarevok",MASK_EVIL)!DifficultyLT(4)Alignment(Player1,MASK_EVIL)ReputationLT(Player1,10)~ THEN EXTERN sarev25j sarev_evil_nojoin


APPEND_EARLY sarev25j

IF ~~ THEN BEGIN sarev_good
SAY @270
IF ~~ THEN EXTERN finmel01 mel_exit_anti_sarevok
END

IF ~~ THEN BEGIN sarev_evil_nojoin
SAY @265
IF ~~ THEN EXTERN finmel01 mel_exit_anti_sarevok
END

IF ~~ THEN BEGIN sarev_evil_join
SAY @266
IF ~~ THEN REPLY @267 GOTO sarev_join_r1
IF ~~ THEN REPLY @268 GOTO sarev_join_r2
IF ~~ THEN REPLY @269 GOTO sarev_join_r3
END

IF ~~ THEN BEGIN sarev_join_r1
SAY @271
IF ~~ THEN EXTERN finmel01 mel_exit_sarevok
END

IF ~~ THEN BEGIN sarev_join_r2
SAY @272
IF ~~ THEN EXTERN finmel01 mel_exit_sarevok
END

IF ~~ THEN BEGIN sarev_join_r3
SAY @273
IF ~~ THEN EXTERN finmel01 mel_exit_sarevok
END


END // end of APPEND


/////////////////////////////////
// melissan exit states
/////////////////////////////////


APPEND_EARLY finmel01

IF ~~ THEN BEGIN mel_exit_no_sarevok
  SAY @621 /* ~So come, <CHARNAME>...kill your siblings once again.  If you can.~ #80487 */
  IF ~~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("finmel4")~ EXIT
END

IF ~~ THEN mel_exit_sarevok
  SAY @627=@621
  IF ~!Global("SarevokSummoned","AR6200",1)~ 
  THEN DO ~SetGlobal("SarevokFights","GLOBAL",1)ClearAllActions()StartCutSceneMode()StartCutScene("finmel4a")~ EXIT
  IF ~Global("SarevokSummoned","AR6200",1)~ 
  THEN DO ~SetGlobal("SarevokFights","GLOBAL",1)ClearAllActions()StartCutSceneMode()StartCutScene("finmel4b")~ EXIT
END

IF ~~ THEN BEGIN mel_exit_anti_sarevok
  SAY @628
  IF ~~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("finmel4")~ EXIT
END

IF ~~ THEN BEGIN mel_exit_anti_sarevok_2
  SAY @628
  IF ~~ THEN DO ~SetGlobal("fin_sarevok_external_friendly","GLOBAL",1)ClearAllActions()StartCutSceneMode()StartCutScene("finmel4")~ EXIT
END

END






