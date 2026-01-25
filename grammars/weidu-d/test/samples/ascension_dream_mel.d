///////////////////////////////////////////////////////////////////////
// Ascension : MELISS01
///////////////////////////////////////////////////////////////////////
// (1) adds more transitions to state 12
// (2) changes the SAY text in state 14
// (3) appends states 18 -- 19
///////////////////////////////////////////////////////////////////////

EXTEND_BOTTOM MELISS01 12
  IF ~~ THEN REPLY @419 /* ~Oh, please.  I saw you coming from a mile away.  I just played along because I had no choice.~ #74260 */ DO ~IncrementGlobal("Bhaal25Dream5","GLOBAL",-1)~ GOTO a18
  IF ~Global("BalthazarFights","GLOBAL",1)~ THEN REPLY @420 /* ~Well, your plan didn't work out quite like you thought.  Balthazar is still alive.~ #74263 */ GOTO a19
END

REPLACE_SAY MELISS01 14 @422 /* ~Do you dare come and face me there?  Or shall I have to hunt you down like the sorry dog that you are?  Because make no mistake...one way or another, every last drop of that divine essence will be *mine*.~ [MELISS23] #74259 */

APPEND MELISS01

IF ~~ THEN BEGIN a18 // from: 12.6
  SAY @433 /* ~As long as you did what you were required to and kill the Five, then I care little for what you think you know, fool.~ #74261 */
  IF ~Global("BalthazarFights","GLOBAL",1)~ THEN REPLY @420 /* ~Well, your plan didn't work out quite like you thought.  Balthazar is still alive.~ #74262 */ GOTO a19
  IF ~Global("BalthazarFights","GLOBAL",0)~ THEN GOTO 15
END

IF ~~ THEN BEGIN a19 // from: 18.0 12.7
  SAY @434 /* ~So you managed to corral Balthazar into co-operating with you?  I'm surprised.  In the end, however, the essence of one or two of Bhaal's get means very little.~ #74264 */
  IF ~~ THEN GOTO 13
END

END /* end of: APPEND MELISS01 */
