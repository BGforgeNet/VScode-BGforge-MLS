///////////////////////////////////////////////////////////////////////
// Ascension : BALTH
///////////////////////////////////////////////////////////////////////
// (1) Assigns weight #0 to state 12
// (2) Fixes a typo (?) in the text in state 19
// (3) makes the response triggers much more complicated in state 24
// (4) adds a bunch of dialogue starting with state 31 -- original
//      balth.dlg has 30 states
///////////////////////////////////////////////////////////////////////

SET_WEIGHT BALTH 12 #-1 // ensures that it will be first

REPLACE_SAY BALTH 19 @1060

/// round one of the verbal battle
///

/// Entry block

REPLACE BALTH 
  IF ~~ THEN BEGIN 24 // from: 23.0
    SAY #67727 
    IF ~Alignment(Player1,MASK_GOOD)
  ReputationGT(Player1,18)~ THEN REPLY #67730 GOTO a31
    IF ~!Alignment(Player1,MASK_GOOD)
  ReputationGT(Player1,18)~ THEN REPLY #67730 GOTO a32
    IF ~Alignment(Player1,MASK_GOOD)
  !ReputationGT(Player1,18)~ THEN REPLY #67730 GOTO a33
    IF ~!Alignment(Player1,MASK_GOOD)
  !ReputationGT(Player1,18)
  ReputationGT(Player1,6)~ THEN REPLY #67730 GOTO a34
    IF ~~ THEN REPLY #67731 GOTO a35
    IF ~~ THEN REPLY @1072 /* ~You won't be the first to try and kill me...and probably not the last!~ #74114 */ GOTO a36
    IF ~~ THEN REPLY #67733 GOTO a37
    IF ~Alignment(Player1,MASK_EVIL)
  !ReputationGT(Player1,6)~ THEN REPLY #67730 GOTO a38
  END

END /* end of states that are REPLACEd */

APPEND BALTH 

////////////////////////
/// Response blocks
///
/// All exit to the round 2
/// start blocks
////////////////////////

IF ~~ THEN BEGIN a31 // from: 24.0
  SAY @1074 /* ~It is true.  You are a good <PRO_MANWOMAN>, <CHARNAME>, and your stance against evil is without question.  Your fight against the taint of our evil father is worthy of praise.~ #74107 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",2)~ GOTO a39
END

IF ~~ THEN BEGIN a32 // from: 24.1
  SAY @1075 /* ~I sense no innate goodness within you, <CHARNAME>...though your deeds are hailed far and wide as above reproach.  It is...interesting that one like you who must struggle so much with our father's taint inside <PRO_HIMHER> has done so much to fight true evil.~ #74108 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a39
END

IF ~~ THEN BEGIN a33 // from: 24.2
  SAY @1076 /* ~I see the good that is within you, <CHARNAME>, but your deeds are hardly above reproach.  I sense only a soul that struggles with our father's taint, that struggles to find the good path where none exists.~ #74109 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",0)~ GOTO a40
END

IF ~~ THEN BEGIN a34 // from: 24.3
  SAY @1077 /* ~I sense no innate goodness within you, <CHARNAME>.  I do not think your deeds above reproach.  I sense only a soul struggling against the taint of <PRO_HISHER> father, much like mine own.~ #74111 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a40
END

IF ~~ THEN BEGIN a35 // from: 24.4
  SAY @1078 /* ~Actually, I am the perfect person to judge, <CHARNAME>.  I, too, contain the taint of our father within me.  I, too, have felt its yearnings for blood, its efforts to exert chaos upon my life.  I have mastered it...but only barely.  Too well I know what it is capable of.~ #74113 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a39
END

IF ~~ THEN BEGIN a36 // from: 24.5
  SAY @1079 /* ~Naturally.  Our taint brings us no peace, does it, <CHARNAME>?  We fight in self-defense and yet still we kill, still we bring destruction.  We may claim an absence of responsibility, should we desire, but I know all too well what the taint in our soul is capable of.  Only barely do I keep it mastered.~ #74115 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-2)~ GOTO a40
END

IF ~~ THEN BEGIN a37 // from: 24.6
  SAY @1080 /* ~I would expect no other response from a true <PRO_BROTHERSISTER> of mine.  I know too well the thirst for death that comes with the taint of our sire.  I have mastered it, but only barely...I pity those who are a slave to it.~ #74117 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-2)~ GOTO a40
END

IF ~~ THEN BEGIN a38 // from: 24.7
  SAY @1081 /* ~Do not make me laugh, <CHARNAME>.  If you expect me to believe that your depraved existence exists to fight against evil in this world, then you expect far too much.~ #74119 */
  IF ~~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-3)~ GOTO a41
END

IF ~~ THEN BEGIN a41 // from: 38.0
  SAY @1089 /* ~I am nothing like you.  I exist to fight against the chaos of my taint, to fight against the evil that Bhaal's legacy brings to this world.  I have faced the evil within me and I have mastered it.~ #74122 */
  IF ~~ THEN GOTO a39
END

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////
///// verbal battle round 2
/////
///// You get a flat +1 if non-evil, 0 if evil
/////
///// DW: originally it was -1 if evil; this respects the
///// hint in the readme that there *is* a way through.
///// Depending on your reply, you get an additional
///// +1 to -2.
/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
///// Round 2 intro blocks
/////
///// both states are functionally identical; they differ only in the entry line
/////////////////////////////////////////////////////////////////

