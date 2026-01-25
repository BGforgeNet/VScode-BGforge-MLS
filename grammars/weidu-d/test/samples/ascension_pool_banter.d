///// Conversations with whoever (Balth/Bodhi if available, internal monologue if not) to tell you 
///// what to do after Irenicus is dead

APPEND balth2

IF ~Global("FinalFight","AR6200",4)~ THEN BEGIN balth_pool
  SAY @1005 = @1006 = @1007 
  IF ~~ THEN DO ~SetGlobal("FinalFight","AR6200",5)~ EXIT
END

END // end of APPEND

APPEND finbodh

IF ~Global("FinalFight","AR6200",4)~ THEN BEGIN bodhi_pool
  SAY @91 = @92 = @93
  IF ~~ THEN DO ~SetGlobal("FinalFight","AR6200",5)~ EXIT
END

END // end of APPEND


APPEND player1

IF ~Global("FinalFight","AR6200",4)~ THEN BEGIN inner_monologue_pool
  SAY @396 = @397 
  IF ~~ THEN DO ~SetGlobal("FinalFight","AR6200",5)~ EXIT
END

END // end of APPEND