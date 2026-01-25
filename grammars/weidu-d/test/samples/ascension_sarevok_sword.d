///////////////////////////////////////////////////////////////////////
// Ascension: SAREV25J
///////////////////////////////////////////////////////////////////////
// (1) appends states 15--28
///////////////////////////////////////////////////////////////////////

APPEND ~SAREV25J~




IF ~Global("SarevokHasSword","LOCALS",1)~ THEN BEGIN a25 // from:
  SAY @275 /* ~My blade, is it?  I had thought this lost forever.  It is good to have it back.  While I no longer have the essence to channel through it, it is still a Deathbringer's weapon and I can restore much of its power.  I would not suggest you attempt to use it yourself, now.~ #82791 */
  IF ~~ THEN DO ~SetGlobal("SarevokHasSword","LOCALS",2)~ GOTO a26
END

IF ~~ THEN BEGIN a26 // from: 25.0
  SAY @276 /* ~You wouldn't have my armor, too, hidden about somewhere within your packs?  Hmph.  I suppose some things are too much to hope for.~ #82792 */
  IF ~~ THEN DO ~DestroyItem("sw2h16")
GiveItemCreate("finsarev",Myself,0,0,0)
~ EXIT
END


END