IF ~~ THEN BEGIN a39 // from: 41.0 35.0 32.0 31.0
  SAY @1082 /* ~But regardless of our wishes on the matter, our destiny has been written for us, <CHARNAME>.  Some may run from it or deny it, while others embrace it...but each and every Bhaalspawn has a seed within them that has sprung forth a fruit laden with blood and murder.  Do you deny this?~ #80546 */
  IF ~~ THEN REPLY @1083 /* ~Are you implying that you are somehow different, Balthazar?~ #74123 */ GOTO a42
  IF ~~ THEN REPLY @1084 /* ~I have only ever acted when it was necessary, in self-defense.~ #74211 */ GOTO a95
  IF ~~ THEN REPLY @1085 /* ~You would make us out to be victims of circumstance rather than masters of our own destiny.~ #74214 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a97
  IF ~~ THEN REPLY @1086 /* ~I deny nothing.  Death comes for all who stand in my way.~ #74217 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a99
  IF ~~ THEN REPLY @1087 /* ~I am death incarnate, fool!  Not some weak fool wrapped in denial like yourself!~ #74219 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-2)~ GOTO a100
END

IF ~~ THEN BEGIN a40 // from: 37.0 36.0 34.0 33.0
  SAY @1088 /* ~I have little doubt that you know whereof I speak.  The taint is strong within you...stronger than any single other spawn of our sire that I have seen.  You have felt the dreams, the urges, have you not?  The chaos that is your destiny has ripped wantonly through your life, regardless of your wishes, has it not?  Do you deny that you bring violence and destruction wherever you go, <CHARNAME>?~ #74121 */
  IF ~~ THEN REPLY @1083 /* ~Are you implying that you are somehow different, Balthazar?~ #74221 */ GOTO a42
  IF ~~ THEN REPLY @1084 /* ~I have only ever acted when it was necessary, in self-defense.~ #74222 */ GOTO a95
  IF ~~ THEN REPLY @1085 /* ~You would make us out to be victims of circumstance rather than masters of our own destiny.~ #74223 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a97
  IF ~~ THEN REPLY @1086 /* ~I deny nothing.  Death comes for all who stand in my way.~ #74224 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a99
  IF ~~ THEN REPLY @1087 /* ~I am death incarnate, fool!  Not some weak fool wrapped in denial like yourself!~ #74225 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-2)~ GOTO a100
END

/////////////////////////////////////////////////////////
///// Round 2 response blocks
/////////////////////////////////////////////////////////

IF ~~ THEN BEGIN a42 // from: 40.0 39.0
  SAY @1090 /* ~No.  I have brought my share of death and destruction to this land.  But I see a larger purpose behind it...I seek to end the possibility of Bhaal's return forever, and to wipe his taint from the land.~ #74124 */
    = @1091 /* ~I have mastered the power within me and held the evil in check, but I know as well...if not better...then most of my brethren the threat that it holds for all of Faerun.  I will not allow this.  I have dedicated my life to preventing it.~ #74125 */
  IF ~!Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a44
  IF ~Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a94
END

IF ~~ THEN BEGIN a95 // from: 40.1 39.1
  SAY @1177 /* ~Would that your claim of innocence meant anything to the dead of Saradush.  Were I to question the recent dead of Athkatla, of Baldur's Gate, of Candlekeep...would I not find some who would claim such innocence for themselves?  Who died merely because they were caught in your wake?~ #80552 */
    = @1178 /* ~Do you think that others of our kind are any different?  Count them, <CHARNAME>, and think of the multitudes of Bhaalspawn that existed and brought misery to others, if not by intent, then even by their very presence.  Would you allow such carnage to continue?  Have we not spared the entire land from agony by the slaying of our siblings?~ #80553 */
  IF ~!Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a44
  IF ~Alignment(Player1,MASK_EVIL)~ THEN GOTO a94
END

IF ~~ THEN BEGIN a97 // from: 40.2 39.2
  SAY @1179 /* ~You believe yourself to be the master of your destiny, do you?  The destiny foreseen long ago by Alaundo?  You believe it by choice alone that you ended up here, in this place?~ #74215 */
    = @1180 /* ~You mistake the path for the journey, my friend.  Whatever paths you have taken since leaving Candlekeep, the journey has ended here as it was always meant to.  Destiny masters us...we do not master it.~ #74216 */
  IF ~!Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a44
  IF ~Alignment(Player1,MASK_EVIL)~ THEN GOTO a94
END

IF ~~ THEN BEGIN a99 // from: 40.3 39.3
  SAY @1181 /* ~Yes, whether they were obstacles to be overcome or merely by-standers crossing your path.  My own life has been little different, no matter how I have struggled against it.  I am glad you see this...it will make things much easier.~ #74218 */
  IF ~!Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a44
  IF ~Alignment(Player1,MASK_EVIL)~ THEN GOTO a94
END

IF ~~ THEN BEGIN a100 // from: 40.4 39.4
  SAY @1182 /* ~You sound like Yaga-Shura, a giant in ego as well as body.  Yet he fell, too, when his fate came due.  The power of your blood may yet make you victorious, it is true, but the fact that you embrace the taint within you makes my own path that much the clearer.~ #74220 */
  IF ~!Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a44
  IF ~Alignment(Player1,MASK_EVIL)~ THEN GOTO a94
