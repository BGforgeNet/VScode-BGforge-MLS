// Based on grammars/weidu-d/test/samples/familiars.d
// Complete familiar dialog - follow, combat, loot, potions menus

const dialog = "FAMILIAR";
const state = "start";
const deathVar = "familiar_death";

// Global variable names (GVAR_ prefix for GLOBAL scope)
const GVAR_FamFollowMaster = "g_FamFollowMaster";
const GVAR_FamSpeed = "g_FamSpeed";
const GVAR_FamJumpToPack = "g_FamJumpToPack";
const GVAR_FamiliarJumpOut = "g_FamiliarJumpOut";
const GVAR_FamHurtNotif = "g_FamHurtNotif";
const GVAR_FamBadlyHurtNotif = "g_FamBadlyHurtNotif";
const GVAR_FamHitAndRun = "g_FamHitAndRun";
const GVAR_FamTactic = "g_FamTactic";
const GVAR_FamPickupGold = "g_FamPickupGold";
const GVAR_FamPickupJewels = "g_FamPickupJewels";
const GVAR_FamPickupAmmo = "g_FamPickupAmmo";
const GVAR_FamPickupPotions = "g_FamPickupPotions";
const GVAR_FamPickupScrolls = "g_FamPickupScrolls";
const GVAR_FamPickupTrophy = "g_FamPickupTrophy";
const GVAR_FamPickupScalps = "g_FamPickupScalps";

// Binary toggle options: [varName, traOn, traOff]
const binaryToggles = [
    [GVAR_FamPickupGold, 402, 403],
    [GVAR_FamPickupAmmo, 408, 409],
    [GVAR_FamPickupPotions, 410, 411],
    [GVAR_FamPickupScrolls, 412, 413],
    [GVAR_FamPickupScalps, 414, 415],
    [GVAR_FamPickupTrophy, 416, 417],
];

// Multi-value options: [value, traRef] - uses !Global trigger
const jumpToPackOptions = [[1, 301], [2, 303], [3, 304], [0, 302]];
const tacticOptions = [[0, 314], [1, 315], [2, 316]];
const jewelsOptions = [[1, 404], [2, 405], [3, 406], [0, 407]];

// Menu entries: [traRef, targetFunc]
const menuEntries = [
    [101, "g_familiar_follow"],
    [102, "g_familiar_combat"],
    [103, "g_familiar_loot"],
    [104, "g_familiar_potions"],
];

// =============================================================================
// Follow settings
// =============================================================================
function g_familiar_follow() {
    say(tra(100));

    if (Global(GVAR_FamFollowMaster, "GLOBAL", 0)) {
        reply(tra(201));
        action(SetGlobal(GVAR_FamFollowMaster, "GLOBAL", 1));
        goto(g_familiar_confirm);
    }

    if (Global(GVAR_FamFollowMaster, "GLOBAL", 1)) {
        reply(tra(202));
        action(SetGlobal(GVAR_FamFollowMaster, "GLOBAL", 0));
        goto(g_familiar_confirm);
    }

    if (Global(GVAR_FamSpeed, "GLOBAL", 0)) {
        reply(tra(203));
        action(
            SetGlobal(GVAR_FamSpeed, "GLOBAL", 1),
            ApplySpellRES("G_FSPED1", deathVar)
        );
        goto(g_familiar_confirm);
    }

    if (Global(GVAR_FamSpeed, "GLOBAL", 1)) {
        reply(tra(204));
        action(
            SetGlobal(GVAR_FamSpeed, "GLOBAL", 0),
            ApplySpellRES("G_FSPED0", deathVar)
        );
        goto(g_familiar_confirm);
    }

    reply(tra(205));
    goto(state);
}

