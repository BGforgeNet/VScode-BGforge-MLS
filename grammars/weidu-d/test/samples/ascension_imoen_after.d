///////////////////////////////////////////////
//// Imoen conversation with CHARNAME after
//// de-slayerising
///////////////////////////////////////////////

APPEND imoen25p

// intro block

IF WEIGHT #-5 ~Global("ImoenBackToHuman","GLOBAL",1)~ THEN BEGIN intro
  SAY @477 /* ~It...it's gone...I'm human again.  Ohhhh, now I know what you went through, <CHARNAME>!  I don't know if I ever want to go through that again!~ #75870 */
  IF ~Global("ImoenHate","GLOBAL",1)~ THEN DO ~SetGlobal("ImoenBackToHuman","GLOBAL",2)~ GOTO angry
  IF ~Global("ImoenResurrected2","GLOBAL",1)Global("ImoenHate","GLOBAL",0)~ THEN DO ~SetGlobal("ImoenBackToHuman","GLOBAL",2)~ GOTO depart_not_in_party
  IF ~Global("ImoenResurrected2","GLOBAL",0)Global("ImoenHate","GLOBAL",0)~ THEN DO ~SetGlobal("ImoenBackToHuman","GLOBAL",2)~ GOTO in_party_combat_check
END

// deal with Imoen being pissed off with you

IF ~~ THEN BEGIN angry
  SAY @478 /* ~And I can't believe what you said, either!  'Go ahead and kill her'?  After all we've been through, that's what you say in my defense?!~ #75871 */
  IF ~CheckStatGT(Player1,15,CHR)~ THEN REPLY @479  GOTO mollified
  IF ~!CheckStatGT(Player1,15,CHR)~ THEN REPLY @479  GOTO depart_sulky
  IF ~~ THEN REPLY @480 GOTO depart_furious
  IF ~Global("FIN_irenicus_fight_over","AR6200",0)~ THEN REPLY @481  GOTO rejoin_in_combat_from_angry
END

IF ~~ THEN BEGIN mollified // DW: added an are-we-in-combat check here
  SAY @482 /* ~Well...I suppose.  You convinced me more than her, obviously.  I...I'm just glad I didn't do more damage as the slayer.  I don't know how you handled it.  Thank you for...for not killing me.~ #74306 */
  IF ~Global("ImoenResurrected2","GLOBAL",1)~ THEN GOTO depart_not_in_party
  IF ~!Global("ImoenResurrected2","GLOBAL",1)!Global("FIN_irenicus_fight_over","AR6200",0)~ THEN GOTO rejoin
  IF ~!Global("ImoenResurrected2","GLOBAL",1)Global("FIN_irenicus_fight_over","AR6200",0)~ THEN GOTO rejoin_in_combat
END

// if not angry, check combat state

IF ~~ THEN BEGIN in_party_combat_check
  SAY @491 /* ~I'm...just glad I didn't do anything worse while I was...when I...oh, I just don't know how you handled it back in Spellhold.  Thank you for...not killing me, okay?~ #82745 */
  IF ~!Global("FIN_irenicus_fight_over","AR6200",0)~ THEN GOTO rejoin
  IF ~Global("FIN_irenicus_fight_over","AR6200",0)~ THEN GOTO rejoin_in_combat
END

// offers to rejoin

IF ~~ THEN BEGIN rejoin
  SAY @484 /* ~Do you need me to join back up with you?  I could...leave the Throne, I think...I think I have that power, now, same as you.  But I'll fight by your side again, if you want me to.~ #82742 */
  IF ~~ THEN REPLY @486  DO ~SetGlobal("ImoenResurrected","GLOBAL",0)DisplayStringHead(Myself,@1000)ApplySpellRES("finimogr",Myself)JoinParty()~ JOURNAL @485 EXIT
  IF ~~ THEN REPLY @487 GOTO depart_friendly
END

IF ~~ THEN BEGIN rejoin_in_combat
  SAY @493 /* ~I see the fight's still going on.  Do you need me back in the party?  I could...leave the Throne, I think...I think I have that power, now, same as you.  But I'd like to see this through, same as you.~ #82746 */
  IF ~~ THEN REPLY @486 GOTO rejoin_in_combat_response
  IF ~~ THEN REPLY @494 GOTO rejoin_in_combat_response
  IF ~~ THEN REPLY @487 GOTO depart_friendly
END

IF ~~ THEN BEGIN rejoin_in_combat_response
  SAY @495 /* ~Yes <PRO_SIRMAAM>!  (giggle!)  Time to kick a certain someone's butt, right?~ #82748 */
  IF ~~ THEN DO ~SetGlobal("ImoenResurrected","GLOBAL",0)DisplayStringHead(Myself,@1000)ApplySpellRES("finimogr",Myself)JoinParty()~ JOURNAL @485 EXIT
END

IF ~~ THEN BEGIN rejoin_in_combat_from_angry
  SAY @492 /* ~Oh, so it is!  Do you need me back in the party?  I could...leave the Throne, I think...I think I have that power, now, same as you.  But I'll fight by your side again, if you want me to.~ #82744 */
  IF ~~ THEN REPLY @486 GOTO rejoin_in_combat_response
  IF ~~ THEN REPLY @494 GOTO rejoin_in_combat_response
  IF ~~ THEN REPLY @487 GOTO depart_friendly
END

// imoen departure states

IF ~~ THEN BEGIN depart_sulky
  SAY @489 /* ~Yeah, right.  You do whatever you have to, <CHARNAME>.  Me...I'm getting as far away from here as possible.  Good-bye!~ #74313 */
  IF ~~ THEN DO ~ForceSpell(Myself,DRYAD_TELEPORT)~ EXIT
END

IF ~~ THEN BEGIN depart_furious
  SAY @490 /* ~Nope, you sure didn't.  Thanks for nothing, I guess.  You do whatever you have to, <CHARNAME>.  Me...I'm getting as far away from here as possible.  Good-bye!~ #74315 */
  IF ~~ THEN DO ~ForceSpell(Myself,DRYAD_TELEPORT)~ EXIT
END

IF ~~ THEN BEGIN depart_friendly // in this state, she leaves her stuff and you get her epilogue anyway
  SAY @488 /* ~I wish you well, <CHARNAME>, and I hope I'll see you again.  Maybe back at Candlekeep, huh?  Anyway...good luck...~ #74311 */
  IF ~~ THEN DO ~SetGlobal("ImoenEpilogueAnyway","GLOBAL",1)DropInventory()ForceSpell(Myself,DRYAD_TELEPORT)~ EXIT
END

IF ~~ THEN BEGIN depart_not_in_party
  SAY @483 /* ~I...I can't stay here, though.  This is way out of my league.  I wish you well, <CHARNAME>, and I hope I'll see you again.  Maybe back at Candlekeep, huh?  Anyway...good luck...~ #74307 */
  IF ~~ THEN DO ~ForceSpell(Myself,DRYAD_TELEPORT)~ EXIT
END


END // end of APPEND