END

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////
///// verbal battle round 3
/////
///// There are three looping branches of dialog,
///// but the player only gets to explore two of them. In
///// each, if the player's Convince score is too low (-2)
///// then Balthazar will fight rather than going back round
/////
///// The player can also quit ('enough talk') and
///// go to combat.
/////
///// If, after both loops, Convince is -2 or higher, the player
///// goes on to round 4
/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
///// intro blocks
///// (which one you get depends on alignment)
/////////////////////////////////////////////////////////

IF ~~ THEN BEGIN a44 // from: 100.0 99.0 98.0 96.0 43.0
  SAY @1092 /* ~If only we had met under other circumstances, <CHARNAME>...I would have liked to sit and compare the paths that have brought us to this point.  If we had not been forced by destiny to bear this taint upon our souls, what would have become of us?  I regret what I must do, yet I know it must be done.~ #80547 */
  IF ~Global("WhatBecomesMelissan","LOCALS",0)~ THEN REPLY @1093 /* ~And what becomes of Melissan, then?  Is she free to raise Bhaal and complete her plans?~ #74244 */ DO ~SetGlobal("WhatBecomesMelissan","LOCALS",1)~ GOTO a45
  IF ~Global("DontHaveToDoThis","LOCALS",0)~ THEN REPLY @1094 /* ~You don't have to do this, Balthazar.  We don't have to fight each other.~ #74166 */ DO ~SetGlobal("DontHaveToDoThis","LOCALS",1)~ GOTO a71
  IF ~Global("Righteousness","LOCALS",0)~ THEN REPLY @1095 /* ~You don't honestly see yourself as the force of righteousness in all this, do you?~ #74189 */ DO ~SetGlobal("Righteousness","LOCALS",1)~ GOTO a84
  IF ~~ THEN REPLY @1096 /* ~Enough talk, then.  Let's get this over with.~ #74204 */ GOTO a93
END

IF ~~ THEN BEGIN a94 // from: 100.1 99.1 98.1 96.1 43.1
  SAY @1176 /* ~Even had destiny not brought us to this point, I doubt things would have been different.  Perhaps if you had not borne the taint of our sire, things might have been different with you.  I would have liked to meet a <PRO_MANWOMAN> such as yourself without the taint on your soul, I think.  But now I have little choice.~ #74206 */
  IF ~Global("WhatBecomesMelissan","LOCALS",0)~ THEN REPLY @1093 /* ~And what becomes of Melissan, then?  Is she free to raise Bhaal and complete her plans?~ #74247 */ DO ~SetGlobal("WhatBecomesMelissan","LOCALS",1)~ GOTO a45
  IF ~Global("DontHaveToDoThis","LOCALS",0)~ THEN REPLY @1094 /* ~You don't have to do this, Balthazar.  We don't have to fight each other.~ #74208 */ DO ~SetGlobal("DontHaveToDoThis","LOCALS",1)~ GOTO a71
  IF ~Global("Righteousness","LOCALS",0)~ THEN REPLY @1095 /* ~You don't honestly see yourself as the force of righteousness in all this, do you?~ #74209 */ DO ~SetGlobal("Righteousness","LOCALS",1)~ GOTO a84
  IF ~~ THEN REPLY @1096 /* ~Enough talk, then.  Let's get this over with.~ #74210 */ GOTO a93
END

////////////////////////
/// Second pass through 
/// the conversation
////////////////////////

IF ~~ THEN BEGIN a48 // from: 92.0 91.0 89.0 88.0 87.0 85.0 83.0 82.0 81.0 80.0 78.0 77.0 76.0 74.0 73.0 70.0 69.0 68.0 67.0 65.0 64.0 63.0 61.0 47.0
  SAY #36427 /* ~...I...~ */
  IF ~Global("WhatBecomesMelissan","LOCALS",1)
Global("DontHaveToDoThis","LOCALS",0)
Global("Righteousness","LOCALS",0)~ THEN GOTO a49
  IF ~Global("WhatBecomesMelissan","LOCALS",0)
Global("DontHaveToDoThis","LOCALS",1)
Global("Righteousness","LOCALS",0)~ THEN GOTO a49
  IF ~Global("WhatBecomesMelissan","LOCALS",0)
Global("DontHaveToDoThis","LOCALS",0)
Global("Righteousness","LOCALS",1)~ THEN GOTO a49
  IF ~Global("WhatBecomesMelissan","LOCALS",1)
Global("DontHaveToDoThis","LOCALS",1)
Global("Righteousness","LOCALS",0)~ THEN GOTO a50
  IF ~Global("WhatBecomesMelissan","LOCALS",1)
Global("DontHaveToDoThis","LOCALS",0)
Global("Righteousness","LOCALS",1)~ THEN GOTO a50
  IF ~Global("WhatBecomesMelissan","LOCALS",0)
Global("DontHaveToDoThis","LOCALS",1)
Global("Righteousness","LOCALS",1)~ THEN GOTO a50
END

