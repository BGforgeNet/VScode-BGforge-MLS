/* Generated from test_patch.td - do not edit */

ALTER_TRANS wsmith01
BEGIN 32 END
BEGIN 0 END
BEGIN
  "TRIGGER" ~False()~
END

ADD_STATE_TRIGGER BJALVAR state1 ~Global("newCondition","GLOBAL",1)~

ADD_TRANS_TRIGGER BJALVAR state1 ~!Global("blocked","GLOBAL",1)~ DO 0 1 2

ADD_TRANS_ACTION BJALVAR BEGIN state1 END BEGIN 0 1 END ~SetGlobal("acted","GLOBAL",1)~

REPLACE_TRANS_TRIGGER wsmith01 BEGIN g_2things END BEGIN  END ~PartyGoldGT(7499)~ ~PartyGoldGT(12499)~

REPLACE_TRANS_ACTION wsmith01 BEGIN g_2things END BEGIN  END ~TakePartyGold(7500)~ ~TakePartyGold(12500)~

REPLACE_TRIGGER_TEXT BJALVAR ~OldTrigger~ ~NewTrigger~

REPLACE_ACTION_TEXT player1 ~ReputationInc(-1)~ ~ReputationInc(-1)
ReallyForceSpell(Myself,1607)~

SET_WEIGHT BJALVAR state1 #5

REPLACE_SAY BJALVAR state1 @999

REPLACE_STATE_TRIGGER BJALVAR 1 ~Global("newTrigger","GLOBAL",1)~ 2 3
