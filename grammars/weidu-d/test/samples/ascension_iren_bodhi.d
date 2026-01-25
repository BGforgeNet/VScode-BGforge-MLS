
//////////////////////////////////////////////////////////////
//// Irenicus / Bodhi / CHARNAME banter
//////////////////////////////////////////////////////////////

// Bodhi's initial state

APPEND finbodh

IF ~Global("BodhiTalks","LOCALS",0)!GlobalGT("BodhiHappyBunny","LOCALS",0)~ THEN BEGIN bodhi_intro
SAY @33
IF ~~ THEN DO ~SetGlobal("BodhiTalks","LOCALS",1)~ EXTERN irenic2 iren_bodhi_intro_chain
END

END // end of APPEND

// Initial Iren/Bodhi banter

CHAIN
IF ~~ THEN
irenic2 iren_bodhi_intro_chain
@452
== finbodh @34
== irenic2 @454
EXTERN finbodh bodhi_intro_2

APPEND_EARLY finbodh

IF ~~ THEN BEGIN bodhi_intro_2
SAY @35
  IF ~~ THEN REPLY @36 /* ~Still trapped in servitude to Irenicus?  Do you have no will of your own, Bodhi?~  */ GOTO bodhi_negotiate
  IF ~~ THEN REPLY @37 /* ~Why don't you go jump on a stake and spare us both the tedium of battle?~  */ GOTO bodhi_fight_r1
  IF ~~ THEN REPLY @38 /* ~Best hike up your skirts and run, Bodhi.  The time when I found vampires remotely threatening is long past!~ */ GOTO bodhi_fight_r1
  IF ~~ THEN REPLY @39 /* ~Do I have to suffer your prattle again?  I shall stamp out your evil presence once and for all!~  */ GOTO bodhi_fight_r2
END

// Routes that just lead to Bodhi fighting CHARNAME directly

IF ~~ THEN BEGIN bodhi_fight_r1
SAY @61 /* ~Well, well, well...if the Child of Bhaal hasn't gone and found <PRO_HIMHER>self a sense of humour.  Did <PRO_HESHE> dig it up all by <PRO_HIMHER>self, dear brother, or did you implant it in <PRO_HIMHER> in one of your more bizarre experiments?~ */
IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile
END

IF ~~ THEN BEGIN bodhi_fight_r2
SAY @62
IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile
END

// Negotiation first stage entry point

IF ~~ THEN BEGIN bodhi_negotiate
  SAY @41 /* ~Oh Child of Bhaal, so serious and grim!  Do you not enjoy that our paths have crossed again?  Does your blood not rejoice?~  */
  IF ~~ THEN REPLY @42  GOTO bodhi_threaten
  IF ~~ THEN REPLY @43  GOTO bodhi_threaten
  IF ~CheckStatGT(Player1,15,CHR)Global("BalthazarFights","GLOBAL",0)!Alignment(Player1,MASK_GOOD)!ReputationGT(Player1,11)~ 
  THEN REPLY @44 GOTO bodhi_will_deal_immediately
  IF ~CheckStatGT(Player1,15,CHR)Global("BalthazarFights","GLOBAL",0)!Alignment(Player1,MASK_GOOD)!ReputationGT(Player1,11)~
  THEN REPLY @45 GOTO bodhi_will_deal_immediately
  IF ~OR(4)!CheckStatGT(Player1,15,CHR)!Global("BalthazarFights","GLOBAL",0)Alignment(Player1,MASK_GOOD)ReputationGT(Player1,11)~
  THEN REPLY @44 /* ~You have nothing to gain from this fight.  Will you sacrifice yourself out of sibling loyalty?  Do not make that mistake again.~ */ GOTO bodhi_doomed_whatever
  IF ~OR(4)!CheckStatGT(Player1,15,CHR)!Global("BalthazarFights","GLOBAL",0)Alignment(Player1,MASK_GOOD)ReputationGT(Player1,11)~
  THEN REPLY @45 /* ~Stand aside Bodhi.  Your brother is blinded by his lust for vengance.  He's prepared to fight me to the death, but you don't need to die at his side.  There is no need for you to die at all.~ */ GOTO bodhi_opportunity
END

IF ~~ THEN BEGIN bodhi_threaten
  SAY @48 /* ~Oh Child of Bhaal, you do bore me so with your talk.  Come to me and embrace death as I have.  Let the dance BEGIN aagain!~  */
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile
END

