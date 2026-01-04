/** @tra dialog.tra */

//---------------------------------------------------------------------------------------
//         ----------------------
//           Spellbook Dialogue
//         ----------------------
//---------------------------------------------------------------------------------------
//
// The Spellbook can be used to learn wild magic spells. The selection
// is dependent on the user's level. The spells show up in pairs,
// when the user has the first minimum level, he may learn one of them.
// To learn the second spell, the user needs to advance to the next level.
// The next pair of spells shows up when the user has learned both previous spells.
//
// MIN-LEVEL   SPELL
// 1st  2nd    LEVEL   SPELL SELECTION
//---------------------------------------------------------------------------------------
//  1    2       1     "Random Spell" + "Rhialto's Chaos Conduit" + "Rodent Form"
//  3    4       2     "Blade Shower" + "Rhialto's Random Missiles"
//  5    6       3     "Gymlainac's Lightbend" + "Vile Word of Discord"
//  7    8       4     "Cellular Regeneration" + "Glyph of Wild Magic"
//  9   10       5     "Paithan's Lucky Streak" + "Vortex"
// 11   12       6     "Paithan's Fiasco" + "Wildstrike"
// 13   14       7     "Hornung's Random Dispatcher" + "Summon Cow"
// 15   16       8     "Eye of the Beholder" + "Mynoc's Wild Recuperation"
// 17   18       9     "Entropy Shield" + "Wild Sphere"
// 19    10     "Rhialto's Marvelous Reincarnation" (Needs to be spellshaper)
// 20    12      (Can't learn this spell, just a reference to "Karsus's Avatar")
//----------------------------------------------------------------------------------------

BEGIN WM_SBOOK

IF ~Global("wm_book_open","LOCALS",0)~ 1
  SAY @00
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

IF ~Global("wm_book_open","LOCALS",5)~ 2
  SAY @01
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

IF ~Global("wm_book_open","LOCALS",10)~ 3
  SAY @02
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

IF ~OR(3)
      Global("wm_book_open","LOCALS",7)
      Global("wm_book_open","LOCALS",14)
      Global("wm_book_open","LOCALS",21)~ 4
  SAY @03
  IF ~RandomNum(21,01)~ DO ~GiveItemCreate("SCRL7k",Myself,1,0,0)~ REPLY @11 GOTO close // (6) Mislead
  IF ~RandomNum(21,02)~ DO ~GiveItemCreate("SCRL5p",Myself,1,0,0)~ REPLY @11 GOTO close // (5) Chaos
  IF ~RandomNum(21,03)~ DO ~GiveItemCreate("SCRL6q",Myself,1,0,0)~ REPLY @11 GOTO close // (5) Feeblemind
  IF ~RandomNum(21,04)~ DO ~GiveItemCreate("SCRL1u",Myself,1,0,0)~ REPLY @11 GOTO close // (4) Confusion
  IF ~RandomNum(21,05)~ DO ~GiveItemCreate("SCRL6q",Myself,1,0,0)~ REPLY @11 GOTO close // (4) Teleport Field
  IF ~RandomNum(21,06)~ DO ~GiveItemCreate("SCRL5i",Myself,1,0,0)~ REPLY @11 GOTO close // (4) Greater Malison
  IF ~RandomNum(21,07)~ DO ~GiveItemCreate("SCRL1s",Myself,1,0,0)~ REPLY @11 GOTO close // (3) Dire Charm
  IF ~RandomNum(21,08)~ DO ~GiveItemCreate("SCRLA5",Myself,1,0,0)~ REPLY @11 GOTO close // (3) Melf's Minute Metors
  IF ~RandomNum(21,09)~ DO ~GiveItemCreate("SCRLA7",Myself,1,0,0)~ REPLY @11 GOTO close // (3) Remove Magic
  IF ~RandomNum(21,10)~ DO ~GiveItemCreate("SCRL1d",Myself,1,0,0)~ REPLY @11 GOTO close // (3) Clairvoyance
  IF ~RandomNum(21,11)~ DO ~GiveItemCreate("SCRL95",Myself,1,0,0)~ REPLY @11 GOTO close // (2) Melf's Acid Arrow
  IF ~RandomNum(21,12)~ DO ~GiveItemCreate("SCRLA3",Myself,1,0,0)~ REPLY @11 GOTO close // (2) Glitterdust
  IF ~RandomNum(21,13)~ DO ~GiveItemCreate("SCRL6f",Myself,1,0,0)~ REPLY @11 GOTO close // (2) Ray of Enfeeblement
  IF ~RandomNum(21,14)~ DO ~GiveItemCreate("SCRL91",Myself,1,0,0)~ REPLY @11 GOTO close // (2) Knock
  IF ~RandomNum(21,15)~ DO ~GiveItemCreate("SCRL94",Myself,1,0,0)~ REPLY @11 GOTO close // (2) Resist Fear
  IF ~RandomNum(21,16)~ DO ~GiveItemCreate("SCRL66",Myself,1,0,0)~ REPLY @11 GOTO close // (1) Grease
  IF ~RandomNum(21,17)~ DO ~GiveItemCreate("SCRL75",Myself,1,0,0)~ REPLY @11 GOTO close // (1) Identify
  IF ~RandomNum(21,18)~ DO ~GiveItemCreate("SCRL71",Myself,1,0,0)~ REPLY @11 GOTO close // (1) Blindness
  IF ~RandomNum(21,19)~ DO ~GiveItemCreate("SCRL70",Myself,1,0,0)~ REPLY @11 GOTO close // (1) Color Spray
  IF ~RandomNum(21,20)~ DO ~GiveItemCreate("SCRL83",Myself,1,0,0)~ REPLY @11 GOTO close // (1) Chromatic Orb
  IF ~RandomNum(21,21)~ DO ~GiveItemCreate("SCRLa6",Myself,1,0,0)~ REPLY @11 GOTO close // (1) Spook