IF ~~ THEN BEGIN a49 // from: 48.2 48.1 48.0
  SAY @1106 /* ~I had thought when this moment arrived, I would hold clearly to my purpose.  We must...end this, <CHARNAME>.  I wish this to be over with, one way or the other.~ #74133 */
  IF ~Global("WhatBecomesMelissan","LOCALS",0)~ THEN REPLY @1093 /* ~And what becomes of Melissan, then?  Is she free to raise Bhaal and complete her plans?~ #74245 */ DO ~SetGlobal("WhatBecomesMelissan","LOCALS",1)~ GOTO a45
  IF ~Global("DontHaveToDoThis","LOCALS",0)~ THEN REPLY @1094 /* ~You don't have to do this, Balthazar.  We don't have to fight each other.~ #74135 */ DO ~SetGlobal("DontHaveToDoThis","LOCALS",1)~ GOTO a71
  IF ~Global("Righteousness","LOCALS",0)~ THEN REPLY @1095 /* ~You don't honestly see yourself as the force of righteousness in all this, do you?~ #74136 */ DO ~SetGlobal("Righteousness","LOCALS",1)~ GOTO a84
  IF ~~ THEN REPLY @1107 /* ~Alright, Balthazar.  If that's what you want...let's end this now.~ #74137 */ GOTO a93
END

///////////////////////////////////////
/// Exit states from phase 3
////////////////////////////////////////

// failure exit state

IF ~~ THEN BEGIN a60 // from: 92.1 91.1 89.1 88.1 87.1 85.1 83.1 82.1 81.1 80.1 78.1 77.1 76.1 74.1 73.1 70.1 69.1 68.1 67.1 65.1 64.1 63.1 61.1 47.1
  SAY @1125 /* ~No.  Further dialogue is pointless.  Let us end this now, <CHARNAME>...and may the gods have pity on us all.~ #74235 */
  IF ~~ THEN DO ~Shout(ALERT)
Enemy()
EraseJournalEntry(67720)
EraseJournalEntry(67721)
EraseJournalEntry(67722)
EraseJournalEntry(67723)
EraseJournalEntry(66357)~ EXIT
END

// 'further talk is pointless' player-quit exit state

IF ~~ THEN BEGIN a93 // from: 94.3 84.4 71.5 49.3 45.5 44.3
  SAY @1175 /* ~Very well.  Come, my students...my teachings are ended.  We make our last stand now for what is right.  May the gods have pity on us all.~ #74205 */
  IF ~~ THEN DO ~Shout(ALERT)
Enemy()
EraseJournalEntry(67720)
EraseJournalEntry(67721)
EraseJournalEntry(67722)
EraseJournalEntry(67723)
EraseJournalEntry(66357)~ EXIT
END


///////////////////////////////////
//// Loop A: 'what becomes of Melissan?'
///////////////////////////////////

IF ~~ THEN BEGIN a45 // from: 94.0 49.0 44.0
  SAY @1097 /* ~Of course not.  It is she that holds the key to Bhaal's resurrection.  After you are dead, she too must be destroyed.~ #74128 */
  IF ~~ THEN REPLY @1098 /* ~Then we should fight her together!  How do you know she still can't summon Bhaal...everything you've fought for will be for nothing!~ #74129 */ GOTO a46
  IF ~CheckStatGT(Player1,8,WIS)~ THEN REPLY @1099 /* ~And you're going to stop her alone?  Have you given any thought to the fact that maybe you've been helping her all along, that she's been playing you like a harp?~ #74149 */ GOTO a62
  IF ~~ THEN REPLY @1100 /* ~Yet another death added to your tally?  And what then, once you kill her?  Once you have all that power and it's yours alone...you think you're going to resist that?~ #74157 */ GOTO a66
  IF ~~ THEN REPLY @1101 /* ~What makes you think you could kill her?  I'm the one that has defeated all the Bhaalspawn...while you were doing nothing but hiding in this fortress making the peasants miserable.~ #74161 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-2)~ GOTO a69
  IF ~~ THEN REPLY @1102 /* ~I thought you were going to kill yourself after I was dead.  Sure you won't see some more evil once Melissan is dead, too?  You'd probably make a promising Lord of Murder, you know...~ #74163 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a70
  IF ~~ THEN REPLY @1103 /* ~Forget it.  This is pointless.  Let's just get this over with.~ #74165 */ GOTO a93
END

IF ~~ THEN BEGIN a46 // from: 45.0
  SAY @1104 /* ~Fight her together?~ #74130 */
  IF ~OR(2)
Alignment(Player1,MASK_EVIL)
CheckStatLT(Player1,16,CHR)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a47
  IF ~!Alignment(Player1,MASK_EVIL)
CheckStatGT(Player1,15,CHR)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a61
END

