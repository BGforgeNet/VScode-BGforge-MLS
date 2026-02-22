/**
 * Cromwell the smith dialog patches.
 * Alters forging transitions, adds dual-forge option, adjusts gold costs.
 */

function g_2things() {
  say(tra(2))
  copyTrans("wsmith01", 54)
}

alterTrans("wsmith01", [32], [0], { trigger: False() })

append("wsmith01", g_2things)

replaceTransTrigger("wsmith01", [g_2things], [], 'PartyGoldGT(7499)', 'PartyGoldGT(12499)')
replaceTransAction("wsmith01", [g_2things], [], 'TakePartyGold(7500)', 'TakePartyGold(12500)')
replaceTransAction("wsmith01", [g_2things], [], 'DestroyGold(7500)', 'DestroyGold(12500)')

extendTop("wsmith01", 32, () => {
  reply(tra(3)).action(SetGlobal("ForgeItem", "GLOBAL", 5)).goTo(g_2things)
})
