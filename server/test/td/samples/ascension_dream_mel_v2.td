/**
 * Ascension dream sequence - Melissan dialog extensions.
 * Extends MELISS01 dialog with dream-related transitions.
 */

function a18() {
  say(tra(433))
  if (Global("BalthazarFights", "GLOBAL", 1)) { reply(tra(420)).goTo(a19) }
  if (Global("BalthazarFights", "GLOBAL", 0)) { goTo(15) }
}

function a19() {
  say(tra(434))
  goTo(13)
}

replaceSay("MELISS01", 14, tra(422))

append("MELISS01", a18, a19)

extendBottom("MELISS01", 12, () => {
  reply(tra(419)).action(IncrementGlobal("Bhaal25Dream5", "GLOBAL", -1)).goTo(a18)
  if (Global("BalthazarFights", "GLOBAL", 1)) {
    reply(tra(420)).goTo(a19)
  }
})
