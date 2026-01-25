// creator  : aVENGER
// argument : RR#DEDRL.DLG

BEGIN ~RR#DEDRL~

IF ~NumTimesTalkedTo(0)
Global("RR#TalkedDedral","RR#010",0)~ THEN BEGIN 0 // from:
  SAY #39226 /* ~Intruders! Disable the guillotines! I need to come through!~ */
  IF ~~ THEN DO ~SetGlobal("RR#TalkedDedral","RR#010",1)
MoveToPointNoInterrupt([1332.955])
DestroySelf()~ EXIT
END

IF ~Global("RR#TalkedDedral","RR#010",1)~ THEN BEGIN 1 // from:
  SAY #39229 /* ~You've walked right into our web, fool! Take no prisoners! We must protect Aran!~ */
  IF ~~ THEN DO ~Enemy()~ EXIT
END