IF ~~ THEN BEGIN bodhi_will_deal_immediately
  SAY @49 /* ~Indeed, I have no intention of dying at all.   I fight with my brother because I have no choice....or would you offer me one now?~ */
  IF ~InPartyAllowDead("Sarevok")!Dead("Sarevok")~ 
  THEN GOTO bodhi_sarevok
  IF ~OR(2)!InPartyAllowDead("Sarevok")Dead("Sarevok")~ 
  THEN GOTO bodhi_no_sarevok
END

IF ~~ THEN BEGIN bodhi_sarevok
  SAY @50 /* ~My brother believes he can offer me your soul, yet I see that you too can raise others from the abyss; one who opposed you, no less!  How intriguing.  Perhaps I do not need to taste your blood...~  */
  IF ~~ THEN GOTO bodhi_wants_promise_1
END

IF ~~ THEN BEGIN bodhi_no_sarevok
  SAY @52 /* ~I require a soul <CHARNAME>, as well you know.  I could tear it from young Imoen once again, but she seems....indisposed.  Yet perhaps there is another way...~  */
  IF ~~ THEN GOTO bodhi_wants_promise_1
END

IF ~~ THEN BEGIN bodhi_doomed_whatever
  SAY @53 /* ~I am doomed whether or not I fight.  My stay in the Abyss was not a pleasant one, but since I must return, I shall not pass up a chance to feast on such a fine morsel.~  */
  IF ~~ THEN REPLY @54 GOTO bodhi_negotiate_checkpoint
  IF ~~ THEN REPLY @55 GOTO bodhi_end_negotiation
  IF ~~ THEN REPLY @56 GOTO bodhi_negotiate_checkpoint
END

IF ~~ THEN BEGIN bodhi_opportunity
  SAY @59 /* ~An opportunity to feast on the blood of a God, and yet you think I will stand aside?  (chuckle)  You know me no better than my dear brother here.~ #82669 */
  IF ~~ THEN REPLY @54 GOTO bodhi_negotiate_checkpoint
  IF ~~ THEN REPLY @55 GOTO bodhi_end_negotiation
  IF ~~ THEN REPLY @56 GOTO bodhi_negotiate_checkpoint
  IF ~~ THEN REPLY @60 GOTO bodhi_end_negotiation
END

IF ~~ THEN BEGIN bodhi_end_negotiation
  SAY @58 /* ~So <CHARNAME>, the creature of darkness that rests within you has also stolen your wit.  Such a shame for one with the divine essence.  It will almost be a mercy to end your existence.~ */
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile
END

// Negotiation checkpoint (no PC response)

IF ~~ THEN BEGIN bodhi_negotiate_checkpoint
  SAY @57
  IF ~Global("BalthazarFights","GLOBAL",0)OR(2)Alignment(Player1,MASK_GOOD)ReputationGT(Player1,11)GlobalGT("WorkingForBodhi","GLOBAL",0)~ THEN GOTO refuse_too_good_not_again
  IF ~Global("BalthazarFights","GLOBAL",0)OR(2)Alignment(Player1,MASK_GOOD)ReputationGT(Player1,11)Global("WorkingForBodhi","GLOBAL",0)~ THEN GOTO refuse_too_good
  IF ~Global("BalthazarFights","GLOBAL",0)!Alignment(Player1,MASK_GOOD)!ReputationGT(Player1,11)~ THEN GOTO bodhi_wants_promise_2
  IF ~Global("BalthazarFights","GLOBAL",1)~ THEN GOTO refuse_balth
END

IF ~~ THEN BEGIN refuse_too_good_not_again
  SAY @63 /* ~No, <CHARNAME>.  Sadly, I do not think we are destined to work together again.  I am content to fight by my brother and revel in your blood and that of those that follow at your heel.~  */
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile_eventually
END

IF ~~ THEN BEGIN refuse_too_good
  SAY @64 /* ~Oh Child of Bhaal, such a game you play.  You think to trick me, but I shall not be fooled so easily.  I know you to be ever so desperate to do 'good' and this would not bode well for me.  No, this ends here.~  */
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile_eventually
END

IF ~~ THEN BEGIN refuse_balth
  SAY @71 /* ~No, <CHARNAME>.  Sadly, I do not think we are destined to work together again.  Despite the attractiveness of what you offer, your words ring more hollow than my brother's.  Far better to rip your soul from your living breast than beg for it at your side.~  */
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile_eventually
END

///// Bodhi agrees, but she wants a promise (two different versions, corresponding to two ways in)
///// here we fix what I think are two small glitches:
///// (i) you only hear Irenicus's banter once
///// (ii) on one, but not the other, Bodhi's reply is different if you trick her (I think it's supposed to be the same)

