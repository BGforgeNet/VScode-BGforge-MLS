/* Generated from ascension_dream_mel_v2.td - do not edit */

REPLACE_SAY MELISS01 14 @422

APPEND MELISS01
    IF ~~ a18
        SAY @433
        +~Global("BalthazarFights","GLOBAL",1)~+ @420 + a19
        IF ~Global("BalthazarFights","GLOBAL",0)~ GOTO 15
    END

    IF ~~ a19
        SAY @434
        IF ~~ GOTO 13
    END
END

EXTEND_BOTTOM MELISS01 12
    ++ @419 DO ~IncrementGlobal("Bhaal25Dream5","GLOBAL",-1)~ + a18
    +~Global("BalthazarFights","GLOBAL",1)~+ @420 + a19
END
