// Based on grammars/weidu-d/test/samples/wm_rhia.d
// Rhialto's Dialogue - 2 states with multiple SAY statements

const dialog = "WM_RHIA";

if (Global("wm_start", "GLOBAL", 1)) {
    function state100() {
        say(tra(100));
        say(tra(101));
        say(tra(102));
        say(tra(103));

        action(Enemy());
        exit();
    }
}

if (!Global("wm_start", "GLOBAL", 1)) {
    function state110() {
        say(tra(110));
        say(tra(111));

        action(
            DestroyItem("WM_SBOOK"),
            DestroyItem("WM_BEAR"),
            TakePartyItem("WM_SBOOK"),
            ForceSpell(Myself, DRYAD_TELEPORT)
        );
        exit();
    }
}

export default begin(dialog, [state100, state110]);
