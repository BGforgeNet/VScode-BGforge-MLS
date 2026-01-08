// Test patch operations (ALTER_TRANS, REPLACE_*, ADD_*, etc.)

// ALTER_TRANS - modify existing transitions
alterTrans("wsmith01", [32], [0], {
    trigger: False(),
});

// ADD_STATE_TRIGGER - add trigger to state
addStateTrigger("BJALVAR", "state1",
    Global("newCondition","GLOBAL",1)
);

// ADD_TRANS_TRIGGER - add trigger to transitions
addTransTrigger("BJALVAR", ["state1"],
    !Global("blocked","GLOBAL",1),
    { trans: [0, 1, 2] }
);

// ADD_TRANS_ACTION - add action to transitions
addTransAction("BJALVAR", ["state1"], [0, 1],
    SetGlobal("acted","GLOBAL",1)
);

// REPLACE_TRANS_TRIGGER - find/replace in transition triggers
replaceTransTrigger("wsmith01", ["g_2things"], [],
    "PartyGoldGT(7499)", "PartyGoldGT(12499)"
);

// REPLACE_TRANS_ACTION - find/replace in transition actions
replaceTransAction("wsmith01", ["g_2things"], [],
    "TakePartyGold(7500)", "TakePartyGold(12500)"
);

// REPLACE_TRIGGER_TEXT - global trigger text replacement (single file)
replaceTriggerText("BJALVAR", "OldTrigger", "NewTrigger");

// REPLACE_ACTION_TEXT - global action text replacement (multiple files)
replaceActionText(["player1"],
    "ReputationInc(-1)", `ReputationInc(-1)
ReallyForceSpell(Myself,1607)`
);

// SET_WEIGHT - set state weight
setWeight("BJALVAR", "state1", 5);

// REPLACE_SAY - replace SAY text
replaceSay("BJALVAR", "state1", tra(999));

// REPLACE_STATE_TRIGGER - replace state trigger
replaceStateTrigger("BJALVAR", [1, 2, 3],
    Global("newTrigger","GLOBAL",1)
);
