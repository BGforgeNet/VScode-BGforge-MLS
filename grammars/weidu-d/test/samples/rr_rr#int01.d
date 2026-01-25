// creator:  aVENGER
// argument: CoC interjections


BEGIN RR#INT01


// Chosen of Cyric lore comments

INTERJECT_COPY_TRANS3 RR#VEND 15 RR#CoCLore
== IMOEN2J IF ~InParty("Imoen2") InMyArea("Imoen2") !StateCheck("Imoen2",CD_STATE_NOTVALID)~ THEN 
@3000
== KELDORJ IF ~InParty("Keldorn") InMyArea("Keldorn") !StateCheck("Keldorn",CD_STATE_NOTVALID)~ THEN 
@3001
== ANOMENJ IF ~InParty("Anomen") InMyArea("Anomen") !StateCheck("Anomen",CD_STATE_NOTVALID)~ THEN 
@3002
== JAHEIRAJ IF ~InParty("Jaheira") InMyArea("Jaheira") !StateCheck("Jaheira",CD_STATE_NOTVALID)~ THEN 
@3003
== MINSCJ IF ~InParty("Minsc") InMyArea("Minsc") !StateCheck("Minsc",CD_STATE_NOTVALID)~ THEN 
@3004
END


// Slayer Change (give in to the anger) party interjections

INTERJECT_COPY_TRANS3 RR#VEND 143 RR#CoCSlayerWarn
== IMOEN2J IF ~InParty("Imoen2") InMyArea("Imoen2") !StateCheck("Imoen2",CD_STATE_NOTVALID)~ THEN 
@3005
== KELDORJ IF ~InParty("Keldorn") InMyArea("Keldorn") !StateCheck("Keldorn",CD_STATE_NOTVALID)~ THEN 
@3006
== JAHEIRAJ IF ~InParty("Jaheira") InMyArea("Jaheira") !StateCheck("Jaheira",CD_STATE_NOTVALID)~ THEN 
@3007
== AERIEJ IF ~InParty("Aerie") InMyArea("Aerie") !StateCheck("Aerie",CD_STATE_NOTVALID)~ THEN 
@3008
== VICONIJ IF ~InParty("Viconia") InMyArea("Viconia") !StateCheck("Viconia",CD_STATE_NOTVALID)~ THEN 
@3009
== KORGANJ IF ~InParty("Korgan") InMyArea("Korgan") !StateCheck("Korgan",CD_STATE_NOTVALID)~ THEN 
@3010
END


// Venduris' Arcane Wards party interjections (first node)

INTERJECT_COPY_TRANS3 RR#VEND 128 RR#CoCArcaneWard
== EDWINJ IF ~InParty("Edwin") InMyArea("Edwin") !StateCheck("Edwin",CD_STATE_NOTVALID)~ THEN 
@3011
== IMOEN2J IF ~InParty("Imoen2") InMyArea("Imoen2") !StateCheck("Imoen2",CD_STATE_NOTVALID)~ THEN 
@3012
END

// Venduris' Arcane Wards party interjections (second node)

INTERJECT_COPY_TRANS3 RR#VEND 130 RR#CoCArcaneWard
== EDWINJ IF ~InParty("Edwin") InMyArea("Edwin") !StateCheck("Edwin",CD_STATE_NOTVALID)~ THEN 
@3011
== IMOEN2J IF ~InParty("Imoen2") InMyArea("Imoen2") !StateCheck("Imoen2",CD_STATE_NOTVALID)~ THEN 
@3012
END

// Venduris' Sword Coast party interjections

INTERJECT_COPY_TRANS3 RR#VEND 49 RR#CoCSwordCoast
== JAHEIRAJ IF ~InParty("Jaheira") InMyArea("Jaheira") !StateCheck("Jaheira",CD_STATE_NOTVALID)~ THEN
@3013
== IMOEN2J IF ~InParty("Imoen2") InMyArea("Imoen2") !StateCheck("Imoen2",CD_STATE_NOTVALID)~ THEN
@3014
== EDWINJ IF ~InParty("Edwin") InMyArea("Edwin") !StateCheck("Edwin",CD_STATE_NOTVALID)~ THEN 
@3015
== MINSCJ IF ~InParty("Minsc") InMyArea("Minsc") !StateCheck("Minsc",CD_STATE_NOTVALID)~ THEN 
@3016
== VICONIJ IF ~InParty("Viconia") InMyArea("Viconia") !StateCheck("Viconia",CD_STATE_NOTVALID)~ THEN 
@3038
END


// Venduris' scroll Command Phrase party interjections


INTERJECT RR#VWARD 7 RR#NPCWard
== HAERDAJ IF ~InParty("HaerDalis") InMyArea("HaerDalis") !StateCheck("HaerDalis",CD_STATE_NOTVALID)~ THEN 
@3017
=
@3018
=
@3019
END RR#VWARD 8

INTERJECT RR#VWARD 7 RR#NPCWard
== JANJ IF ~InParty("Jan") InMyArea("Jan") !StateCheck("Jan",CD_STATE_NOTVALID)~ THEN 
@3020
=
@3021
=
@3022
END RR#VWARD 8

INTERJECT RR#VWARD 7 RR#NPCWard
== AERIEJ IF ~InParty("Aerie") InMyArea("Aerie") !StateCheck("Aerie",CD_STATE_NOTVALID)~ THEN 
@3023
=
@3024
=
@3025
END RR#VWARD 8

INTERJECT RR#VWARD 7 RR#NPCWard
== NALIAJ IF ~InParty("Nalia") InMyArea("Nalia") !StateCheck("Nalia",CD_STATE_NOTVALID)~ THEN 
@3026
=
@3027
=
@3028
END RR#VWARD 8

INTERJECT RR#VWARD 7 RR#NPCWard
== IMOEN2J IF ~InParty("Imoen2") InMyArea("Imoen2") !StateCheck("Imoen2",CD_STATE_NOTVALID)~ THEN 
@3029
=
@3030
=
@3031
=
@3032
END RR#VWARD 8

INTERJECT RR#VWARD 7 RR#NPCWard
== EDWINJ IF ~InParty("Edwin") InMyArea("Edwin") !StateCheck("Edwin",CD_STATE_NOTVALID)~ THEN 
@3033
=
@3034
=
@3035
=
@3036
=
@3037
END RR#VWARD 8