// =============================================================================
// Combat settings
// =============================================================================
function g_familiar_combat() {
    say(tra(100));

    // Hide options (GVAR_FamJumpToPack: 0=never, 1=enemies, 2=injured, 3=badly injured)
    for (const [val, traRef] of jumpToPackOptions) {
        if (!Global(GVAR_FamJumpToPack, "GLOBAL", val)) {
            reply(tra(traRef));
            action(SetGlobal(GVAR_FamJumpToPack, "GLOBAL", val));
            goto(g_familiar_confirm);
        }
    }

    // Jump out options
    if (Global(GVAR_FamiliarJumpOut, "GLOBAL", 0)) {
        reply(tra(306));
        action(SetGlobal(GVAR_FamiliarJumpOut, "GLOBAL", 1));
        goto(g_familiar_confirm);
    }

    if (Global(GVAR_FamiliarJumpOut, "GLOBAL", 1)) {
        reply(tra(307));
        action(SetGlobal(GVAR_FamiliarJumpOut, "GLOBAL", 0));
        goto(g_familiar_confirm);
    }

    // Hurt notifications
    if (OR(2, Global(GVAR_FamHurtNotif, "GLOBAL", 1), Global(GVAR_FamBadlyHurtNotif, "GLOBAL", 1))) {
        reply(tra(309));
        action(
            SetGlobal(GVAR_FamHurtNotif, "GLOBAL", 0),
            SetGlobal(GVAR_FamBadlyHurtNotif, "GLOBAL", 0)
        );
        goto(g_familiar_confirm);
    }

    if (Global(GVAR_FamHurtNotif, "GLOBAL", 0)) {
        reply(tra(310));
        action(
            SetGlobal(GVAR_FamHurtNotif, "GLOBAL", 1),
            SetGlobal(GVAR_FamBadlyHurtNotif, "GLOBAL", 0)
        );
        goto(g_familiar_confirm);
    }

    if (Global(GVAR_FamBadlyHurtNotif, "GLOBAL", 0)) {
        reply(tra(311));
        action(
            SetGlobal(GVAR_FamHurtNotif, "GLOBAL", 0),
            SetGlobal(GVAR_FamBadlyHurtNotif, "GLOBAL", 1)
        );
        goto(g_familiar_confirm);
    }

    // Hit and run
    if (Global(GVAR_FamHitAndRun, "GLOBAL", 0)) {
        reply(tra(312));
        action(SetGlobal(GVAR_FamHitAndRun, "GLOBAL", 1));
        goto(g_familiar_confirm);
    }

    if (Global(GVAR_FamHitAndRun, "GLOBAL", 1)) {
        reply(tra(313));
        action(SetGlobal(GVAR_FamHitAndRun, "GLOBAL", 0));
        goto(g_familiar_confirm);
    }

    // Combat tactics
    for (const [val, traRef] of tacticOptions) {
        if (!Global(GVAR_FamTactic, "GLOBAL", val)) {
            reply(tra(traRef));
            action(SetGlobal(GVAR_FamTactic, "GLOBAL", val));
            goto(g_familiar_confirm);
        }
    }

    reply(tra(105));
    goto(state);
}

// =============================================================================
// Potion settings
// =============================================================================
function g_familiar_potions() {
    say(tra(104));
    // Note: %action_drink% transitions generated in main.tpa are not included here
    reply(tra(105));
    goto(state);
}

// =============================================================================
// Loot settings
// =============================================================================
function g_familiar_loot() {
    say(tra(100));

    // Disable all pickup
    reply(tra(400));
    action(
        SetGlobal(GVAR_FamPickupGold, "GLOBAL", 0),
        SetGlobal(GVAR_FamPickupJewels, "GLOBAL", 0),
        SetGlobal(GVAR_FamPickupAmmo, "GLOBAL", 0),
        SetGlobal(GVAR_FamPickupPotions, "GLOBAL", 0),
        SetGlobal(GVAR_FamPickupScrolls, "GLOBAL", 0),
        SetGlobal(GVAR_FamPickupTrophy, "GLOBAL", 0),
        SetGlobal(GVAR_FamPickupScalps, "GLOBAL", 0)
    );
    goto(g_familiar_confirm);

    // Enable all pickup
    reply(tra(401));
    action(
        SetGlobal(GVAR_FamPickupGold, "GLOBAL", 1),
        SetGlobal(GVAR_FamPickupJewels, "GLOBAL", 1),
        SetGlobal(GVAR_FamPickupAmmo, "GLOBAL", 1),
        SetGlobal(GVAR_FamPickupPotions, "GLOBAL", 1),
        SetGlobal(GVAR_FamPickupScrolls, "GLOBAL", 1),
        SetGlobal(GVAR_FamPickupTrophy, "GLOBAL", 1),
        SetGlobal(GVAR_FamPickupScalps, "GLOBAL", 1)
    );
    goto(g_familiar_confirm);

    // Binary toggles
    for (const [varName, traOn, traOff] of binaryToggles) {
        if (Global(varName, "GLOBAL", 0)) {
            reply(tra(traOn));
            action(SetGlobal(varName, "GLOBAL", 1));
            goto(g_familiar_confirm);
        }
        if (Global(varName, "GLOBAL", 1)) {
            reply(tra(traOff));
            action(SetGlobal(varName, "GLOBAL", 0));
            goto(g_familiar_confirm);
        }
    }

    // Jewels (4 values)
    for (const [val, traRef] of jewelsOptions) {
        if (!Global(GVAR_FamPickupJewels, "GLOBAL", val)) {
            reply(tra(traRef));
            action(SetGlobal(GVAR_FamPickupJewels, "GLOBAL", val));
            goto(g_familiar_confirm);
        }
    }

    reply(tra(418));
    goto(state);
}

// =============================================================================
// Confirmation state
// =============================================================================
function g_familiar_confirm() {
    say(tra(419));
    goto(state);
}

// =============================================================================
// Extend menu and register states
// =============================================================================
extendTop(dialog, state, () => {
    for (const [traRef, target] of menuEntries) {
        if (InPartySlot(LastTalkedToBy, 0)) {
            reply(tra(traRef));
            goto(target);
        }
    }
});

append(dialog, [
    g_familiar_follow,
    g_familiar_combat,
    g_familiar_potions,
    g_familiar_loot,
    g_familiar_confirm,
]);
