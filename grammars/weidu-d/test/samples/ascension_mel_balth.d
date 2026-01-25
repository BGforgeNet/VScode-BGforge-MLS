/// these are the initial Melissan/Balth banters, terminating in an exit state (finmel01 5, which
/// is the exit state in either Asc or vanilla)

// If it did it right, this commutes with mel_initial from the main Asc component

CHAIN
IF ~~ THEN balth2 bal_chain
@1003
== finmel01 @614
== balth2 @1004
== finmel01 @615
END finmel01 5

CHAIN 
IF ~~ THEN balth2 bal_chain_ext
@1002
== finmel01 @613
END balth2 bal_chain

// patch them into 2 and 4

ADD_TRANS_TRIGGER finmel01 2 ~Global("BalthazarFights","GLOBAL",0)~
ADD_TRANS_TRIGGER finmel01 4 ~Global("BalthazarFights","GLOBAL",0)~
EXTEND_BOTTOM finmel01 2 IF  ~Global("BalthazarFights","GLOBAL",1)~ THEN EXTERN balth2 bal_chain_ext END
EXTEND_BOTTOM finmel01 4 IF  ~Global("BalthazarFights","GLOBAL",1)~ THEN EXTERN balth2 bal_chain_ext END

// block the 'you don't rule here alone' answer if Balth is on-side and add its variant

ADD_TRANS_TRIGGER finmel01 1 ~Global("BalthazarFights","GLOBAL",0)~ DO 1
EXTEND_TOP finmel01 1 #1 IF ~Global("BalthazarFights","GLOBAL",1)~ THEN REPLY @591 GOTO mel1 END

APPEND finmel01

IF ~~ THEN mel1
SAY @605
IF ~~ THEN EXTERN balth2 bal_chain
END

END
