//////////////////////////////////////////////////////////////
//// Irenicus banters with CHARNAME, then summons Bodhi
//////////////////////////////////////////////////////////////

APPEND_EARLY irenic2 // EARLY so Sarevok's INTERJECT can respond to it
IF ~Global("FinalFight","AR6200",2)~ THEN BEGIN iren_intro // from:
  SAY @440 /* ~So, <CHARNAME>...it is now just you and I, once again.  At odds in the bowels of Hell and preparing to do combat.  How very fitting.~  */
  IF ~~ THEN REPLY @441 /* ~This fight is mine, Irenicus.  While you stewed in Hell, my power has multiplied.~  */ GOTO iren_intro_r1
  IF ~~ THEN REPLY @442 /* ~You actually think you'll stop me?  It appears your delusions have survived the many beatings at my hand.~  */ GOTO iren_intro_r2
  IF ~~ THEN REPLY @443 /* ~So you're actually willing to serve as Melissan's little lackey?  I would expect more from the great elven magician.  Ellesime would be sad to see you reduced to this.~ #77396 */ GOTO iren_intro_r3
  IF ~~ THEN REPLY @444 /* ~Don't you ever tire of that bravado?  Haven't you received enough spankings upon my knee?~  */ GOTO iren_intro_r4
  IF ~~ THEN REPLY @445 /* ~You won't stop me, Irenicus.  Nobody can.  My destiny is at hand.~  */ GOTO iren_intro_r5
END

IF ~~ THEN BEGIN iren_intro_r1
  SAY @446 /* ~It appears you have been the beneficiary of low expectations, but even I have learned from my mistakes.  Here, I have nothing to lose, not even my life.  Thanks to Melissan, I still have time to snuff out your divine ascention personally. We will be even!~  */
  IF ~~ THEN GOTO iren_intro_exit
END

IF ~~ THEN BEGIN iren_intro_r2
  SAY @447 /* ~You may have gained some crude and rudimentary control over your abilities in the interim, but even I have learned a thing or two...delusions or no.  And Melissan has given me the opportunity to personally see an end to your ascension...consider it a favor returned.~ */
  IF ~~ THEN GOTO iren_intro_exit
END

IF ~~ THEN BEGIN iren_intro_r3
  SAY @448 /* ~Do not speak her name, dog.  Ellesime will understand the fullness of her regret soon enough.  As for you...Melissan has given me the opportunity to return an old favor.  One ascension for another...it rings with universal justice.~  */
  IF ~~ THEN GOTO iren_intro_exit
END

IF ~~ THEN BEGIN iren_intro_r4
  SAY @449 /* ~How very glib and typical.  How far the expectations of the universe must have lowered to allow a gnat like you to even come this far.  It is fortunate that I have an opportunity, then, to repay your termination of my own ascension in kind.~  */
  IF ~~ THEN GOTO iren_intro_exit
END

IF ~~ THEN BEGIN iren_intro_r5
  SAY @450 /* ~Ah, yes.  Familiar words.  Similar to the ones I spoke at the cusp of my own ascension.  How I would enjoy to repay that favor in kind and show the universe what an unworthy gnat you truly are.~  */
  IF ~~ THEN GOTO iren_intro_exit
END

IF ~~ THEN BEGIN iren_intro_exit
  SAY @451 /* ~But enough of this.  Though I would dearly love to let my sister rot in her own Hell for eternity, it would not be a true and fitting re-union if I did not use my new power to send her an invitation.~  */
  IF ~~ THEN DO ~ClearAllActions()
StartCutSceneMode()
StartCutScene("finiren1")~ EXIT
END
END // end of APPEND

///// Sarevok's interjection into this conversation

INTERJECT_COPY_TRANS irenic2 iren_intro FinIrenSarevBanter
  == sarev25j IF ~IsValidForPartyDialogue("sarevok")~ THEN @277
  == irenic2 @459
  == sarev25j @278
  == irenic2 @460
END
