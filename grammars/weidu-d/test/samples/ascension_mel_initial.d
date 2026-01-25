
// if I did this right, it should commute with mel_balth

// Melissan state 5 is reused as the general exit state from initial banter

// Route the other exit states (2,3) to it

ALTER_TRANS finmel01 BEGIN 2 3 END BEGIN 0 END BEGIN "EPILOGUE" ~GOTO 5~ END
ALTER_TRANS finmel01 BEGIN 2 3 END BEGIN 0 END BEGIN "ACTION" ~~ END

// Destructively overwrite the exit state (no real prospect of compatibility here, and this needs to
// do what it's supposed to do or we'll break the critical path)

REPLACE finmel01
IF ~~ THEN 5
  SAY @604
  IF ~~ THEN DO ~ClearAllActions() StartCutSceneMode() StartCutScene("finmel1")~ EXIT
END

END

// replace the text of Mel's 'I'm surprised at your bluster' block
 REPLACE_SAY finmel01 4 @606
 
// deactivate state 9, which is part of the vanilla progression and not used in Ascension

REPLACE_STATE_TRIGGER finmel01 9 ~False()~