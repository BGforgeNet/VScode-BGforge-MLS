// creator  : aVENGER
// argument : GAELAN2.DLG

ADD_TRANS_ACTION ~GAELAN2~ BEGIN 0 END BEGIN 0 END
~SetGlobal("RR#STIM_GAELAN2","GLOBAL",1)
CreateCreature("RR#STI01",[438.421],0)
CreateCreature("RR#STI01",[600.298],0)
CreateCreature("RR#STI01",[497.302],0)
CreateCreature("RR#STI03",[205.350],12)
CreateCreature("RR#STI03",[242.413],12)
ChangeAIScript("RR#GAELN",OVERRIDE)
Enemy()
UseItem("POTN10",Myself) // Potion of Invisibility
DisplayStringHead(Myself,46150) //  quaffs a potion
SetGlobalTimer("RR#Cast","LOCALS",6)~