IF ~~ THEN BEGIN bodhi_wants_promise_1
  SAY @51 = @87
  IF ~~ THEN REPLY @66 DO ~SetGlobal("BodhiPromised","GLOBAL",1)~ GOTO promise_bodhi
  IF ~~ THEN REPLY @67 DO ~SetGlobal("BodhiPromised","GLOBAL",1)~ GOTO promise_bodhi
  IF ~~ THEN REPLY @88  GOTO reject_bodhi
  IF ~CheckStatGT(Player1,15,WIS)~ THEN REPLY @69 GOTO promise_bodhi
END
IF ~~ THEN BEGIN bodhi_wants_promise_2
  SAY @65 /* ~Oh Child of Bhaal, such a game you play.  I fight with my 'dear' brother for your soul, yet you would offer it willingly?  Promise me a piece of your essence and I will join you...for now.~  */
  IF ~~ THEN REPLY @66 DO ~SetGlobal("BodhiPromised","GLOBAL",1)~ GOTO promise_bodhi_2
  IF ~~ THEN REPLY @67 DO ~SetGlobal("BodhiPromised","GLOBAL",1)~ GOTO promise_bodhi_2
  IF ~~ THEN REPLY @68 GOTO reject_bodhi
  IF ~CheckStatGT(Player1,15,WIS)~ THEN REPLY @69 GOTO promise_bodhi_2
END

IF ~~ THEN BEGIN reject_bodhi
  SAY @46 /* ~You may be strong, <CHARNAME>, but you are indeed a fool to think us weak.  I shall take your soul for my own, I swear it!~ */
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhihostile_eventually
END

IF ~~ THEN BEGIN promise_bodhi
  SAY @70 = @47
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhifriendly
END

IF ~~ THEN BEGIN promise_bodhi_2  // split this up to allow Irenicus to interject
  SAY @70
  IF ~~ THEN GOTO promise_bodhi_2b
END

IF ~~ THEN BEGIN promise_bodhi_2b
  SAY @47
  IF ~~ THEN EXTERN irenic2 iren_exit_bodhifriendly
END

END // end of APPEND

// Irenicus exit states

APPEND irenic2
IF ~~ THEN BEGIN iren_exit_bodhihostile
SAY @453 /* ~Enough, sister.  We do as Melissan bids, with her servants at our side.  Take delight, if you will, at the revenge we shall now taste.  Let us see, <CHARNAME>, if I can rip that soul out of you once more.  I would so delight in stealing your proud destiny a second time.~  */
  IF ~Global("BalthazarFights","GLOBAL",1)DifficultyLT(4)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2a")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",1)DifficultyGT(3)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2b")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",0)DifficultyLT(5)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2a")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",0)DifficultyGT(4)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2b")~ EXIT
END

IF ~~ THEN BEGIN iren_exit_bodhihostile_eventually // this is intentionally never true, as we don't actually want it as an entry block!
  SAY @456 /* ~So my ungrateful sister, you finally stand by my side.  I shall deal with your treachery afterwards.  As for you, <CHARNAME>, Mellisan has granted me the power to rip the divinity from your body.  The first thing I shall feel in an eon shall be pleasure as I watch your corpse turn to dust.~ */
  IF ~Global("BalthazarFights","GLOBAL",1)DifficultyLT(4)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2a")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",1)DifficultyGT(3)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2b")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",0)DifficultyLT(5)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2a")~ EXIT
  IF ~Global("BalthazarFights","GLOBAL",0)DifficultyGT(4)~ THEN DO
      ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2b")~ EXIT
END

IF ~~ THEN BEGIN iren_exit_bodhifriendly
SAY @457 = @458
  IF ~Difficulty(4)~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2c")~ EXIT
  IF ~DifficultyGT(4)~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2d")~ EXIT
  IF ~DifficultyLT(4)~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("irenic2e")~ EXIT
END

END // end of APPEND

/// Irenicus interjections into Bodhi dialog
/// (one of these is added by David, since
/// Irenicus now comments only on one of the
/// two paths and I think that's an error).

INTERJECT_COPY_TRANS finbodh bodhi_sarevok FinBodhiIrenInter == irenic2 @455 END
INTERJECT_COPY_TRANS finbodh bodhi_no_sarevok FinBodhiIrenInter == irenic2 @455 END
INTERJECT_COPY_TRANS finbodh promise_bodhi_2 FinBodhiIrenInter == irenic2 @455 END