END

IF ~!GlobalLT("wm_book_spell","LOCALS",36)~ 4a
  SAY @09
  IF ~~ DO ~Actionoverride(Myself,DestroyItem("wm_sbook"))~
  EXIT
END

IF ~!GlobalLT("wm_book_spell","LOCALS",31)~ 4b
  SAY @08
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

IF ~RandomNum(4,1)~ 5
  SAY @04
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

IF ~RandomNum(4,2)~ 6
  SAY @05
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

IF ~RandomNum(4,3)~ 7
  SAY @06
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

IF ~RandomNum(4,4)~ 8
  SAY @07
  IF ~~ REPLY @10 GOTO study
  IF ~~ REPLY @11 GOTO close
END

//------------------------------------------------------------------

IF ~~ study
  SAY @13

  IF ~OR(3) Global("wm_book_spell","LOCALS",35)
            !GlobalGT("wm_book_spell","LOCALS",30)
            GlobalLT("wm_book_spell_A","LOCALS",9)~
        DO ~IncrementGlobal("wm_book_open","LOCALS",1)~ GOTO study1

  IF ~Global("wm_book_spell","LOCALS",31)
      !GlobalLT("wm_level","LOCALS",19)~
        DO ~IncrementGlobal("wm_book_open","LOCALS",1)~ GOTO study1

  IF ~Global("wm_book_spell","LOCALS",31)
      !GlobalLT("wm_book_spell_A","LOCALS",9)
      GlobalLT("wm_level","LOCALS",19)~
        DO ~IncrementGlobal("wm_book_open","LOCALS",1)~ GOTO study2

  IF ~!GlobalLT("wm_book_spell","LOCALS",32)
      !GlobalGT("wm_book_spell","LOCALS",34)~
        DO ~IncrementGlobal("wm_book_open","LOCALS",1)~ GOTO study3
END

IF ~~ close
  SAY @19
  IF ~~ DO ~IncrementGlobal("wm_book_open","LOCALS",1)~ EXIT
END

//------------------------------------------------------------------

