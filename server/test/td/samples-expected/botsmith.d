/* Generated from botsmith.td - do not edit */

EXTEND_BOTTOM BOTSMITH 0
    ++ @20 + g_item_type
END

APPEND BOTSMITH
IF ~~ g_item_type
    SAY @21
    ++ @3 + g_weapon
    ++ @4 + g_armor
    ++ @5 + g_trinket
    ++ @6 + 0
END

IF ~~ g_weapon
    SAY @22
    ++ @10 + g_item_type
    ++ @6 + 0
END

IF ~~ g_armor
    SAY @23
    ++ @10 + g_item_type
    ++ @6 + 0
END

IF ~~ g_trinket
    SAY @24
    ++ @10 + g_item_type
    ++ @6 + 0
END
END
