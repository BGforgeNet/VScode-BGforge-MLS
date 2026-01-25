/////////////////////////////////////////////
///// Initial Mel/Irenicus/Charname banter
//////////////////////////////////////////////

APPEND finmel01
IF ~Global("FinalFight","AR6200",2)~ THEN BEGIN mel_call_irenicus
  SAY @607 /* ~Irenicus, I believe you called him.  So easily culled as my own, since you abandoned him here recently...and such a valuable source of information on you, <CHARNAME>.  After all...I believe you did share a soul, once, no?  Say hello to the dear <PRO_MANWOMAN>, Irenicus.~ */
  IF ~~ THEN EXTERN irenic2 iren_intro
END
END // end of APPEND

APPEND irenic2

IF ~~ THEN BEGIN iren_intro
  SAY @435 /* ~Indeed.  We meet once again.~  */
  IF ~~ THEN REPLY @436 /* ~That's okay.  If Sarevok can turn up like a bad penny, then you're allowed to, as well.~ */ EXTERN finmel01 mel_call_imoen
  IF ~~ THEN REPLY @437 /* ~You told her how to influence me, didn't you?  And you told her I was in Suldanessalar.~ */ EXTERN finmel01 mel_call_imoen
  IF ~~ THEN REPLY @438 /* ~You're a pathetic excuse for an elf, Irenicus.  If you wish to die again, I'll happily oblige.~ */ EXTERN finmel01 mel_call_imoen
  IF ~~ THEN REPLY @439 /* ~You're collecting my leavings, Melissan?  How very sad for you.~ */ EXTERN finmel01 mel_call_imoen
END
END // end of APPEND

/////////////////////////////////////////////
///// Mel summons Imoen
//////////////////////////////////////////////

APPEND finmel01
IF ~~ THEN BEGIN mel_call_imoen
  SAY @608 /* ~Of course, if you truly desire a demonstration of my influence over the essence, that can be provided as well.~ */
  IF ~InPartyAllowDead("Imoen2")!Dead("Imoen2")~ 
  THEN GOTO mel_imoen_inparty
  IF ~OR(2)!InParty("Imoen2")Dead("Imoen2")~
  THEN GOTO mel_imoen_summon
END

IF ~~ THEN BEGIN mel_imoen_inparty  // if Imoen is in the party, just talk to her
  SAY @609 /* ~Come, Imoen.  I command the essence within you.  You are not ready to be here...and yet here you are.  Let's see just how much of my power is contained in your young little soul, hmm?~  */
  IF ~~ THEN EXTERN imoen25j imoenj_response
END

IF ~~ THEN BEGIN mel_imoen_summon // if Imoen is not in the party, or is in the party, but dead (edge case, since the PC has just arrived in the Abyss), summon her
  SAY @610 /* ~It seems you've misplaced your darling little Imoen, haven't you?  But her essence is easy enough to command.  Let's see what she has to say, shall we?~ */
  IF ~InPartyAllowDead("Imoen2")~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("resimo1")~ EXIT
  IF ~!InPartyAllowDead("Imoen2")~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("resimo2")~ EXIT
END

IF ~~ THEN BEGIN mel_call_essence // from imoenj_response, imoenp_response
SAY @611 /* ~You don't have to go anywhere, little one.  I'm not calling you, after all...I'm merely coaxing forth your essence.~ */
  IF ~~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("resimo3")~ EXIT
END

END // end of APPEND

// Imoen's party response

APPEND imoen25j
IF ~~ THEN BEGIN imoenj_response
SAY @476 /* ~I'm not going anywhere with you!  And nobody's touching my soul!  Not again!!~ #74283 */
IF ~~ THEN EXTERN finmel01 mel_call_essence
END

END // end of imoen APPEND

// Imoen's non-party response

CHAIN
IF WEIGHT #-5 ~Global("ImoenHurt","GLOBAL",0)
                Global("ImoenBackToHuman","GLOBAL",0)
                OR(2)
                    Global("ImoenResurrected","GLOBAL",1)
                    Global("ImoenResurrected2","GLOBAL",1)~
THEN imoen25p imoenp_response
@475 /* ~Wh-what...where am I?  What's going on?  <CHARNAME>?~ */
== finmel01 @612 /* ~There, there, Imoen.  I command the essence within you.  Let's see just how much of my power you have within you, yes?~ */
== imoen25p @476 /* ~I'm not going anywhere with you!  And nobody's touching my soul!  Not again!!~ */
END finmel01 mel_call_essence

/////////////////////////////////////////////
///// Conversation with Imoen continues after mel casts resimo3
//////////////////////////////////////////////

APPEND imoen25p

IF WEIGHT #-5 ~Global("ImoenHurt","GLOBAL",1)~ THEN BEGIN imoen_hurt
  SAY @470 /* ~Nnngh!  Ah, it hurts!  <CHARNAME>, stop her...it...it hurts!!~ [IMOEN18]  */
  IF ~~ THEN REPLY @471  DO ~SetGlobal("ImoenHurt","GLOBAL",0)~ EXTERN finmel01 6
  IF ~~ THEN REPLY @472  DO ~SetGlobal("ImoenHurt","GLOBAL",0)~ EXTERN finmel01 6
  IF ~~ THEN REPLY @473  DO ~SetGlobal("ImoenHurt","GLOBAL",0)~ EXTERN finmel01 6
  IF ~~ THEN REPLY @474  DO ~SetGlobal("ImoenHate","GLOBAL",1)SetGlobal("ImoenHurt","GLOBAL",0)~ EXTERN finmel01 6    // this is the 'what do I care?' response
END
END // end of APPEND

REPLACE finmel01 

IF ~~  THEN BEGIN 6 // replace the similar block from vanilla script in case a later NPC mod INTERJECT_COPY_TRANSs onto it
  SAY @597
  IF ~~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("resimo4")~ EXIT
END

END // end of REPLACE

