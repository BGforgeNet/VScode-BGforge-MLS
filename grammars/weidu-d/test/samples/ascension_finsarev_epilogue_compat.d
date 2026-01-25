// compatibility hooks for Imoen Romance - erased out of finsol01 after we use them for a IJT

EXTEND_BOTTOM finsol01 27
IF ~Global("sarev_imoen_compat_hook","GLOBAL",1)Global("fin_sarevok_external_friendly","GLOBAL",1)~ THEN GOTO 27
END

EXTEND_BOTTOM finsol01 29
IF ~Global("sarev_imoen_compat_hook","GLOBAL",2)Global("fin_sarevok_external_friendly","GLOBAL",1)~ THEN GOTO 29
END

EXTEND_BOTTOM finsol01 30
IF ~Global("sarev_imoen_compat_hook","GLOBAL",2)Global("fin_sarevok_external_friendly","GLOBAL",1)~ THEN GOTO 30
END

EXTEND_BOTTOM finsol01 31
IF ~Global("sarev_imoen_compat_hook","GLOBAL",2)Global("fin_sarevok_external_friendly","GLOBAL",1)~ THEN GOTO 31
END

EXTEND_BOTTOM finsol01 32
IF ~Global("sarev_imoen_compat_hook","GLOBAL",2)Global("fin_sarevok_external_friendly","GLOBAL",1)~ THEN GOTO 32
END