IF ~~ study1
  SAY @14

  IF ~OR(2) Global("wm_book_spell","LOCALS",0) Global("wm_book_spell","LOCALS",1)~ REPLY @20 GOTO 00   // -> +6 = 6/7
  IF ~OR(2) Global("wm_book_spell","LOCALS",0) Global("wm_book_spell","LOCALS",6)~ REPLY @22 GOTO 02   // -> +1 = 1/7

  IF ~OR(2) Global("wm_book_spell","LOCALS",7) Global("wm_book_spell","LOCALS",8)~ REPLY @23 GOTO 03   // -> +2 = 9/10
  IF ~OR(2) Global("wm_book_spell","LOCALS",7) Global("wm_book_spell","LOCALS",9)~ REPLY @24 GOTO 04   // -> +1 = 8/10

  IF ~OR(2) Global("wm_book_spell","LOCALS",10) Global("wm_book_spell","LOCALS",11)~ REPLY @25 GOTO 05 // -> +2 = 12/13
  IF ~OR(2) Global("wm_book_spell","LOCALS",10) Global("wm_book_spell","LOCALS",12)~ REPLY @26 GOTO 06 // -> +1 = 11/13

  IF ~OR(2) Global("wm_book_spell","LOCALS",13) Global("wm_book_spell","LOCALS",14)~ REPLY @27 GOTO 07 // -> +2 = 15/16
  IF ~OR(2) Global("wm_book_spell","LOCALS",13) Global("wm_book_spell","LOCALS",15)~ REPLY @28 GOTO 08 // -> +1 = 14/16

  IF ~OR(2) Global("wm_book_spell","LOCALS",16) Global("wm_book_spell","LOCALS",17)~ REPLY @29 GOTO 09 // -> +2 = 18/19
  IF ~OR(2) Global("wm_book_spell","LOCALS",16) Global("wm_book_spell","LOCALS",18)~ REPLY @30 GOTO 10 // -> +1 = 17/19

  IF ~OR(2) Global("wm_book_spell","LOCALS",19) Global("wm_book_spell","LOCALS",20)~ REPLY @31 GOTO 11 // -> +2 = 21/22
  IF ~OR(2) Global("wm_book_spell","LOCALS",19) Global("wm_book_spell","LOCALS",21)~ REPLY @32 GOTO 12 // -> +1 = 20/22

  IF ~OR(2) Global("wm_book_spell","LOCALS",22) Global("wm_book_spell","LOCALS",23)~ REPLY @33 GOTO 13 // -> +2 = 24/25
  IF ~OR(2) Global("wm_book_spell","LOCALS",22) Global("wm_book_spell","LOCALS",24)~ REPLY @34 GOTO 14 // -> +1 = 23/25

  IF ~OR(2) Global("wm_book_spell","LOCALS",25) Global("wm_book_spell","LOCALS",26)~ REPLY @35 GOTO 15 // -> +2 = 27/28
  IF ~OR(2) Global("wm_book_spell","LOCALS",25) Global("wm_book_spell","LOCALS",27)~ REPLY @36 GOTO 16 // -> +1 = 26/28

  IF ~OR(2) Global("wm_book_spell","LOCALS",28) Global("wm_book_spell","LOCALS",29)~ REPLY @37 GOTO 17 // -> +2 = 30/31
  IF ~OR(2) Global("wm_book_spell","LOCALS",28) Global("wm_book_spell","LOCALS",30)~ REPLY @38 GOTO 18 // -> +1 = 29/31

  IF ~Global("wm_book_spell","LOCALS",31) !GlobalLT("wm_level","LOCALS",19)~ REPLY @39 GOTO 19 // -> +1 = 32

  IF ~Global("wm_book_spell","LOCALS",35)~ REPLY @40 GOTO 20 // -> +1 = 36

  IF ~Global("wm_book_spell_A","LOCALS",0) GlobalGT("wm_book_spell","LOCALS", 0)~ REPLY @41 GOTO 21
  IF ~Global("wm_book_spell_A","LOCALS",1) GlobalGT("wm_book_spell","LOCALS", 7)~ REPLY @42 GOTO 22
  IF ~Global("wm_book_spell_A","LOCALS",2) GlobalGT("wm_book_spell","LOCALS",10)~ REPLY @43 GOTO 23
  IF ~Global("wm_book_spell_A","LOCALS",3) GlobalGT("wm_book_spell","LOCALS",13)~ REPLY @44 GOTO 24
  IF ~Global("wm_book_spell_A","LOCALS",4) GlobalGT("wm_book_spell","LOCALS",16)~ REPLY @45 GOTO 25
  IF ~Global("wm_book_spell_A","LOCALS",5) GlobalGT("wm_book_spell","LOCALS",19)~ REPLY @46 GOTO 26
  IF ~Global("wm_book_spell_A","LOCALS",6) GlobalGT("wm_book_spell","LOCALS",22)~ REPLY @47 GOTO 27
  IF ~Global("wm_book_spell_A","LOCALS",7) GlobalGT("wm_book_spell","LOCALS",25)~ REPLY @48 GOTO 28
  IF ~Global("wm_book_spell_A","LOCALS",8) GlobalGT("wm_book_spell","LOCALS",28)~ REPLY @49 GOTO 29

  IF ~~ REPLY @11 GOTO close2
