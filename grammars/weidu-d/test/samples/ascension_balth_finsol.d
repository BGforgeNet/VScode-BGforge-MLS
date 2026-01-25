


/// Balth's interjection to advise the player

INTERJECT_COPY_TRANS finsol01 27 balth_sol_1
== balth2 IF ~Global("BalthazarFights","GLOBAL",1)~ THEN
@1012 = @1013 = @1014 = @1015
END

// Balth's interjection if you become a god

INTERJECT_COPY_TRANS FINSOL01 29 balth_sol_2
== balth2 IF ~Global("BalthazarFights","GLOBAL",1)~ THEN @1017 END
INTERJECT_COPY_TRANS FINSOL01 30 balth_sol_2
== balth2 IF ~Global("BalthazarFights","GLOBAL",1)~ THEN @1017 END
INTERJECT_COPY_TRANS FINSOL01 31 balth_sol_2
== balth2 IF ~Global("BalthazarFights","GLOBAL",1)~ THEN @1017 END

// Balth's interjection if you stay mortal

INTERJECT_COPY_TRANS FINSOL01 32 balth_sol_2
== balth2 IF ~Global("BalthazarFights","GLOBAL",1)~ THEN @1016 END

// Solar's dealing with Balth about his own taint

ADD_TRANS_TRIGGER FINSOL01 4 ~Global("BalthazarFights","GLOBAL",0)~
EXTEND_BOTTOM finsol01 4 IF  ~Global("BalthazarFights","GLOBAL",1)OR(2)!InParty("Imoen2")Dead("Imoen2")~ THEN GOTO balth_alone END
EXTEND_BOTTOM finsol01 4 IF  ~Global("BalthazarFights","GLOBAL",1)InParty("Imoen2")!Dead("Imoen2")~ THEN GOTO balth_imoen END

APPEND finsol01

IF ~~ THEN BEGIN balth_alone
SAY @580
IF ~~ THEN EXTERN balth2 balth_renounce_taint
END

IF ~~ THEN BEGIN balth_imoen
SAY @581
IF ~~ THEN EXTERN balth2 balth_renounce_taint
END

IF ~~ THEN BEGIN balth_happy
SAY @584
IF ~InParty("Imoen2")!Dead("Imoen2")~ THEN GOTO imoens_turn
IF ~OR(2)!InParty("Imoen2")Dead("Imoen2")~ THEN GOTO 5
END

IF ~~ THEN BEGIN imoens_turn
SAY @585
  IF ~~ THEN EXTERN ~IMOEN25J~ 14
END
END // end of APPENDs to finsol01

CHAIN
IF ~~ THEN balth2 balth_renounce_taint
@1009
== finsol01 @582
== balth2 @1010
== finsol01 @583
== balth2 @1011
END finsol01 balth_happy



