/** @tra dialog.tra */

//---------------------------------------------------------------------------------------
//         -----------------------------------
//           Spellshaper Interactive Levelup
//         -----------------------------------
//---------------------------------------------------------------------------------------
//
// This Dialogue offers interactive choices during levelup
//
// It's first called by BALDUR.BCS, when a Non-Lawful Wild Mage drops to 50% Hitpoints.
//
// Select a special ability at levels 1,3,5,7,9,12,15,18,21
// Int 16+ allows extra feats at levels 24,27,30,36,42,48
//
// The Dialog is always started, but when intelligence is to low,
// There are no lines to display, and nothing happens ingame...
//
// Local Variables:
//
// wm_feat_ambidextrous  = "Ambidextrousity" (Two Ranks!)
// wm_feat_vicious     = "Vicious Hits" (+1 Damage)
// wm_feat_toughness   = "Toughness" (+10% Hitpoints)
// wm_feat_criticals   = "Improved Criticals" (+1 Critical Hit Range)
//----------------------------------------------------------------------------------------

BEGIN WM_LEVEL

//---------------------------------------    Become a Spellshaper?

IF ~Global("wm_spellshaper","GLOBAL",1)~ Doit
  SAY @220 = @221
  IF ~~ REPLY @222 GOTO Yes
  IF ~~ REPLY @223 GOTO No
END

IF ~~ No
  SAY @224
   IF ~~ DO ~SetGlobal("wm_spellshaper","GLOBAL",-1)~ EXIT
END

IF ~~ Yes
  SAY @225
   IF ~~ DO ~SetGlobal("wm_spellshaper","GLOBAL",2)
                  SetGlobal("wm_level","LOCALS",-10)
                  ChangeAIScript("wm_chao1",OVERRIDE)~ EXIT
END

IF ~Global("wm_spellshaper","GLOBAL",2)~ Done
  SAY @230 = @231 = @232
  IF ~~ DO ~SetGlobal("wm_spellshaper","GLOBAL",100)~ GOTO 0
END

//----------------------------------------------------------------------------------------