IF ~~ THEN BEGIN a47 // from: 46.0
  SAY @1105 /* ~No.  How could I trust you?  What if we were to vanquish Melissan, I would be weakened...you could end my life there and everything I have been working towards will be for nothing.~ #74237 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a61 // from: 46.1
  SAY @1126 /* ~Perhaps what you are saying holds merit.  But what if I died during the battle?  What if I was weakened, in the end...you might find yourself...tempted.  How could I trust you?~ #80551 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a62 // from: 45.1
  SAY #69176 
  IF ~CheckStatLT(Player1,16,WIS)~ THEN REPLY @1128 /* ~I don't know how to explain it, exactly, but she must have used you!  She used everyone else!  I didn't trust her and she even got me to do what she wanted!~ #74151 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a63
  IF ~CheckStatGT(Player1,15,WIS)
CheckStatLT(Player1,19,WIS)~ THEN REPLY @1129 /* ~Think about it, Balthazar!  You honestly think she didn't know what your plans were?  Do you think you took her by surprise?  Even I saw it coming, and there was nothing I could do to stop it!~ #74153 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a64
  IF ~CheckStatGT(Player1,18,WIS)~ THEN REPLY @1130 /* ~She used you to get rid of the other Bhaalspawn, obviously.  Think about it!  She knew what you were planning all along.  She wanted all the Bhaalspawn dead...and she wants us to fight!  She *wants* this to happen!!~ #74155 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",2)~ GOTO a65
END

IF ~~ THEN BEGIN a63 // from: 62.0
  SAY @1131 /* ~Of course she used me, <CHARNAME>.  And no doubt she knew my plans as well as I knew hers.  This changes nothing.~ #74239 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a64 // from: 62.1
  SAY @1132 /* ~You...may be right, <CHARNAME>.  But that does not mean that my plan will fail.  Melissan underestimates me, I am sure of that...just as she underestimates you.~ #74154 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a65 // from: 62.2
  SAY @1133 /* ~I...perhaps you are right, <CHARNAME>.  I see the wisdom of your words.  Still...this does not mean my plan is doomed to failure.  Or is it?~ #74240 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a66 // from: 45.2
  SAY @1134 /* ~I must resist it.  I will.  I have no choice.~ #74241 */
  IF ~OR(2)
Alignment(Player1,MASK_GOOD)
ReputationGT(Player1,18)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a67
  IF ~!Alignment(Player1,MASK_GOOD)
!ReputationGT(Player1,18)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a68
END

IF ~~ THEN BEGIN a67 // from: 66.0
  SAY @1135 /* ~But...you have shown great willpower, as well.  Despite the taint in your soul, you have struggled against it just as I have.  What makes me more worthy...?  No, I must not question myself!  Not now!~ #74159 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a68 // from: 66.1
  SAY @1136 /* ~You are certainly no better a candidate for resisting such temptation, <CHARNAME>.  I would trust myself far more than I would trust you.  To send you to the Throne would be to give up everything I have believed in.~ #74242 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a69 // from: 45.3
  SAY @1137 /* ~Strength is nothing, <CHARNAME>.  You may vanquish me with your might, and you may even vanquish Melissan.  But you will never vanquish yourself.  Might will bring you no peace...this I know.  And this is why I must be the last.~ #74162 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a70 // from: 45.4
  SAY @1138 /* ~I am tired of the battles I have fought, <CHARNAME>.  I am tired of the anguish that I have endured, placing the greater good above the welfare of others, of myself and my own immortal soul.  It will be enough that Bhaal's legacy is destroyed, there is no temptation beyond that.~ #74164 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

///////////////////////////////////
//// Loop B: 'you don't have to do this'
///////////////////////////////////

IF ~~ THEN BEGIN a71 // from: 94.1 49.1 44.1
  SAY @1139 /* ~But I do.  It is my destiny.  What other choice have I?~ #74167 */
  IF ~~ THEN REPLY @1140 /* ~You always have a choice, Balthazar.  Don't be a slave to Alaundo's prophecy!  I have fought against it ever since I found out about my heritage and I will *not* give up!~ #74168 */ GOTO a72
  IF ~CheckStatGT(Player1,9,WIS)~ THEN REPLY @1141 /* ~Alaundo's prophecy does not mean the Bhaalspawn must be destroyers, Balthazar!  It also means we can stop the prophecy from becoming true, I know this!~ #74172 */ GOTO a75
  IF ~~ THEN REPLY @1142 /* ~You can walk away.  You can do what's right, Balthazar, what you know to be right instead of what you've resigned yourself to.~ #74180 */ GOTO a79
  IF ~~ THEN REPLY @1143 /* ~You are walking a path that you don't need to, Balthazar.  You see yourself as evil, but it doesn't have to be that way.~ #74184 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-2)~ GOTO a82
  IF ~~ THEN REPLY @1144 /* ~I am your <PRO_BROTHERSISTER>, Balthazar.  Let us fight what is inevitable!  We can work together!~ #74186 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a83
  IF ~~ THEN REPLY @1145 /* ~Forget it.  There's no point in discussing this with you, is there?  Let's get this over with.~ #74188 */ GOTO a93
END

IF ~~ THEN BEGIN a72 // from: 71.0
  SAY @1146 /* ~You are impressive with your words, <CHARNAME>.  I can feel destiny altering to your will, how you are the center of it all...how is it that I did not see this before?~ #74169 */
  IF ~OR(3)
Alignment(Player1,MASK_EVIL)
ReputationLT(Player1,10)
CheckStatLT(Player1,16,CHR)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a73
  IF ~!Alignment(Player1,MASK_EVIL)
!ReputationLT(Player1,10)
!CheckStatLT(Player1,16,CHR)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a74
END