END

IF ~~ study2        // Can't find "Rhialto's Marvelous Reincarnation"
  SAY @15        // unless Chaos Conduit was cast...
  IF ~~ REPLY @11 GOTO close2
END

IF ~~ study3        // Need to search three times for "Rhialto's Avatar"
  SAY @15
  IF ~~ DO ~IncrementGlobal("wm_book_spell","LOCALS",1)~ REPLY @11 GOTO close2
END

//------------------------------------------------------------------

IF ~~ close2
  SAY @19
  IF ~~ EXIT
END

//------------------------------------------------------------------

IF ~~ fail
  SAY @16
  IF ~~ EXIT
END

IF ~~ success
  SAY @17
  IF ~~ EXIT
END

IF ~~ useless                // Spellshaper cant learn Chaos Conduit...
  SAY @12
  IF ~~ EXIT
END
//------------------------------------------------------------------

//----------------------
// SpellLevel 1: 1+2

IF ~~ 00
  SAY ~~
  IF ~Level(Myself,1) GlobalGT("wm_book_spell","LOCALS",0)~    // 1st and 2nd spell at Level 1+
     GOTO fail
  IF ~OR(2) LevelGT(Myself,1) Global("wm_book_spell","LOCALS",0)  // 3rd spell at Level 2+
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_rnd"))
                IncrementGlobal("wm_book_spell","LOCALS",6)~
            GOTO success
END

IF ~~ 02
  SAY ~~
  IF ~Level(Myself,1) GlobalGT("wm_book_spell","LOCALS",0)~    // 1st and 2nd spell at Level 1+
     GOTO fail
  IF ~OR(2) LevelGT(Myself,1) Global("wm_book_spell","LOCALS",0)   // 3rd spell at Level 2+
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_sqrl"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Spell Level 2: 3+4

IF ~~ 03
  SAY ~~
  IF ~ LevelLT(Myself,3)~             // first spell at Level 3+
     GOTO fail
  IF ~!LevelGT(Myself,3) GlobalGT("wm_book_spell","LOCALS",7)~     // second spell at Level 4+
     GOTO fail
  IF ~!LevelLT(Myself,3)
      OR(2) LevelGT(Myself,3) Global("wm_book_spell","LOCALS",7)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_blade"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 04
  SAY ~~
  IF ~ LevelLT(Myself,3)~             // first spell at Level 3+
     GOTO fail
  IF ~!LevelGT(Myself,3) GlobalGT("wm_book_spell","LOCALS",7)~     // second spell at Level 4+
     GOTO fail
  IF ~!LevelLT(Myself,3)
      OR(2) LevelGT(Myself,3) Global("wm_book_spell","LOCALS",7)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_miss"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Spell Level 3: 5+6