//---------------------------------------    Level < 24 OR Int 19
IF ~or(2)
     LevelLT(Myself,24)
     !CheckStatLT(Myself,19,INT)~ 0
  SAY @200

  IF ~!LevelLT(Myself,5)~          // Weaveshear
     REPLY @217 GOTO shear

  IF ~!LevelLT(Myself,3)~          // Weave Spell
     REPLY @216 GOTO Weave

  IF ~Global("wm_feat_ambidextrous","LOCALS",0)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @201 GOTO ambidex

  IF ~Global("wm_feat_ambidextrous","LOCALS",1)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @202 GOTO ambidex

  IF ~CheckStat(Myself,1,BACKSTABDAMAGEMULTIPLIER)~     // Backstabbing (x2)
     REPLY @203 GOTO backstab

  IF ~CheckStat(Myself,2,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Adept (x3)
      !LevelLT(Myself,5)
      !CheckStatLT(Myself,14,DEX)~
     REPLY @204 GOTO backstab

  IF ~CheckStat(Myself,3,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Expert (x4)
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,15,DEX)~
     REPLY @205 GOTO backstab

  IF ~CheckStat(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Master (x5)
      !LevelLT(Myself,15)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @206 GOTO backstab

  IF ~Global("wm_feat_ambidextrous","LOCALS",2)      // Combat Speed
      !LevelLT(Myself,18)~
     REPLY @207 GOTO speed

  IF ~CheckStat(Myself,1,PROFICIENCYDAGGER)~      // Dagger Specialization
     REPLY @208 GOTO dagger

  IF ~Global("wm_feat_criticals","LOCALS",0)      // Improved Criticals
      !LevelLT(Myself,9)~
     REPLY @210 GOTO quick

  IF ~Global("wm_feat_toughness","LOCALS",0)       // Toughness
      !LevelLT(Myself,3)~
     REPLY @211 GOTO tough

  IF ~!GlobalGT("wm_feat_vicious","LOCALS",4)      // Vicious hits
      !LevelLT(Myself,3)~
     REPLY @212 GOTO damage

  IF ~!CheckStatLT(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Rogue HLA: Assassination
      !LevelLT(Myself,18)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @213 GOTO assassin

  IF ~Global("wm_feat_toughness","LOCALS",1)      // Rogue HLA: Avoid Death
      !LevelLT(Myself,18)~
     REPLY @214 GOTO avoid

  IF ~!CheckStatLT(Myself,16,DEX)        // Rogue HLA: Evasion
      !LevelLT(Myself,18)~
     REPLY @215 GOTO evade
END

//---------------------------------------    Level 24 + Int 15

IF ~!LevelLT(Myself,24)
     LevelLT(Myself,27)
    !CheckStatLT(Myself,15,INT)~ 1
  SAY @200

  IF ~!LevelLT(Myself,5)~          // Weaveshear
     REPLY @217 GOTO shear

  IF ~!LevelLT(Myself,3)~          // Weave Spell
     REPLY @216 GOTO Weave

  IF ~Global("wm_feat_ambidextrous","LOCALS",0)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @201 GOTO ambidex

  IF ~Global("wm_feat_ambidextrous","LOCALS",1)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @202 GOTO ambidex

  IF ~CheckStat(Myself,1,BACKSTABDAMAGEMULTIPLIER)~     // Backstabbing (x2)
     REPLY @203 GOTO backstab

  IF ~CheckStat(Myself,2,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Adept (x3)
      !LevelLT(Myself,5)
      !CheckStatLT(Myself,14,DEX)~
     REPLY @204 GOTO backstab

  IF ~CheckStat(Myself,3,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Expert (x4)
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,15,DEX)~
     REPLY @205 GOTO backstab

  IF ~CheckStat(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Master (x5)
      !LevelLT(Myself,15)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @206 GOTO backstab

  IF ~Global("wm_feat_ambidextrous","LOCALS",2)      // Combat Speed
      !LevelLT(Myself,18)~
     REPLY @207 GOTO speed

  IF ~CheckStat(Myself,1,PROFICIENCYDAGGER)~      // Dagger Specialization
     REPLY @208 GOTO dagger

  IF ~Global("wm_feat_criticals","LOCALS",0)      // Improved Criticals
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,17,DEX)~
     REPLY @210 GOTO quick

  IF ~Global("wm_feat_toughness","LOCALS",0)       // Toughness
      !LevelLT(Myself,3)~
     REPLY @211 GOTO tough

  IF ~!GlobalGT("wm_feat_vicious","LOCALS",4)      // Vicious hits
      !LevelLT(Myself,3)~
     REPLY @212 GOTO damage

  IF ~!CheckStatLT(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Rogue HLA: Assassination
      !LevelLT(Myself,18)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @213 GOTO assassin

  IF ~Global("wm_feat_toughness","LOCALS",1)      // Rogue HLA: Avoid Death
      !LevelLT(Myself,18)~
     REPLY @214 GOTO avoid

  IF ~!CheckStatLT(Myself,16,DEX)        // Rogue HLA: Evasion
      !LevelLT(Myself,18)~
     REPLY @215 GOTO evade
END

//---------------------------------------    Level 27 + Int 16

IF ~!LevelLT(Myself,27)
     LevelLT(Myself,30)
    !CheckStatLT(Myself,16,INT)~ 2
  SAY @200

  IF ~!LevelLT(Myself,5)~          // Weaveshear
     REPLY @217 GOTO shear

  IF ~!LevelLT(Myself,3)~          // Weave Spell
     REPLY @216 GOTO Weave

  IF ~Global("wm_feat_ambidextrous","LOCALS",0)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @201 GOTO ambidex

  IF ~Global("wm_feat_ambidextrous","LOCALS",1)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @202 GOTO ambidex

  IF ~CheckStat(Myself,1,BACKSTABDAMAGEMULTIPLIER)~     // Backstabbing (x2)
     REPLY @203 GOTO backstab

  IF ~CheckStat(Myself,2,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Adept (x3)
      !LevelLT(Myself,5)
      !CheckStatLT(Myself,14,DEX)~
     REPLY @204 GOTO backstab

  IF ~CheckStat(Myself,3,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Expert (x4)
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,15,DEX)~
     REPLY @205 GOTO backstab

  IF ~CheckStat(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Master (x5)
      !LevelLT(Myself,15)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @206 GOTO backstab

  IF ~Global("wm_feat_ambidextrous","LOCALS",2)      // Combat Speed
      !LevelLT(Myself,18)~
     REPLY @207 GOTO speed

  IF ~CheckStat(Myself,1,PROFICIENCYDAGGER)~      // Dagger Specialization
     REPLY @208 GOTO dagger

  IF ~Global("wm_feat_criticals","LOCALS",0)      // Improved Criticals
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,17,DEX)~
     REPLY @210 GOTO quick

  IF ~Global("wm_feat_toughness","LOCALS",0)       // Toughness
      !LevelLT(Myself,3)~
     REPLY @211 GOTO tough

  IF ~!GlobalGT("wm_feat_vicious","LOCALS",4)      // Vicious hits
      !LevelLT(Myself,3)~
     REPLY @212 GOTO damage

  IF ~!CheckStatLT(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Rogue HLA: Assassination
      !LevelLT(Myself,18)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @213 GOTO assassin

  IF ~Global("wm_feat_toughness","LOCALS",1)      // Rogue HLA: Avoid Death
      !LevelLT(Myself,18)~
     REPLY @214 GOTO avoid

  IF ~!CheckStatLT(Myself,16,DEX)        // Rogue HLA: Evasion
      !LevelLT(Myself,18)~
     REPLY @215 GOTO evade
END

//---------------------------------------    Level 30/33 + Int 17

IF ~!LevelLT(Myself,30)
     LevelLT(Myself,36)
    !CheckStatLT(Myself,17,INT)~ 3
  SAY @200

  IF ~!LevelLT(Myself,5)~          // Weaveshear
     REPLY @217 GOTO shear

  IF ~!LevelLT(Myself,3)~          // Weave Spell
     REPLY @216 GOTO Weave

  IF ~Global("wm_feat_ambidextrous","LOCALS",0)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @201 GOTO ambidex

  IF ~Global("wm_feat_ambidextrous","LOCALS",1)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @202 GOTO ambidex

  IF ~CheckStat(Myself,1,BACKSTABDAMAGEMULTIPLIER)~     // Backstabbing (x2)
     REPLY @203 GOTO backstab

  IF ~CheckStat(Myself,2,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Adept (x3)
      !LevelLT(Myself,5)
      !CheckStatLT(Myself,14,DEX)~
     REPLY @204 GOTO backstab

  IF ~CheckStat(Myself,3,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Expert (x4)
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,15,DEX)~
     REPLY @205 GOTO backstab

  IF ~CheckStat(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Master (x5)
      !LevelLT(Myself,15)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @206 GOTO backstab

  IF ~Global("wm_feat_ambidextrous","LOCALS",2)      // Combat Speed
      !LevelLT(Myself,18)~
     REPLY @207 GOTO speed

  IF ~CheckStat(Myself,1,PROFICIENCYDAGGER)~      // Dagger Specialization
     REPLY @208 GOTO dagger

  IF ~Global("wm_feat_criticals","LOCALS",0)      // Improved Criticals
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,17,DEX)~
     REPLY @210 GOTO quick

  IF ~Global("wm_feat_toughness","LOCALS",0)       // Toughness
      !LevelLT(Myself,3)~
     REPLY @211 GOTO tough

  IF ~!GlobalGT("wm_feat_vicious","LOCALS",4)      // Vicious hits
      !LevelLT(Myself,3)~
     REPLY @212 GOTO damage

  IF ~!CheckStatLT(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Rogue HLA: Assassination
      !LevelLT(Myself,18)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @213 GOTO assassin

  IF ~Global("wm_feat_toughness","LOCALS",1)      // Rogue HLA: Avoid Death
      !LevelLT(Myself,18)~
     REPLY @214 GOTO avoid

  IF ~!CheckStatLT(Myself,16,DEX)        // Rogue HLA: Evasion
      !LevelLT(Myself,18)~
     REPLY @215 GOTO evade
END

//---------------------------------------    Level 36/39 + Int 18

IF ~!LevelLT(Myself,36)
     LevelLT(Myself,42)
    !CheckStatLT(Myself,18,INT)~ 4
  SAY @200

  IF ~!LevelLT(Myself,5)~          // Weaveshear
     REPLY @217 GOTO shear

  IF ~!LevelLT(Myself,3)~          // Weave Spell
     REPLY @216 GOTO Weave

  IF ~Global("wm_feat_ambidextrous","LOCALS",0)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @201 GOTO ambidex

  IF ~Global("wm_feat_ambidextrous","LOCALS",1)      // Ambidextrousity
      !CheckStatLT(Myself,16,DEX)~
     REPLY @202 GOTO ambidex

  IF ~CheckStat(Myself,1,BACKSTABDAMAGEMULTIPLIER)~     // Backstabbing (x2)
     REPLY @203 GOTO backstab

  IF ~CheckStat(Myself,2,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Adept (x3)
      !LevelLT(Myself,5)
      !CheckStatLT(Myself,14,DEX)~
     REPLY @204 GOTO backstab

  IF ~CheckStat(Myself,3,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Expert (x4)
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,15,DEX)~
     REPLY @205 GOTO backstab

  IF ~CheckStat(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Backstabbing Master (x5)
      !LevelLT(Myself,15)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @206 GOTO backstab

  IF ~Global("wm_feat_ambidextrous","LOCALS",2)      // Combat Speed
      !LevelLT(Myself,18)~
     REPLY @207 GOTO speed

  IF ~CheckStat(Myself,1,PROFICIENCYDAGGER)~      // Dagger Specialization
     REPLY @208 GOTO dagger

  IF ~Global("wm_feat_criticals","LOCALS",0)      // Improved Criticals
      !LevelLT(Myself,9)
      !CheckStatLT(Myself,17,DEX)~
     REPLY @210 GOTO quick

  IF ~Global("wm_feat_toughness","LOCALS",0)       // Toughness
      !LevelLT(Myself,3)~
     REPLY @211 GOTO tough

  IF ~!GlobalGT("wm_feat_vicious","LOCALS",4)      // Vicious hits
      !LevelLT(Myself,3)~
     REPLY @212 GOTO damage

  IF ~!CheckStatLT(Myself,4,BACKSTABDAMAGEMULTIPLIER)     // Rogue HLA: Assassination
      !LevelLT(Myself,18)
      !CheckStatLT(Myself,16,DEX)~
     REPLY @213 GOTO assassin

  IF ~Global("wm_feat_toughness","LOCALS",1)      // Rogue HLA: Avoid Death
      !LevelLT(Myself,18)~
     REPLY @214 GOTO avoid

  IF ~!CheckStatLT(Myself,16,DEX)        // Rogue HLA: Evasion
      !LevelLT(Myself,18)~
     REPLY @215 GOTO evade
END

//----------------------------------------------------------------------------------------

IF ~~ shear
  SAY ~~
  IF ~~ DO ~AddSpecialAbility("wm_shear")~ EXIT
END

IF ~~ Weave
  SAY ~~
  IF ~~ DO ~AddSpecialAbility("wm_weave")~ EXIT
END

IF ~~ dagger
  SAY ~~
  IF ~~ DO ~ApplySpellRES("wm_#dag2",Myself)~ EXIT
END

IF ~~ ambidex
  SAY ~~
  IF ~Global("wm_feat_ambidextrous","LOCALS",0)~
     DO ~ApplySpellRES("wm_#amb1",Myself)
              SetGlobal("wm_feat_ambidextrous","LOCALS",1)~ EXIT
  IF ~Global("wm_feat_ambidextrous","LOCALS",1)~
     DO ~ApplySpellRES("wm_#amb2",Myself)
              SetGlobal("wm_feat_ambidextrous","LOCALS",2)~ EXIT
END

IF ~~ speed
  SAY ~~
  IF ~~ DO ~ApplySpellRES("wm_#fast",Myself)
              SetGlobal("wm_feat_ambidextrous","LOCALS",3)~ EXIT
END

IF ~~ tough
  SAY ~~
  IF ~~ DO ~ApplySpellRES("wm_#toug",Myself)
                 SetGlobal("wm_feat_toughness","LOCALS",1)~ EXIT
END

IF ~~ damage
  SAY ~~
  IF ~~ DO ~ApplySpellRES("wm_#dam",Myself)
                  SetGlobal("wm_feat_vicious","LOCALS",1)~ EXIT
END

IF ~~ quick
  SAY ~~
  IF ~~ DO ~ApplySpellRES("wm_#crit",Myself)
                 SetGlobal("wm_feat_criticals","LOCALS",1)~ EXIT
END

IF ~~ backstab
  SAY ~~
  IF ~~ DO ~ApplySpellRES("wm_#stab",Myself)~ EXIT
END

IF ~~ assassin
  SAY ~~
  IF ~~ DO ~AddSpecialAbility("SPCL916")~ EXIT
END

IF ~~ avoid
  SAY ~~
  IF ~~ DO ~AddSpecialAbility("SPCL917")~ EXIT
END

IF ~~ evade
  SAY ~~
  IF ~~ DO ~AddSpecialAbility("SPCL913")~ EXIT
END