IF ~~ THEN BEGIN a73 // from: 72.0
  SAY @1147 /* ~But the simple truth is your words ring hollow to me.  I do not believe them.  You have fought against destiny, yet I see it in you even the more as you speak.~ #74170 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a74 // from: 72.1
  SAY @1148 /* ~Perhaps...perhaps there is something to your words.  I look within myself and see how rigidly I have held myself to my destiny...and I feel hollow.  But I...cannot believe that this has been for nothing.~ #74238 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a75 // from: 71.1
  SAY @1149 /* ~What do you mean?  How do you know this?~ #74173 */
  IF ~CheckStatLT(Player1,16,WIS)~ THEN REPLY @1150 /* ~It was told to me by a Solar, an agent of prophecy!  It...oh, I know how it sounds, but it's true!~ #74174 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a76
  IF ~CheckStatGT(Player1,15,WIS)
CheckStatLT(Player1,19,WIS)~ THEN REPLY @1151 /* ~I have been told many things by agents of Alaundo's prophecy...higher beings that have sought me out to prepare me.  Alaundo's prophecy does not necessarily mean what you think it does, Balthazar.~ #74176 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a77
  IF ~CheckStatGT(Player1,18,WIS)~ THEN REPLY @1152 /* ~A Solar has been my mentor since this began, guiding me and preparing me for what is to come.  The prophecy is not so simple as you think it to be, no matter how we assume it to be.  Think about it and you'll know it to be true, Balthazar...everything has more than one side.~ #74178 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",2)~ GOTO a78
END

IF ~~ THEN BEGIN a76 // from: 75.0
  SAY @1153 /* ~I have no agent of the heavens to interpret my destiny for me, <CHARNAME>.  And my path remains clear.~ #74175 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a77 // from: 75.1
  SAY @1154 /* ~You plant a seed of doubt in me, <CHARNAME>, and I BEGIN ato wonder.  Yet...it seems that my destiny may differ from yours.  I have no heavenly guidance.  Perhaps my path has been made for me, yet.~ #74177 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a78 // from: 75.2
  SAY @1155 /* ~What you say is incredible, and yet...it does make sense.  Have I prepared myself for all this time in error?  How could this be?~ #74179 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a79 // from: 71.2
  SAY @1156 /* ~An appealing notion, to walk away.  Would that I could do so.  Would that any of us could have done so.~ #74181 */
  IF ~CheckStatGT(Player1,16,CHR)
!Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a80
  IF ~OR(2)
!CheckStatGT(Player1,16,CHR)
Alignment(Player1,MASK_EVIL)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a81
END

IF ~~ THEN BEGIN a80 // from: 79.0
  SAY @1157 /* ~But perhaps I have resigned myself to a path that is not what it seems.  You are...hardly what I expected for the last of the Bhaalspawn, <CHARNAME>.  Perhaps there is hope...or perhaps I am only deluding myself.~ #74182 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a81 // from: 79.1
  SAY @1158 /* ~But that is a fool's notion, <CHARNAME>, and I am no fool.  There is no such option available to me or any of us, no matter how appealing you may make it seem.~ #74183 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a82 // from: 71.3
  SAY @1159 /* ~No!  You have listened to nothing I have said!  It *is* that way because there is no choice for us!  You would have me forget all the murders I have committed with my own hands, all the wrongs I have done in the name of the greater good...I cannot forget!  I will not forgive myself and I will *not* allow others to be afflicted with the taint I possess!~ #74185 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a83 // from: 71.4
  SAY @1160 /* ~You have considerable charisma, <CHARNAME>...but it is because we are siblings that we cannot work together.  You know as well as I what the essence seeks, and it will not be satisfied until our destiny is culminated.~ #74187 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

///////////////////////////////////
//// Loop C: 'you seriously see yourself as the force of righteousness?'
///////////////////////////////////

 IF ~~ THEN BEGIN a84 // from: 94.2 49.2 44.2
  SAY @1161 /* ~I make no judgement upon you, <CHARNAME>.  You are what you were born to be.  I can only trust myself to hold to the path of good that will lead to the destruction of the true evil that threatens Faerun.  There is no other path for me.~ #74190 */
  IF ~~ THEN REPLY @1162 /* ~Look at the suffering you have brought to Amkethran!  Your monks terrorize the innocent at your command!  You hire soulless mercenaries that cut down the innocent at the slightest provocation!  And all for nothing!  You call these the actions of a good man?~ #74191 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",2)
SetGlobal("Righteousness","LOCALS",1)~ GOTO a85
  IF ~~ THEN REPLY @1163 /* ~A truly good man would have stood against Melissan from the beginning.  You say you wanted to find out who the Five were...and yet I defeated them without your scheming.  It was your choice to join the Five in their reign of destruction, so live up to it!~ #74193 */ DO ~SetGlobal("Righteousness","LOCALS",1)~ GOTO a86
  IF ~~ THEN REPLY @1164 /* ~You make no judgement upon me?  Don't make me laugh!  Inevitability is only the newest excuse for yet one more murder!  You would make our father proud!~ #74197 */ DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-2)
