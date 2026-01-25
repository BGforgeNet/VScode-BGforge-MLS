//// the lines spoken to prompt the player to stop Mel's immortality
//// there is a variable mismatch in Sarevok's and Balthazar's lines,
//// which I fix

/////////////
// Sarevok
// NB this originally checked to make sure it wasn't Sarevok's sword conversation (edge case: I guess the player *could* not get around to providing it till now). But this ought to be higher priority in any case.
/////////////

APPEND sarev25j

IF ~Global("MelStillImmortal","AR6200",3)~ THEN BEGIN sarev_inter
  SAY @274 /* ~Blast!  The wench returns to Bhaal's essence like a coward, healing herself!  There must be a way to weaken her further, or we will never defeat her!~ */
  IF ~~ THEN DO ~SetGlobal("MelStillImmortal","AR6200",4)~ EXIT
END

END // end of APPEND

/////////////
// Balthazar
/////////////

APPEND balth2

IF ~Global("MelStillImmortal","AR6200",3)~ THEN BEGIN balth_inter
  SAY @1018 /* ~Melissan keeps restoring her immortal energies at the fount!  There must be a way to weaken her further, or we will never defeat her!~ */
  IF ~~ THEN DO ~SetGlobal("MelStillImmortal","AR6200",4)~ EXIT
END

END // end of APPEND

//////////////////
/// Inner monologue
//////////////////

APPEND player1

IF WEIGHT #-4 ~Global("MelStillImmortal","AR6200",3)~ THEN BEGIN player1_inter
  SAY @398 /* ~Melissan continues to restore her divine energies at the fountain, keeping her immortality intact.  There must be a way to weaken her further, or you will never be able to defeat her.~  */
  IF ~~ THEN DO ~SetGlobal("MelStillImmortal","AR6200",4)~ EXIT
END

END // end of APPEND