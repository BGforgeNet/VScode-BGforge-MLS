// creator  : aVENGER
// argument : RR#ALCH

BEGIN ~RR#ALCH~

IF ~True()~ THEN BEGIN a0
SAY @8121 // (With cleverness innate to the class, an experienced rogue has seen enough potions in his or her adventuring career to simulate the creation of one. However, the costs for any raw materials that are used in the process must be paid.)
=
@8122 // (This ability allows a rogue to brew one of the potions from the following list:)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(199)~ THEN REPLY @8130 DO ~TakePartyGold(200) DestroyGold(200) GiveItemCreate("POTN36",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Master Thievery (200 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(174)~ THEN REPLY @8131 DO ~TakePartyGold(175) DestroyGold(175) GiveItemCreate("POTN39",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Perception (175 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(124)~ THEN REPLY @8132 DO ~TakePartyGold(225) DestroyGold(225) GiveItemCreate("POTN10",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Invisibility (125 gp)

IF ~Class(LastTalkedToBy(Myself),BARD_ALL) PartyGoldGT(249)~ THEN REPLY @8140 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN37",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Mind Focusing (250 gp)

IF ~Class(LastTalkedToBy(Myself),BARD_ALL) PartyGoldGT(349)~ THEN REPLY @8141 DO ~TakePartyGold(350) DestroyGold(350) GiveItemCreate("POTN21",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Clarity (350 gp)

IF ~Class(LastTalkedToBy(Myself),BARD_ALL) PartyGoldGT(249)~ THEN REPLY @8142 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN42",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Regeneration (250 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(349)~ THEN REPLY @8133 DO ~TakePartyGold(350) DestroyGold(350) GiveItemCreate("POTN24",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Defense (350 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(224)~ THEN REPLY @8134 DO ~TakePartyGold(325) DestroyGold(325) GiveItemCreate("POTN55",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Superior Healing (325 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(49)~ THEN REPLY @8135 DO ~TakePartyGold(125) DestroyGold(125) GiveItemCreate("POTN17",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Elixir of Health (125 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(249)~ THEN REPLY @8136 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN14",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Oil of Speed (250 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(249)~ THEN REPLY @8137 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN13",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Oil of Fiery Burning (250 gp)

IF ~Class(LastTalkedToBy(Myself),BARD_ALL) PartyGoldGT(124)~ THEN REPLY @8143 DO ~TakePartyGold(125) DestroyGold(125) GiveItemCreate("POTN45",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Freedom (125 gp)

IF ~!Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(374)~ THEN REPLY @8138 DO ~TakePartyGold(375) DestroyGold(375) GiveItemCreate("POTN56",LastTalkedToBy(Myself),1,1,1) DestroySelf()~ EXIT // Potion of Frost Giant Strength (375 gp)


IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(199)~ THEN REPLY @8130 DO ~TakePartyGold(200) DestroyGold(200) GiveItemCreate("POTN36",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Master Thievery (200 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(174)~ THEN REPLY @8131 DO ~TakePartyGold(175) DestroyGold(175) GiveItemCreate("POTN39",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Perception (175 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(124)~ THEN REPLY @8132 DO ~TakePartyGold(225) DestroyGold(225) GiveItemCreate("POTN10",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Invisibility (125 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(349)~ THEN REPLY @8133 DO ~TakePartyGold(350) DestroyGold(350) GiveItemCreate("POTN24",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Defense (350 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(224)~ THEN REPLY @8134 DO ~TakePartyGold(325) DestroyGold(325) GiveItemCreate("POTN55",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Superior Healing (325 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(49)~ THEN REPLY @8135 DO ~TakePartyGold(125) DestroyGold(125) GiveItemCreate("POTN17",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Elixir of Health (125 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(249)~ THEN REPLY @8136 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN14",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Oil of Speed (250 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) Class(LastTalkedToBy(Myself),THIEF_ALL) PartyGoldGT(249)~ THEN REPLY @8137 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN13",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Oil of Fiery Burning (250 gp)

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER) PartyGoldGT(374)~ THEN REPLY @8138 DO ~TakePartyGold(375) DestroyGold(375) GiveItemCreate("POTN56",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Frost Giant Strength (375 gp)


IF ~~ THEN REPLY @8150 DO ~DestroySelf()~ EXIT // (Do not brew any potions.)
END



// A dedicated dialogue block for Bounty Hunters

IF ~Kit(LastTalkedToBy(Myself),BOUNTYHUNTER)~ THEN BEGIN a10
SAY @8123 // (Due to his advanced alchemical knowledge, a Bounty Hunter can make three times as many potions as a regular rogue in one setting.)
=
@8122 // (This ability allows a rogue to brew one of the potions from the following list:)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(199)~ THEN REPLY @8130 DO ~TakePartyGold(200) DestroyGold(200) GiveItemCreate("POTN36",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Master Thievery (200 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(174)~ THEN REPLY @8131 DO ~TakePartyGold(175) DestroyGold(175) GiveItemCreate("POTN39",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Perception (175 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(124)~ THEN REPLY @8132 DO ~TakePartyGold(225) DestroyGold(225) GiveItemCreate("POTN10",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Invisibility (125 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(349)~ THEN REPLY @8133 DO ~TakePartyGold(350) DestroyGold(350) GiveItemCreate("POTN24",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Defense (350 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(224)~ THEN REPLY @8134 DO ~TakePartyGold(325) DestroyGold(325) GiveItemCreate("POTN55",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Superior Healing (325 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(49)~ THEN REPLY @8135 DO ~TakePartyGold(125) DestroyGold(125) GiveItemCreate("POTN17",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Elixir of Health (125 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(249)~ THEN REPLY @8136 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN14",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Oil of Speed (250 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(249)~ THEN REPLY @8137 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN13",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Oil of Fiery Burning (250 gp)

IF ~GlobalLT("RR#BHALCH","LOCALS",2) PartyGoldGT(374)~ THEN REPLY @8138 DO ~TakePartyGold(375) DestroyGold(375) GiveItemCreate("POTN56",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1)~ GOTO a10 // Potion of Frost Giant Strength (375 gp)


IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(199)~ THEN REPLY @8130 DO ~TakePartyGold(200) DestroyGold(200) GiveItemCreate("POTN36",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Potion of Master Thievery (200 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(174)~ THEN REPLY @8131 DO ~TakePartyGold(175) DestroyGold(175) GiveItemCreate("POTN39",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Potion of Perception (175 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(124)~ THEN REPLY @8132 DO ~TakePartyGold(225) DestroyGold(225) GiveItemCreate("POTN10",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Potion of Invisibility (125 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(349)~ THEN REPLY @8133 DO ~TakePartyGold(350) DestroyGold(350) GiveItemCreate("POTN24",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Potion of Defense (350 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(224)~ THEN REPLY @8134 DO ~TakePartyGold(325) DestroyGold(325) GiveItemCreate("POTN55",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Potion of Superior Healing (325 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(49)~ THEN REPLY @8135 DO ~TakePartyGold(125) DestroyGold(125) GiveItemCreate("POTN17",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Elixir of Health (125 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(249)~ THEN REPLY @8136 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN14",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Oil of Speed (250 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(249)~ THEN REPLY @8137 DO ~TakePartyGold(250) DestroyGold(250) GiveItemCreate("POTN13",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Oil of Fiery Burning (250 gp)

IF ~Global("RR#BHALCH","LOCALS",2) PartyGoldGT(374)~ THEN REPLY @8138 DO ~TakePartyGold(375) DestroyGold(375) GiveItemCreate("POTN56",LastTalkedToBy(Myself),1,1,1) IncrementGlobal("RR#BHALCH","LOCALS",1) DestroySelf()~ EXIT // Potion of Frost Giant Strength (375 gp)


IF ~~ THEN REPLY @8150 DO ~DestroySelf()~ EXIT // (Do not brew any potions.)
END