SetGlobal("Righteousness","LOCALS",1)~ GOTO a89
  IF ~~ THEN REPLY @1165 /* ~And what if that is my path, too, Balthazar?  You say you don't judge me, and yet you hold yourself to some duty as the only person who can fight against evil?  Do you know destiny so well that you can say for certain where it leads for someone else, never mind yourself?~ #74199 */ DO ~SetGlobal("Righteousness","LOCALS",1)~ GOTO a90
  IF ~~ THEN REPLY @1166 /* ~Then let's get this over with.  I'm tired of talking.~ #74203 */ DO ~SetGlobal("Righteousness","LOCALS",1)~ GOTO a93
END

IF ~~ THEN BEGIN a85 // from: 84.0
  SAY @1167 /* ~It...it is true.  I paid little attention to my men's actions, but I...I knew what they were doing.  I thought it a great sacridice, necessary to maintain secrecy, to attain my ultimate goal that they, in their ignorance, did not know would benefit them more in the end.  But...it is how we treat the most helpless of our brethren in the worst of times that marks the goodness of a man, does it not?  I...I am ashamed, <CHARNAME>.  I sought...only to do what was best for us all.~ #74192 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a86 // from: 84.1
  SAY @1168 /* ~You found out who the Five were through Melissan's scheming...and through, in no small part, my own.  But who is to say that things might not have been different?  Who are *you* to say that things might have been different?~ #74194 */
  IF ~!ReputationLT(Player1,11)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a87
  IF ~ReputationLT(Player1,11)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a88
END

IF ~~ THEN BEGIN a87 // from: 86.0
  SAY @1169 /* ~But...it is true, nevertheless.  I have taken the easy path, and have done much that has brought harm to others in the name of necessity.  But when does 'necessity' cross into the realm of evil?  I...I am ashamed, <CHARNAME>.~ #74195 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a88 // from: 86.1
  SAY @1170 /* ~I do not stand here proud of my accomplishments in attaining what I see to be a necessary goal...but neither should you.  You have blundered about, causing more harm by your negligence than I ever could by my plotting.~ #74196 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a89 // from: 84.2
  SAY @1171 /* ~I will *not* be mocked so!  I have sacrificed my entire life, the people of this village, everything I have in order to see this evil destroyed!  Destroyed, all of it!  I cry out to Ao the Overfather that such evil must not be allowed to live in the hearts of mortals, and I *will* be heard!~ #74198 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a90 // from: 84.3
  SAY @1172 /* ~I...know only what the temptations are that the taints puts upon us, <CHARNAME>.  I know only that if our power was to grow, if your power was to grow, that so would the temptation.~ #74200 */
  IF ~OR(2)
Alignment(Player1,MASK_GOOD)
ReputationGT(Player1,17)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",1)~ GOTO a91
  IF ~!Alignment(Player1,MASK_GOOD)
!ReputationGT(Player1,17)~ THEN DO ~IncrementGlobal("ConvinceBalth","GLOBAL",-1)~ GOTO a92
END

IF ~~ THEN BEGIN a91 // from: 90.0
  SAY @1173 /* ~But...you have been successful in fighting temptation.  More successful than I.  I have...done much that I regret, in the name of good.  My people suffer because I held my ultimate goal above all else...but is it not true that our treatment of the least of our brethren is the true judge of a man's soul?  I...I am ashamed.~ #74201 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

IF ~~ THEN BEGIN a92 // from: 90.1
  SAY @1174 /* ~And despite what you might profess, I think the taint sits closer to your heart then you would have me believe.  I must walk my own path, <CHARNAME>...and you must walk yours.~ #74202 */
  IF ~!GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a48
  IF ~GlobalLT("ConvinceBalth","GLOBAL",-2)~ THEN GOTO a60
END

//////////////////////////////////////////
//////////////////////////////////////////
/// Round 4
/// Balthazar asks what he should do.
///
/// you can (a) persuade him to fight (Convince=4+)
///         (b) have him kill himself, provided you vow not to take the taint (Convince=1-3)
///         (c) Be required to fight because Convince<=0
///         (d) choose to fight (several possible lines, all functionally identical)
//////////////////////////////////////////
//////////////////////////////////////////

IF ~~ THEN BEGIN a50 // from: 48.5 48.4 48.3
  SAY @1108 /* ~I am at a loss, <CHARNAME>.  You question me, and I have no good answers for you.  My heart tells me that you must be killed, but I am not sure if I should listen to it.  What...what would you have me do?~ #74138 */
  IF ~GlobalGT("ConvinceBalth","GLOBAL",3)~ THEN REPLY @1109 /* ~Join me, Balthazar.  Let us fight Melissan together, instead of doing what she wants us to.~ #74139 */ GOTO a51
  IF ~!GlobalGT("ConvinceBalth","GLOBAL",3)~ THEN REPLY @1109 /* ~Join me, Balthazar.  Let us fight Melissan together, instead of doing what she wants us to.~ #74143 */ GOTO a54
  IF ~GlobalGT("ConvinceBalth","GLOBAL",0)~ THEN REPLY @1110 /* ~I don't know, Balthazar.  But I don't want to fight you.~ #74144 */ GOTO a55
  IF ~!GlobalGT("ConvinceBalth","GLOBAL",0)~ THEN REPLY @1110 /* ~I don't know, Balthazar.  But I don't want to fight you.~ #74145 */ GOTO a57
  IF ~~ THEN REPLY @1111 /* ~Let us fight, then, if it must be.  Let me give you some peace at last.~ #74146 */ GOTO a57
  IF ~~ THEN REPLY @1112 /* ~You're a weaker fool then I thought.  Let's just end this now, shall we?  I have an appointment with god-hood.~ #74147 */ GOTO a59
