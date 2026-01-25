// creator  : aVENGER
// argument : ARLED.DLG

BEGIN RR#INT02 

// Haer'Dalis translates Arledrian's journal

INTERJECT RR#ARLEJ 1 RR#HaerTranslatesJournal
== HAERDAJ IF ~InParty("HaerDalis") InMyArea("HaerDalis") !StateCheck("HaerDalis",CD_STATE_NOTVALID)~ THEN
@1503
=
@1504
=
@1505
=
@1506
=
@1507
END RR#ARLEJ 4

// Cernd translates Arledrian's journal

INTERJECT RR#ARLEJ 1 RR#CerndTranslatesJournal
== CERNDJ IF ~InParty("Cernd") InMyArea("Cernd") !StateCheck("Cernd",CD_STATE_NOTVALID)~ THEN
@1508
=
@1509
=
@1510
=
@1511
END RR#ARLEJ 4

// Viconia translates Arledrian's journal

INTERJECT RR#ARLEJ 1 RR#ViconiaTranslatesJournal
== VICONIJ IF ~InParty("Viconia") InMyArea("Viconia") !StateCheck("Viconia",CD_STATE_NOTVALID)~ THEN
@1512
=
@1513
=
@1514
END RR#ARLEJ 4

// Aerie translates Arledrian's journal

INTERJECT RR#ARLEJ 1 RR#AerieTranslatesJournal
== AERIEJ IF ~InParty("Aerie") InMyArea("Aerie") !StateCheck("Aerie",CD_STATE_NOTVALID)~ THEN
@1515
=
@1516
=
@1517
END RR#ARLEJ 4

// Jaheira translates Arledrian's journal

INTERJECT RR#ARLEJ 1 RR#JaheiraTranslatesJournal
== JAHEIRAJ IF ~InParty("Jaheira") InMyArea("Jaheira") !StateCheck("Jaheira",CD_STATE_NOTVALID)~ THEN
@1518
=
@1519
=
@1520
=
@1521
END RR#ARLEJ 4