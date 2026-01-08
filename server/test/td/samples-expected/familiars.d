/* Generated from familiars.td - do not edit */

EXTEND_TOP FAMILIAR start
    +~InPartySlot(LastTalkedToBy,0)~+ @101 + g_familiar_follow
    +~InPartySlot(LastTalkedToBy,0)~+ @102 + g_familiar_combat
    +~InPartySlot(LastTalkedToBy,0)~+ @103 + g_familiar_loot
    +~InPartySlot(LastTalkedToBy,0)~+ @104 + g_familiar_potions
END

APPEND FAMILIAR
IF ~~ g_familiar_follow
    SAY @100
    +~Global("g_FamFollowMaster","GLOBAL",0)~+ @201 DO ~SetGlobal("g_FamFollowMaster","GLOBAL",1)~ + g_familiar_confirm
    +~Global("g_FamFollowMaster","GLOBAL",1)~+ @202 DO ~SetGlobal("g_FamFollowMaster","GLOBAL",0)~ + g_familiar_confirm
    +~Global("g_FamSpeed","GLOBAL",0)~+ @203 DO ~SetGlobal("g_FamSpeed","GLOBAL",1) ApplySpellRES("G_FSPED1","familiar_death")~ + g_familiar_confirm
    +~Global("g_FamSpeed","GLOBAL",1)~+ @204 DO ~SetGlobal("g_FamSpeed","GLOBAL",0) ApplySpellRES("G_FSPED0","familiar_death")~ + g_familiar_confirm
    ++ @205 + start
END

IF ~~ g_familiar_combat
    SAY @100
    +~!Global("g_FamJumpToPack","GLOBAL",1)~+ @301 DO ~SetGlobal("g_FamJumpToPack","GLOBAL",1)~ + g_familiar_confirm
    +~!Global("g_FamJumpToPack","GLOBAL",2)~+ @303 DO ~SetGlobal("g_FamJumpToPack","GLOBAL",2)~ + g_familiar_confirm
    +~!Global("g_FamJumpToPack","GLOBAL",3)~+ @304 DO ~SetGlobal("g_FamJumpToPack","GLOBAL",3)~ + g_familiar_confirm
    +~!Global("g_FamJumpToPack","GLOBAL",0)~+ @302 DO ~SetGlobal("g_FamJumpToPack","GLOBAL",0)~ + g_familiar_confirm
    +~Global("g_FamiliarJumpOut","GLOBAL",0)~+ @306 DO ~SetGlobal("g_FamiliarJumpOut","GLOBAL",1)~ + g_familiar_confirm
    +~Global("g_FamiliarJumpOut","GLOBAL",1)~+ @307 DO ~SetGlobal("g_FamiliarJumpOut","GLOBAL",0)~ + g_familiar_confirm
    +~OR(2) Global("g_FamHurtNotif","GLOBAL",1) Global("g_FamBadlyHurtNotif","GLOBAL",1)~+ @309 DO ~SetGlobal("g_FamHurtNotif","GLOBAL",0) SetGlobal("g_FamBadlyHurtNotif","GLOBAL",0)~ + g_familiar_confirm
    +~Global("g_FamHurtNotif","GLOBAL",0)~+ @310 DO ~SetGlobal("g_FamHurtNotif","GLOBAL",1) SetGlobal("g_FamBadlyHurtNotif","GLOBAL",0)~ + g_familiar_confirm
    +~Global("g_FamBadlyHurtNotif","GLOBAL",0)~+ @311 DO ~SetGlobal("g_FamHurtNotif","GLOBAL",0) SetGlobal("g_FamBadlyHurtNotif","GLOBAL",1)~ + g_familiar_confirm
    +~Global("g_FamHitAndRun","GLOBAL",0)~+ @312 DO ~SetGlobal("g_FamHitAndRun","GLOBAL",1)~ + g_familiar_confirm
    +~Global("g_FamHitAndRun","GLOBAL",1)~+ @313 DO ~SetGlobal("g_FamHitAndRun","GLOBAL",0)~ + g_familiar_confirm
    +~!Global("g_FamTactic","GLOBAL",0)~+ @314 DO ~SetGlobal("g_FamTactic","GLOBAL",0)~ + g_familiar_confirm
    +~!Global("g_FamTactic","GLOBAL",1)~+ @315 DO ~SetGlobal("g_FamTactic","GLOBAL",1)~ + g_familiar_confirm
    +~!Global("g_FamTactic","GLOBAL",2)~+ @316 DO ~SetGlobal("g_FamTactic","GLOBAL",2)~ + g_familiar_confirm
    ++ @105 + start
