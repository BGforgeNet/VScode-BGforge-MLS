/**
 * Rhia dialog for worldmap encounter.
 * Two states gated on wm_start global variable.
 */

function state100() {
  if (Global("wm_start", "GLOBAL", 1)) {
    say(tra(100), tra(101), tra(102), tra(103))
    action(Enemy()).exit()
  }
}

function state110() {
  if (!Global("wm_start", "GLOBAL", 1)) {
    say(tra(110), tra(111))
    action(DestroyItem("WM_SBOOK"), DestroyItem("WM_BEAR"), TakePartyItem("WM_SBOOK"), ForceSpell(Myself, DRYAD_TELEPORT)).exit()
  }
}

begin("WM_RHIA",
  state100,
  state110
)
