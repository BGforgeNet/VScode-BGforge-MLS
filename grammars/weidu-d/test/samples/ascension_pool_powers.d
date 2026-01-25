//////////////////////////////////////////////////////////////////
/// Vanilla Ascension tries to use
/// the LastTalkedTo trigger to select
/// what dialog to use. This doesn't
/// work for some reason (it's ignored
/// in at least the first-used trigger
/// block of a script, perhaps because it
/// doesn't get set till the conversation
/// starts.)
///
/// Instead, we set a variable from the activation script

BEGIN ~PPGUY02~

IF ~Global("fin_pool_talker","AR6200",2)~ THEN a0
  SAY @1
  IF ~~ THEN DO ~ApplySpellRES("baldead",Player2)SetGlobal("fin_pool_talker","AR6200",0)DestroySelf()~ EXIT
END

// to avoid messing up the component numbering of the main parts for other mods (esp. Turnabout) the next few blocks are at the end

IF ~Global("Pool1Active","AR6200",2)~ THEN a1 // CHARNAME
  SAY @2
  IF ~Global("fin_pool_talker","AR6200",1)!Global("Pool2Active","AR6200",3) !Global("Pool3Active","AR6200",3) DifficultyLT(4)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3) ReallyForceSpellRES("pool1a",Player1) ClearAllActions() StartCutSceneMode() StartCutScene("pool1b")~ JOURNAL @3 EXIT
  IF ~Global("fin_pool_talker","AR6200",1)Global("Pool2Active","AR6200",3) Global("Pool3Active","AR6200",3)~ THEN DO ~ReallyForceSpellRES("pool1a",Player1)~ JOURNAL @4 + a4
  IF ~Global("fin_pool_talker","AR6200",1)!Global("Pool2Active","AR6200",3) Global("Pool3Active","AR6200",3)~ THEN DO ~ReallyForceSpellRES("pool1a",Player1)~ JOURNAL @4 + a5
  IF ~Global("fin_pool_talker","AR6200",1)Global("Pool2Active","AR6200",3) !Global("Pool3Active","AR6200",3)~ THEN DO ~ReallyForceSpellRES("pool1a",Player1)~ JOURNAL @4 + a5
  IF ~Global("fin_pool_talker","AR6200",1)!Global("Pool2Active","AR6200",3) !Global("Pool3Active","AR6200",3) DifficultyGT(3)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3) ReallyForceSpellRES("pool1a",Player1) ClearAllActions() StartCutSceneMode() StartCutScene("pool1b2")~ JOURNAL @3 EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)!Global("Pool2Active","AR6200",3) !Global("Pool3Active","AR6200",3) DifficultyLT(4)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3) ReallyForceSpellRES("finplim","Imoen2") ClearAllActions() StartCutSceneMode() StartCutScene("pool1b")~ JOURNAL @3 EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)Global("Pool2Active","AR6200",3) Global("Pool3Active","AR6200",3)~ THEN DO ~ReallyForceSpellRES("finplim","Imoen2")~ JOURNAL @4 + a4
  IF ~!Global("fin_pool_talker","AR6200",1)!Global("Pool2Active","AR6200",3) Global("Pool3Active","AR6200",3)~ THEN DO ~ReallyForceSpellRES("finplim","Imoen2")~ JOURNAL @4 + a5
  IF ~!Global("fin_pool_talker","AR6200",1)Global("Pool2Active","AR6200",3) !Global("Pool3Active","AR6200",3)~ THEN DO ~ReallyForceSpellRES("finplim","Imoen2")~ JOURNAL @4 + a5
  IF ~!Global("fin_pool_talker","AR6200",1)!Global("Pool2Active","AR6200",3) !Global("Pool3Active","AR6200",3) DifficultyGT(3)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3) ReallyForceSpellRES("finplim","Imoen2") ClearAllActions() StartCutSceneMode() StartCutScene("pool1b2")~ JOURNAL @3 EXIT

END

IF ~Global("Pool2Active","AR6200",2)~ THEN a2
  SAY @5
  IF ~Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3)  !Global("Pool3Active","AR6200",3) DifficultyLT(4)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A",Player1) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b")~ JOURNAL @6 EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3)  !Global("Pool3Active","AR6200",3) DifficultyLT(4)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A","Imoen2") ClearAllActions() StartCutSceneMode() StartCutScene("pool2b")~ JOURNAL @6 EXIT
  IF ~Global("Pool1Active","AR6200",3) Global("Pool3Active","AR6200",3)~ THEN JOURNAL @6 + a6
  IF ~!Global("Pool1Active","AR6200",3) Global("Pool3Active","AR6200",3)~ THEN JOURNAL @6 + a7
  IF ~Global("Pool1Active","AR6200",3) !Global("Pool3Active","AR6200",3)~ THEN JOURNAL @6 + a7
  IF ~Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3) !Global("Pool3Active","AR6200",3) DifficultyGT(3)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A",Player1) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b2")~ JOURNAL @6 EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3) !Global("Pool3Active","AR6200",3) DifficultyGT(3)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A","Imoen2") ClearAllActions() StartCutSceneMode() StartCutScene("pool2b2")~ JOURNAL @6 EXIT