END

IF ~~ THEN BEGIN a51 // from: 50.0
  SAY @1113 /* ~Yes...you are right.~ #80548 */
    = @1114 /* ~Very well, then, <CHARNAME>.  I will join you.  You are a worthy <PRO_MANWOMAN>.  Perhaps even worthy of turning Bhaal's dark taint and making something better of it.*/ 
    = @1115 /* ~Let Melissan tremble when she sees us together, and we shall strike her down as she deserves.  Even if Bhaal himself is resurrected, he will not be able to hold out against us both.  I have preparations to make, <CHARNAME>.  Go to the Throne of Bhaal.  When the time comes, I will be there.~ #80550 */
  IF ~~ THEN DO ~SetGlobal("BalthazarFights","GLOBAL",1)
ActionOverride("balelit1",EscapeArea())
ActionOverride("balelit2",EscapeArea())
ActionOverride("balelit3",EscapeArea())
ActionOverride("balelit4",EscapeArea())
EraseJournalEntry(67720)
EraseJournalEntry(67721)
EraseJournalEntry(67722)
EraseJournalEntry(67723)
EraseJournalEntry(66357)
ReallyForceSpell(Myself,DRYAD_TELEPORT)~ EXIT
END

IF ~~ THEN BEGIN a54 // from: 50.1
  SAY @1116 /* ~I cannot, <CHARNAME>.~ #74226 */
  IF ~GlobalGT("ConvinceBalth","GLOBAL",0)~ THEN GOTO a55
  IF ~!GlobalGT("ConvinceBalth","GLOBAL",0)~ THEN GOTO a58
END

IF ~~ THEN BEGIN a55 // from: 54.0 50.2
  SAY @1117 /* ~You must take the battle to Melissan.  It is your destiny to see that the Bhaal's legacy ends here and now.  But you must promise me, <CHARNAME>...you must promise me that you will not give into the temptation.  Should you defeat Melissan and the power become available to you, you must turn away from it...you have seen your struggle as it is now, with only a sliver of that taint.  Do not take it, <CHARNAME>...even a god can be tempted, you must realize that.  Promise me you will turn it away.~ #74227 */
  IF ~~ THEN REPLY @1118 /* ~If I am given the option, Balthazar...I will refuse the taint.  I swear it.~ #74228 */ GOTO a56
  IF ~~ THEN REPLY @1119 /* ~No.  I will swear nothing of the kind.  Great good could come out of that power, you don't know otherwise any better than I.~ #74230 */ GOTO a57
  IF ~~ THEN REPLY @1120 /* ~Forget it!  I'll do no such thing!~ #74231 */ GOTO a57
END

IF ~~ THEN BEGIN a56 // from: 55.0
  SAY @1121 /* ~Then I am satisfied.  The essence of our sire ends with me...and with you.  May the gods forgive me.  May you...may you forgive me, <PRO_BROTHERSISTER>...~ #74229 */
  IF ~~ THEN DO ~ActionOverride("balelit1",EscapeArea())
ActionOverride("balelit2",EscapeArea())
ActionOverride("balelit3",EscapeArea())
ActionOverride("balelit4",EscapeArea())
EraseJournalEntry(67720)
EraseJournalEntry(67721)
EraseJournalEntry(67722)
EraseJournalEntry(67723)
EraseJournalEntry(66357)
Kill(Myself)~ EXIT
END

IF ~~ THEN BEGIN a57 // from: 55.2 55.1 50.4 50.3
  SAY @1122 /* ~Then we must do battle.  I...I am sorry, <PRO_BROTHERSISTER>.  I had hoped this would be otherwise.~ #74232 */
  IF ~~ THEN DO ~Shout(ALERT)
Enemy()
EraseJournalEntry(67720)
EraseJournalEntry(67721)
EraseJournalEntry(67722)
EraseJournalEntry(67723)
EraseJournalEntry(66357)~ EXIT
END

IF ~~ THEN BEGIN a58 // from: 54.1
  SAY @1123 /* ~And I cannot trust that you will turn aside the power when it is offered to you.  You have experienced the struggle even a sliver of Bhaal's taint has brought you, yet I cannot believe that you would turn it aside.  I...I am sorry, <PRO_BROTHERSISTER>...but I have no choice.~ #74233 */
  IF ~~ THEN DO ~Shout(ALERT)
Enemy()
EraseJournalEntry(67720)
EraseJournalEntry(67721)
EraseJournalEntry(67722)
EraseJournalEntry(67723)
EraseJournalEntry(66357)~ EXIT
END

IF ~~ THEN BEGIN a59 // from: 50.5
  SAY @1124 /* ~So be it.  Come, my pupils...may the gods help us all.~ #74234 */
  IF ~~ THEN DO ~Shout(ALERT)
Enemy()
EraseJournalEntry(67720)
EraseJournalEntry(67721)
EraseJournalEntry(67722)
EraseJournalEntry(67723)
EraseJournalEntry(66357)~ EXIT
END

END /* end of big APPEND of states to BALTH.DLG */