IF ~~ 05
  SAY ~~
  IF ~ LevelLT(Myself,5)~             // first spell at Level 5+
     GOTO fail
  IF ~!LevelGT(Myself,5) GlobalGT("wm_book_spell","LOCALS",10)~   // second spell at Level 6+
     GOTO fail
  IF ~!LevelLT(Myself,5)
      OR(2) LevelGT(Myself,5) Global("wm_book_spell","LOCALS",10)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_light"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 06
  SAY ~~
  IF ~ LevelLT(Myself,5)~             // first spell at Level 5+
     GOTO fail
  IF ~!LevelGT(Myself,5) GlobalGT("wm_book_spell","LOCALS",10)~   // second spell at Level 6+
     GOTO fail
  IF ~!LevelLT(Myself,5)
      OR(2) LevelGT(Myself,5) Global("wm_book_spell","LOCALS",10)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_word"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Spell Level 4: 7+8

IF ~~ 07
  SAY ~~
  IF ~ LevelLT(Myself,7)~             // first spell at Level 7+
     GOTO fail
  IF ~!LevelGT(Myself,7) GlobalGT("wm_book_spell","LOCALS",13)~   // second spell at Level 8+
     GOTO fail
  IF ~!LevelLT(Myself,7)
      OR(2) LevelGT(Myself,7) Global("wm_book_spell","LOCALS",13)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_heal"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 08
  SAY ~~
  IF ~ LevelLT(Myself,7)~             // first spell at Level 7+
     GOTO fail
  IF ~!LevelGT(Myself,7) GlobalGT("wm_book_spell","LOCALS",13)~   // second spell at Level 8+
     GOTO fail
  IF ~!LevelLT(Myself,7)
      OR(2) LevelGT(Myself,7) Global("wm_book_spell","LOCALS",13)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_glyph"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Spell Level 5: 9+10

IF ~~ 09
  SAY ~~
  IF ~ LevelLT(Myself,9)~             // first spell at Level 9+
     GOTO fail
  IF ~!LevelGT(Myself,9) GlobalGT("wm_book_spell","LOCALS",16)~   // second spell at Level 10+
     GOTO fail
  IF ~!LevelLT(Myself,9)
      OR(2) LevelGT(Myself,9) Global("wm_book_spell","LOCALS",16)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_luck"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 10
  SAY ~~
  IF ~ LevelLT(Myself,9)~             // first spell at Level 9+
     GOTO fail
  IF ~!LevelGT(Myself,9) GlobalGT("wm_book_spell","LOCALS",16)~   // second spell at Level 10+
     GOTO fail
  IF ~!LevelLT(Myself,9)
      OR(2) LevelGT(Myself,9) Global("wm_book_spell","LOCALS",16)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_vortx"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Spell Level 6: 11+12

IF ~~ 11
  SAY ~~
  IF ~ LevelLT(Myself,11)~             // first spell at Level 11+
     GOTO fail
  IF ~!LevelGT(Myself,11) GlobalGT("wm_book_spell","LOCALS",19)~   // second spell at Level 12+
     GOTO fail
  IF ~!LevelLT(Myself,11)
      OR(2) LevelGT(Myself,11) Global("wm_book_spell","LOCALS",19)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_unlk"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 12
  SAY ~~
  IF ~ LevelLT(Myself,11)~             // first spell at Level 11+
     GOTO fail
  IF ~!LevelGT(Myself,11) GlobalGT("wm_book_spell","LOCALS",19)~   // second spell at Level 12+
     GOTO fail
  IF ~!LevelLT(Myself,11)
      OR(2) LevelGT(Myself,11) Global("wm_book_spell","LOCALS",19)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_strik"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Spell Level 7: 13+14

IF ~~ 13
  SAY ~~
  IF ~ LevelLT(Myself,13)~             // first spell at Level 13+
     GOTO fail
  IF ~!LevelGT(Myself,13) GlobalGT("wm_book_spell","LOCALS",22)~   // second spell at Level 14+
     GOTO fail
  IF ~!LevelLT(Myself,13)
      OR(2) LevelGT(Myself,13) Global("wm_book_spell","LOCALS",22)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_disp"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 14
  SAY ~~
  IF ~ LevelLT(Myself,13)~             // first spell at Level 13+
     GOTO fail
  IF ~!LevelGT(Myself,13) GlobalGT("wm_book_spell","LOCALS",22)~   // second spell at Level 14+
     GOTO fail
  IF ~!LevelLT(Myself,13)
      OR(2) LevelGT(Myself,13) Global("wm_book_spell","LOCALS",22)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_cow"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END


