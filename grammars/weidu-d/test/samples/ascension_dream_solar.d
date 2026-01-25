// this locks the intro block to the final Solar conversation so that it's skipped if
// Balthazar lives

ADD_STATE_TRIGGER SOLAR 59 ~Global("BalthazarFights","GLOBAL",0)~


// DW edit: these string changes don't recognise that these are voiced lines, so that the
// text and the voicing are out of sync. I'm going to deem that a bug, since the changes
// are cosmetic in any case

// REPLACE_SAY SOLAR 60 @230
// REPLACE_SAY SOLAR 61 @231


// this adds a new intro block applicable if he lives

APPEND SOLAR

IF ~Global("TalkedToSolar","GLOBAL",5)
Global("BalthazarFights","GLOBAL",1)~ THEN a68
  SAY @239
  ++ @240 DO ~SetGlobal("TalkedToSolar","GLOBAL",6)~ + a69
END

IF ~~ THEN BEGIN a69
  SAY @241
  ++ @242 + a70
  ++ @243 + a70
  ++ @244 + a70
  ++ @245 + a70
END

IF ~~ THEN BEGIN a70
  SAY @246
  IF ~~ THEN GOTO 60
END

END
