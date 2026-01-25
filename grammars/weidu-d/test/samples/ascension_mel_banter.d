//// Melissan banter lines during the fight

REPLACE finmel01
IF ~Global("FinalFight","AR6200",8)Global("ShesInIt","LOCALS",0)~ THEN BEGIN 10 // replace the same-role, same-line block in vanilla dialog, in case any subsequent NPC wants to banter
  SAY #67806 
  IF ~~ THEN DO ~SetGlobal("ShesInIt","LOCALS",1)ActionOverride("cutspy",DestroySelf())Enemy()~ EXIT
END

END // end of REPLACE

APPEND finmel01

IF ~Global("allfive","GLOBAL",1)Global("MelissanIsMortal","LOCALS",1)~ THEN BEGIN mel_mortal
  SAY @630 /* ~What--?  Mortal!  No, it can't be!  I am nearly mortal once again!!  I have lost too much power!!  You shall pay for this!!~ #80545 */
  IF ~~ THEN DO ~SetGlobal("MelissanIsMortal","LOCALS",2)SetInterrupt(TRUE)~ EXIT
END


END