END

IF ~~ g_familiar_potions
    SAY @104
    ++ @105 + start
END

IF ~~ g_familiar_loot
    SAY @100
    ++ @400 DO ~SetGlobal("g_FamPickupGold","GLOBAL",0) SetGlobal("g_FamPickupJewels","GLOBAL",0) SetGlobal("g_FamPickupAmmo","GLOBAL",0) SetGlobal("g_FamPickupPotions","GLOBAL",0) SetGlobal("g_FamPickupScrolls","GLOBAL",0) SetGlobal("g_FamPickupTrophy","GLOBAL",0) SetGlobal("g_FamPickupScalps","GLOBAL",0)~ + g_familiar_confirm
    ++ @401 DO ~SetGlobal("g_FamPickupGold","GLOBAL",1) SetGlobal("g_FamPickupJewels","GLOBAL",1) SetGlobal("g_FamPickupAmmo","GLOBAL",1) SetGlobal("g_FamPickupPotions","GLOBAL",1) SetGlobal("g_FamPickupScrolls","GLOBAL",1) SetGlobal("g_FamPickupTrophy","GLOBAL",1) SetGlobal("g_FamPickupScalps","GLOBAL",1)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupGold,"GLOBAL",0)~+ @402 DO ~SetGlobal(GVAR_FamPickupGold,"GLOBAL",1)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupGold,"GLOBAL",1)~+ @403 DO ~SetGlobal(GVAR_FamPickupGold,"GLOBAL",0)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupAmmo,"GLOBAL",0)~+ @408 DO ~SetGlobal(GVAR_FamPickupAmmo,"GLOBAL",1)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupAmmo,"GLOBAL",1)~+ @409 DO ~SetGlobal(GVAR_FamPickupAmmo,"GLOBAL",0)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupPotions,"GLOBAL",0)~+ @410 DO ~SetGlobal(GVAR_FamPickupPotions,"GLOBAL",1)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupPotions,"GLOBAL",1)~+ @411 DO ~SetGlobal(GVAR_FamPickupPotions,"GLOBAL",0)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupScrolls,"GLOBAL",0)~+ @412 DO ~SetGlobal(GVAR_FamPickupScrolls,"GLOBAL",1)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupScrolls,"GLOBAL",1)~+ @413 DO ~SetGlobal(GVAR_FamPickupScrolls,"GLOBAL",0)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupScalps,"GLOBAL",0)~+ @414 DO ~SetGlobal(GVAR_FamPickupScalps,"GLOBAL",1)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupScalps,"GLOBAL",1)~+ @415 DO ~SetGlobal(GVAR_FamPickupScalps,"GLOBAL",0)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupTrophy,"GLOBAL",0)~+ @416 DO ~SetGlobal(GVAR_FamPickupTrophy,"GLOBAL",1)~ + g_familiar_confirm
    +~Global(GVAR_FamPickupTrophy,"GLOBAL",1)~+ @417 DO ~SetGlobal(GVAR_FamPickupTrophy,"GLOBAL",0)~ + g_familiar_confirm
    +~!Global("g_FamPickupJewels","GLOBAL",1)~+ @404 DO ~SetGlobal("g_FamPickupJewels","GLOBAL",1)~ + g_familiar_confirm
    +~!Global("g_FamPickupJewels","GLOBAL",2)~+ @405 DO ~SetGlobal("g_FamPickupJewels","GLOBAL",2)~ + g_familiar_confirm
    +~!Global("g_FamPickupJewels","GLOBAL",3)~+ @406 DO ~SetGlobal("g_FamPickupJewels","GLOBAL",3)~ + g_familiar_confirm
    +~!Global("g_FamPickupJewels","GLOBAL",0)~+ @407 DO ~SetGlobal("g_FamPickupJewels","GLOBAL",0)~ + g_familiar_confirm
    ++ @418 + start
END

IF ~~ g_familiar_confirm
    SAY @419
    IF ~~ THEN GOTO start
END
END
