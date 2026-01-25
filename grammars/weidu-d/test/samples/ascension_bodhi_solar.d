//////////////////////////////////////////////////////////////////////////
////////////  Bodhi's interjection into the Solar conversation
/////////////////////////////////////////////////////////////////////////

/// Solar block 4 needs to allow dialog to start here, since in the Bodhi
/// conversation we exit and re-enter

REPLACE_STATE_TRIGGER finsol01 4 ~!NumTimesTalkedTo(0)~

// Solar block 4 also needs to branch off Bodhi here

EXTEND_BOTTOM finsol01 4 
    IF ~Global("BodhiFights","GLOBAL",1)~ THEN EXTERN finbodh bodhi_interjection
END


//////////////////////////
/// Bodhi initial conversation
///////////////////////////

APPEND finbodh

IF ~~ THEN BEGIN bodhi_interjection
  SAY @72 =@73
  IF ~~ THEN REPLY @74 DO ~SetGlobal("BodhiHappyBunny","LOCALS",1)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif01")~ EXIT // give reward graciously
  IF ~~ THEN REPLY @75 GOTO refuse_reward_1
  IF ~~ THEN REPLY @76 DO ~SetGlobal("BodhiHappyBunny","LOCALS",2)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif01")~ EXIT // give reward grudgingly
  IF ~~ THEN REPLY @77 GOTO refuse_reward_2
END

IF ~~ THEN BEGIN refuse_reward_1
  SAY @78 /* ~Fool!  You think to betray me, Child of Bhaal?  I refuse to return to the abyss.  I shall rip every shred of that soul from your body!  Let the dance end here!~  */
  IF ~Global("BodhiPromised","GLOBAL",1)~ THEN DO ~SetGlobal("BodhiHappyBunny","LOCALS",3)~ EXTERN finsol01 solar_enforces_deal
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @79 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @80 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @81 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @82 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
END

IF ~~ THEN BEGIN refuse_reward_2
  SAY @83 /* ~So you have betrayed me, <CHARNAME>.  It would seem that working together was never our true calling.~  */
  IF ~Global("BodhiPromised","GLOBAL",1)~ THEN DO ~SetGlobal("BodhiHappyBunny","LOCALS",3)~ EXTERN finsol01 solar_enforces_deal
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @79 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @80 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @81 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
  IF ~Global("BodhiPromised","GLOBAL",0)~ THEN REPLY @82 DO ~SetGlobal("BodhiFights","GLOBAL",0)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif02")~ EXIT // disintegrate Bodhi
END

END // end of APPEND

APPEND finsol01

IF ~~ THEN BEGIN solar_enforces_deal
  SAY @586
  IF ~~ THEN DO ~ClearAllActions()StartCutSceneMode()StartCutScene("bodhif01")~ EXIT
END

END // end of APPEND

/////////////////////
/// Bodhi subsequent conversation
////////////////////

APPEND finbodh

IF ~Global("BodhiHappyBunny","LOCALS",1)~ THEN BEGIN bodhi_soul_gracious
  SAY @84
  IF ~~ THEN GOTO bodhi_departs
END

IF ~Global("BodhiHappyBunny","LOCALS",2)~ THEN BEGIN bodhi_soul_ungracious
  SAY @85
  IF ~~ THEN GOTO bodhi_departs
END

IF ~Global("BodhiHappyBunny","LOCALS",3)~ THEN BEGIN bodhi_departs
  SAY @86
  IF ~~ THEN DO ~SetGlobal("BodhiFights","GLOBAL",2)ClearAllActions()StartCutSceneMode()StartCutScene("bodhif03")~ EXIT
END

END // end of APPEND