END

IF ~Global("Pool3Active","AR6200",2)~ THEN a3
  SAY @7
  IF ~Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3) !Global("Pool2Active","AR6200",3) DifficultyLT(4)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A",Player1) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b")~ JOURNAL @9 EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3) !Global("Pool2Active","AR6200",3) DifficultyLT(4)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A","Imoen2") ClearAllActions() StartCutSceneMode() StartCutScene("pool3b")~ JOURNAL @9 EXIT
  IF ~Global("Pool1Active","AR6200",3) Global("Pool2Active","AR6200",3)~ THEN JOURNAL @9 + a8
  IF ~Global("Pool1Active","AR6200",3) !Global("Pool2Active","AR6200",3)~ THEN JOURNAL @9 + a9
  IF ~!Global("Pool1Active","AR6200",3) Global("Pool2Active","AR6200",3)~ THEN JOURNAL @9 + a9
  IF ~Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3) !Global("Pool2Active","AR6200",3) DifficultyGT(3)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A",Player1) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b2")~ JOURNAL @9 EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)!Global("Pool1Active","AR6200",3) !Global("Pool2Active","AR6200",3) DifficultyGT(3)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A","Imoen2") ClearAllActions() StartCutSceneMode() StartCutScene("pool3b2")~ JOURNAL @9 EXIT
END

IF ~~ THEN a4
  SAY @10
  IF ~DifficultyLT(5)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool1b")~ EXIT
  IF ~Difficulty(5)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool1b2")~ EXIT
END

IF ~~ THEN a5
  SAY @11
  IF ~DifficultyLT(3)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool1b")~ EXIT
  IF ~DifficultyGT(2)~ THEN DO ~SetGlobal("Pool1Active","AR6200",3)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool1b2")~ EXIT
END

IF ~~ THEN a6
  SAY @10
  IF ~Global("fin_pool_talker","AR6200",1)DifficultyLT(5)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL2A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b")~ EXIT
  IF ~Global("fin_pool_talker","AR6200",1)Difficulty(5)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL2A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b2")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)DifficultyLT(5)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL2A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)Difficulty(5)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL2A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b2")~ EXIT
END

IF ~~ THEN a7
  SAY @11
  IF ~Global("fin_pool_talker","AR6200",1)DifficultyLT(3)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b")~ EXIT
  IF ~Global("fin_pool_talker","AR6200",1)DifficultyGT(2)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b2")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)DifficultyLT(3)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)DifficultyGT(2)~ THEN DO ~SetGlobal("Pool2Active","AR6200",3) ReallyForceSpellRES("POOL2A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool2b2")~ EXIT
END

IF ~~ THEN a8
  SAY @10
  IF ~Global("fin_pool_talker","AR6200",1)DifficultyLT(5)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL3A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b")~ EXIT
  IF ~Global("fin_pool_talker","AR6200",1)Difficulty(5)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL3A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b2")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)DifficultyLT(5)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL3A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)Difficulty(5)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) SetGlobalTimer("MelissanComes","AR6200",25) ReallyForceSpellRES("POOL3A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b2")~ EXIT
END

IF ~~ THEN a9
  SAY @11
  IF ~Global("fin_pool_talker","AR6200",1)DifficultyLT(3)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b")~ EXIT
  IF ~Global("fin_pool_talker","AR6200",1)DifficultyGT(2)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A",Player1)SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b2")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)DifficultyLT(3)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b")~ EXIT
  IF ~!Global("fin_pool_talker","AR6200",1)DifficultyGT(2)~ THEN DO ~SetGlobal("Pool3Active","AR6200",3) ReallyForceSpellRES("POOL3A","Imoen2")SetGlobal("fin_pool_talker","AR6200",0) ClearAllActions() StartCutSceneMode() StartCutScene("pool3b2")~ EXIT
END

IF WEIGHT #-10 ~Global("fin_pool_talker","AR6200",3)~ THEN a0
  SAY @1
  IF ~~ THEN DO ~ApplySpellRES("baldead",Player3)SetGlobal("fin_pool_talker","AR6200",0)DestroySelf()~ EXIT
END
IF WEIGHT #-10 ~Global("fin_pool_talker","AR6200",4)~ THEN a0
  SAY @1
  IF ~~ THEN DO ~ApplySpellRES("baldead",Player4)SetGlobal("fin_pool_talker","AR6200",0)DestroySelf()~ EXIT
END
IF WEIGHT #-10 ~Global("fin_pool_talker","AR6200",5)~ THEN a0
  SAY @1
  IF ~~ THEN DO ~ApplySpellRES("baldead",Player5)SetGlobal("fin_pool_talker","AR6200",0)DestroySelf()~ EXIT
END
IF WEIGHT #-10 ~Global("fin_pool_talker","AR6200",6)~ THEN a0
  SAY @1
  IF ~~ THEN DO ~ApplySpellRES("baldead",Player6)SetGlobal("fin_pool_talker","AR6200",0)DestroySelf()~ EXIT
END