//----------------------
// Spell Level 8: 15+16

IF ~~ 15
  SAY ~~
  IF ~ LevelLT(Myself,15)~             // first spell at Level 15+
     GOTO fail
  IF ~!LevelGT(Myself,15) GlobalGT("wm_book_spell","LOCALS",25)~   // second spell at Level 16+
     GOTO fail
  IF ~!LevelLT(Myself,15)
      OR(2) LevelGT(Myself,15) Global("wm_book_spell","LOCALS",25)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_eye"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 16
  SAY ~~
  IF ~ LevelLT(Myself,15)~             // first spell at Level 15+
     GOTO fail
  IF ~!LevelGT(Myself,15) GlobalGT("wm_book_spell","LOCALS",25)~   // second spell at Level 16+
     GOTO fail
  IF ~!LevelLT(Myself,15)
      OR(2) LevelGT(Myself,15) Global("wm_book_spell","LOCALS",25)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_recup"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END
//----------------------
// Spell Level 9: 17+18

IF ~~ 17
  SAY ~~
  IF ~ LevelLT(Myself,17)~             // first spell at Level 17+
     GOTO fail
  IF ~!LevelGT(Myself,17) GlobalGT("wm_book_spell","LOCALS",28)~   // second spell at Level 18+
     GOTO fail
  IF ~!LevelLT(Myself,17)
      OR(2) LevelGT(Myself,17) Global("wm_book_spell","LOCALS",28)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_shld"))
                IncrementGlobal("wm_book_spell","LOCALS",2)~
            GOTO success
END

IF ~~ 18
  SAY ~~
  IF ~ LevelLT(Myself,17)~             // first spell at Level 17+
     GOTO fail
  IF ~!LevelGT(Myself,17) GlobalGT("wm_book_spell","LOCALS",28)~   // second spell at Level 18+
     GOTO fail
  IF ~!LevelLT(Myself,17)
      OR(2) LevelGT(Myself,17) Global("wm_book_spell","LOCALS",28)
     ~ DO ~Actionoverride(Myself,AddSpecialAbility("wm_sphr"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Spell Level 10: 19

IF ~~ 19
  SAY ~~
  IF ~ LevelLT(Myself,19)~             // 10th Level spell at Level 19+
     GOTO fail
  IF ~!LevelLT(Myself,19)~
     DO ~Actionoverride(Myself,AddSpecialAbility("wm_reinc"))
                IncrementGlobal("wm_book_spell","LOCALS",1)~
            GOTO success
END

//----------------------
// Fun : 20

IF ~~ 20
  SAY ~~
  IF ~ LevelLT(Myself,20)~             // Fun at Level 20+
     GOTO fail
  IF ~!LevelLT(Myself,20)~
     GOTO fun
END

IF ~~ fun
  SAY @18
  IF ~~ DO ~IncrementGlobal("wm_book_spell","LOCALS",1)~
  EXIT
END



//-----------------------------
// v1.4 Additional Spells: Level 1-9

IF ~~ 21
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_attr"))   // Mynok's Irresistible Appeal
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 22
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_horde"))   // Summon Wild Horde
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 23
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_rnd2"))   // Random Spell II
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 24
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_liq"))   // Corporeal Instability
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 25
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_rnd3"))   // Random Spell III
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 26
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_armor"))   // Meece's Wild Armour
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 27
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_rnd4"))   // Random Spell IV
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 28
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_chaob"))   // Entropy Burst
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END

IF ~~ 29
  SAY ~~
  IF ~~ DO ~
  Actionoverride(Myself,AddSpecialAbility("wm_wfire"))   // Wildfire
  IncrementGlobal("wm_book_spell_A","LOCALS",1)~
        GOTO success
END


