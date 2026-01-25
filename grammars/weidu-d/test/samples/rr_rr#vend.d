// creator  : aVENGER
// argument : RR#VEND.DLG

BEGIN ~RR#VEND~
IF ~NumTimesTalkedTo(0)~ THEN BEGIN 0
  SAY @2500
=
@2501
=
@2502 
=
@2503
=
@2504
=
@2505
=
@2506
=
@2507
= 
@2508

IF ~CheckStatGT(Player1,4,INT)
	CheckStatGT(Player1,4,WIS)
	CheckStatGT(Player1,4,CHR)
OR(2)
	Class(Player1,CLERIC_ALL)
	Class(Player1,PALADIN_ALL)~ THEN REPLY @2509 DO ~AddXPObject(Player1,750)~ GOTO 2b
IF ~CheckStatLT(Protagonist,5,CHR)~ THEN REPLY @2510 GOTO 1a

IF ~CheckStatGT(Player1,4,INT)
	CheckStatGT(Player1,4,WIS)
	CheckStatGT(Player1,4,CHR)
	CheckStatGT(Player1,24,LORE)
	!Class(Player1,CLERIC_ALL)
	!Class(Player1,PALADIN_ALL)~ THEN REPLY @2511 DO ~AddXPObject(Player1,750)~ GOTO 2b

IF ~CheckStatGT(Player1,4,INT)
	CheckStatGT(Player1,4,WIS)
	CheckStatGT(Player1,4,CHR)
OR(2)
	CheckStatGT(Player1,13,INT)
	CheckStatGT(Player1,13,WIS)~ THEN REPLY @2512 DO ~AddXPObject(Player1,750)~ GOTO 2b

IF ~CheckStatGT(Player1,4,INT)
	CheckStatGT(Player1,4,WIS)
	CheckStatGT(Player1,4,CHR)~ THEN REPLY @2513 GOTO 2

IF ~CheckStatGT(Player1,4,INT)
	CheckStatGT(Player1,4,WIS)
	CheckStatGT(Player1,4,CHR)
	!Class(Player1,PALADIN_ALL)~ THEN REPLY @2514 GOTO 2a

IF ~CheckStatLT(Protagonist,5,INT)
	CheckStatGT(Protagonist,4,CHR)~ THEN REPLY @2516 GOTO 1b
IF ~CheckStatLT(Protagonist,5,WIS)
	CheckStatGT(Protagonist,4,INT)
	CheckStatGT(Protagonist,4,CHR)~ THEN REPLY @2517 GOTO 1c
END

IF ~~ THEN BEGIN 1a
SAY @2518
= 
@2519
  IF ~~ THEN DO ~SetGlobal("RR#CSAVE","GLOBAL",1)
		StartCutsceneMode()
		StartCutScene("RR#CSAVE")~ UNSOLVED_JOURNAL @600 EXIT
END

IF ~~ THEN BEGIN 1b
SAY @2520
=
@2521
  IF ~~ THEN DO ~SetGlobal("RR#CSAVE","GLOBAL",1)
		StartCutsceneMode()
		StartCutScene("RR#CSAVE")~ UNSOLVED_JOURNAL @600 EXIT
END

IF ~~ THEN BEGIN 1c
SAY @2522
= 
@2523
  IF ~~ THEN DO ~SetGlobal("RR#CSAVE","GLOBAL",1)
		StartCutsceneMode()
		StartCutScene("RR#CSAVE")~ UNSOLVED_JOURNAL @600 EXIT
END

IF ~~ THEN BEGIN 2
SAY @2524
=
@2525
=
@2526
  IF ~~ THEN REPLY @2527 UNSOLVED_JOURNAL @601 GOTO 3
  IF ~~ THEN REPLY @2528 UNSOLVED_JOURNAL @601 GOTO 3
END

IF ~~ THEN BEGIN 2a
SAY @2529 
=
@2530
  IF ~~ THEN DO ~SetGlobal("RR#CSAVE","GLOBAL",1)
		StartCutsceneMode()
		StartCutScene("RR#CSAVE")~ UNSOLVED_JOURNAL @600 EXIT
END

IF ~~ THEN BEGIN 2b
SAY @2531
=
@2532 
=
@2533
IF ~CheckStatGT(Player1,4,INT)
	CheckStatGT(Player1,4,WIS)
	CheckStatGT(Player1,4,CHR)
OR(2)
	Class(Player1,CLERIC_ALL)
	Class(Player1,PALADIN_ALL)~ THEN REPLY @2534 DO ~AddXPObject(Player1,750)~ UNSOLVED_JOURNAL @601 GOTO 3
  IF ~~ THEN REPLY @2527 UNSOLVED_JOURNAL @601 GOTO 3
  IF ~~ THEN REPLY @2528 UNSOLVED_JOURNAL @601 GOTO 3
END

IF ~~ THEN BEGIN 3
SAY  @2535
=
@2536
=
@2537
=
@2538 
=
@2539
=
@2540
IF ~CheckStatGT(Player1,11,CHR)~ THEN REPLY @2541 DO ~AddXPObject(Player1,1000)~ GOTO 4b
IF ~OR(2) CheckStatGT(Player1,11,INT)
		  CheckStatGT(Player1,11,WIS)~ THEN REPLY @2542 DO ~AddXPObject(Player1,1000)~ GOTO 4b
IF ~CheckStatGT(Protagonist,9,CHR)
	Class(Player1,THIEF_ALL)~ THEN REPLY @2543 DO ~AddXPObject(Player1,1000)~ GOTO 4b
IF ~Gender(Player1,FEMALE)
	CheckStatGT(Player1,13,CHR)~ THEN REPLY @2544 EXTERN ~RR#SELI~ RR#SE08
IF ~~ THEN REPLY @2545 GOTO 4
IF ~~ THEN REPLY @2546 GOTO 4a
END

IF ~~ THEN BEGIN 3a
SAY @2547
=
@2548
IF ~CheckStatGT(Player1,11,CHR)~ THEN REPLY @2541 DO ~AddXPObject(Player1,1000)~ GOTO 4b
IF ~OR(2) CheckStatGT(Player1,11,INT)
		  CheckStatGT(Player1,11,WIS)~ THEN REPLY @2549 DO ~AddXPObject(Player1,1000)~ GOTO 4b
IF ~CheckStatGT(Protagonist,9,CHR)
	Class(Player1,THIEF_ALL)~ THEN REPLY @2543 DO ~AddXPObject(Player1,1000)~ GOTO 4b
IF ~~ THEN REPLY @2545 GOTO 4
IF ~~ THEN REPLY @2546 GOTO 4a
END


IF ~~ THEN BEGIN 4
SAY @2550
=
@2551
  IF ~~ THEN DO ~SetGlobal("RR#CSAVE","GLOBAL",1)
		StartCutsceneMode()
		StartCutScene("RR#CSAVE")~ EXIT
END

IF ~~ THEN BEGIN 4a
SAY @2552
=
@2553
=
@2554
=
@2555
  IF ~~ THEN DO ~SetGlobal("RR#CSAVE","GLOBAL",1)
		StartCutsceneMode()
		StartCutScene("RR#CSAVE")~ EXIT
END

IF ~~ THEN BEGIN 4b
SAY @2556
=
@2557
=
@2558
  IF ~Global("RR#VSTALL","GLOBAL",0)
	OR(3)
	CheckStatGT(Player1,13,INT)
	CheckStatGT(Player1,13,WIS)
	CheckStatGT(Player1,13,CHR)~ THEN REPLY @2559 DO ~SetGlobal("RR#VSTALL","GLOBAL",1)~ GOTO 12
  IF ~Global("RR#CWARDS","GLOBAL",1)~ THEN REPLY @2560 DO ~SetGlobal("RR#CWARDS","GLOBAL",2) AddXPObject(Player1,750)~ GOTO 20a
  IF ~Global("RR#CWARDS","GLOBAL",0)~ THEN REPLY @2561 DO ~SetGlobal("RR#CWARDS","GLOBAL",2)~ GOTO 20
  IF ~Global("RR#CKNOWME","GLOBAL",0)~ THEN REPLY @2562 DO ~SetGlobal("RR#CKNOWME","GLOBAL",1)~ GOTO 5
  IF ~Global("RR#CKILLR","GLOBAL",0)~ THEN REPLY @2563 DO ~SetGlobal("RR#CKILLR","GLOBAL",1)~ GOTO 6

IF ~OR(2) CheckStatGT(Player1,15,INT)
		  CheckStatGT(Player1,15,WIS)
		  Global("RR#CKILLR","GLOBAL",1)
		  Global("RR#CKNOWME","GLOBAL",1)~ THEN REPLY @2565 GOTO 7

IF ~!Class(Player1,PALADIN_ALL)
	CheckStatGT(Player1,15,CHR)
	Alignment(Player1,MASK_GOOD)
	ReputationGT(Player1,9)
	Global("RR#CKNOWME","GLOBAL",1)
	Global("RR#CKILLR","GLOBAL",1)~ THEN REPLY @2566 GOTO 9

IF ~Class(Player1,PALADIN_ALL)
	CheckStatGT(Player1,17,CHR)
	Alignment(Player1,LAWFUL_GOOD)
	ReputationGT(Player1,9)
	Global("RR#CKNOWME","GLOBAL",1)
	Global("RR#CKILLR","GLOBAL",1)~ THEN REPLY @2567 GOTO 8

IF ~!Class(Player1,PALADIN_ALL)
	Global("RR#CINTIMD","GLOBAL",0)
	Global("RR#CKNOWME","GLOBAL",1)
	Global("RR#CKILLR","GLOBAL",1)~ THEN REPLY @2568 DO ~SetGlobal("RR#CINTIMD","GLOBAL",1)~ GOTO 10
IF ~~ THEN REPLY @2564 GOTO 4a
END

IF ~~ THEN BEGIN 5
SAY @2569
=
@2570
=
@2571
=
@2572

IF ~OR(2)
	CheckStatGT(Player1,13,INT)
	CheckStatGT(Player1,13,WIS)~ THEN REPLY @2573 DO ~AddXPObject(Player1,750)~ GOTO 5a
IF ~~ THEN REPLY @2574 GOTO 5b
IF ~~ THEN REPLY @2575 GOTO 5c
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 5a
SAY @2577
=
@2578
=
@2579 
=
@2580
IF ~~ THEN REPLY @2574 GOTO 5b
IF ~~ THEN REPLY @2575 GOTO 5c
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 5b
SAY @2581
=
@2582
=
@2583
=
@2584
IF ~~ THEN REPLY @2585 GOTO 5c
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 5c
SAY @2586
=
@2587
=
@2588
IF ~~ THEN REPLY @2589 GOTO 5b
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 6
SAY @2590
=
@2591
=
@2592
IF ~OR(2)
	 CheckStatGT(Player1,14,INT)
	 CheckStatGT(Player1,14,WIS)~ THEN REPLY @2593 DO ~SetGlobal("RR#CORDERS","GLOBAL",1) AddXPObject(Player1,1500)~ GOTO 6a
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 6a
SAY @2594
=
@2595
=
@2596
IF ~~ THEN REPLY @2597 GOTO 4b
END

IF ~~ THEN BEGIN 7
SAY @2598
=
@2599
=
@2600
=
@2601

IF ~CheckStatGT(Player1,49,LORE)~ THEN REPLY @2602 GOTO 7c

IF ~OR(2) CheckStatGT(Player1,16,INT)
		  CheckStatGT(Player1,16,WIS)~ THEN REPLY @2603  GOTO 7a

IF ~Global("RR#CORDERS","GLOBAL",1)
~ THEN REPLY @2604 GOTO 7a
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 7a
SAY @2605
=
@2606

IF ~OR(2) CheckStatGT(Player1,17,INT)
		  CheckStatGT(Player1,17,WIS)~ THEN REPLY @2607 GOTO 7b
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 7b

SAY @2608
=
@2609
=
@2610
=
@2611
=
@2612
=
@2613
IF ~~ THEN DO ~AddXPObject(Player1,35000) AddXPObject(Player2,35000) AddXPObject(Player3,35000) AddXPObject(Player4,35000) AddXPObject(Player5,35000) AddXPObject(Player6,35000) SetGlobal("RR#CINSIGHT","GLOBAL",2)~ SOLVED_JOURNAL @623 GOTO 50 
END

IF ~~ THEN BEGIN 7c

SAY @2605
=
@2614

IF ~CheckStatGT(Player1,74,LORE)~ THEN REPLY @2615 GOTO 7b
IF ~~ THEN REPLY @2616 GOTO 4b
END

IF ~~ THEN BEGIN 8
SAY @2605
=
@2617

IF ~CheckStatGT(Player1,17,CHR)
	ReputationGT(Player1,17)~ THEN REPLY @2618  GOTO 8a

IF ~ReputationGT(Player1,19)~ THEN REPLY @2619  GOTO 8a
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 8a
SAY @2608
=
@2620
=
@2621
=
@2622
=
@2623

IF ~~ THEN REPLY @2624  GOTO 8b
IF ~~ THEN REPLY @2625  GOTO 8b
END

IF ~~ THEN BEGIN 8b
SAY @2626
=
@2627
=
@2628
IF ~~ THEN DO ~AddXPObject(Player1,35000) AddXPObject(Player2,35000) AddXPObject(Player3,35000) AddXPObject(Player4,35000) AddXPObject(Player5,35000) AddXPObject(Player6,35000) SetGlobal("RR#CPERSUADE","GLOBAL",2)~ SOLVED_JOURNAL @624 GOTO 50
END


IF ~~ THEN BEGIN 9
SAY @2605
=
@2617

IF ~CheckStatGT(Player1,17,CHR)
	ReputationGT(Player1,17)~ THEN REPLY @2629  GOTO 8a

IF ~ReputationGT(Player1,19)~ THEN REPLY @2619  GOTO 8a
IF ~~ THEN REPLY @2576 GOTO 4b
END


IF ~~ THEN BEGIN 10
SAY @2605
=
@2630

IF  ~!Class(Player1,PALADIN_ALL)~ THEN REPLY @2631 DO ~ClearAllActions() StartCutSceneMode() StartCutScene("RR#CSLY1")~ EXIT

IF  ~NumInPartyAliveGT(3)
	CheckStatGT(Player1,2949999,XP)~ THEN REPLY @2632  GOTO 10a
IF ~NumInPartyAliveGT(3)
	CheckStatLT(Player1,2950000,XP)
	CheckStatGT(Player1,2499999,XP)
	CheckStatGT(Player1,17,CHR)~ THEN REPLY @2633  GOTO 10a
IF ~NumInPartyAliveLT(2)
	CheckStatLT(Player1,2950000,XP)
	CheckStatGT(Player1,2499999,XP)
	CheckStatGT(Player1,17,CHR)~ THEN REPLY @2634  GOTO 10d
IF ~CheckStatLT(Player1,3500000,XP)
	CheckStatGT(Player1,13,CHR)~ THEN REPLY @2635  GOTO 10c
IF ~NumInPartyAliveLT(2)
	CheckStatGT(Player1,2949999,XP)~ THEN REPLY @2636  GOTO 10d
IF ~NumInPartyAliveGT(1)
	NumInPartyAliveLT(4)
	CheckStatGT(Player1,2949999,XP)~ THEN REPLY @2632  GOTO 10e
IF ~CheckStatGT(Player1,15,CHR)~ THEN REPLY @2637 DO ~AddXPObject(Player1,250)~ GOTO 4b
IF ~~ THEN REPLY @2638  GOTO 4a 
IF ~~ THEN REPLY @2639 GOTO 4
END

IF ~~ THEN BEGIN 10a
SAY @2640
=
@2641
=
@2642
=
@2643
=
@2644
IF ~~ THEN DO ~AddXPObject(Player1,35000) AddXPObject(Player2,35000) AddXPObject(Player3,35000) AddXPObject(Player4,35000) AddXPObject(Player5,35000) AddXPObject(Player6,35000) SetGlobal("RR#CINTIMD","GLOBAL",2)~ SOLVED_JOURNAL @622 GOTO 50
END

IF ~~ THEN BEGIN 10b
SAY @2640
=
@2645

IF  ~!Class(Player1,PALADIN_ALL)~ THEN REPLY @2631 DO ~ClearAllActions() StartCutSceneMode() StartCutScene("RR#CSLY1")~ EXIT
IF ~CheckStatGT(Player1,15,CHR)~ THEN REPLY @2637 DO ~AddXPObject(Player1,250)~ GOTO 4b
IF ~~ THEN REPLY @2646 GOTO 4a
IF ~~ THEN REPLY @2639 GOTO 4
END

IF ~~ THEN BEGIN 10c
SAY @2647
=
@2648

IF  ~!Class(Player1,PALADIN_ALL)~ THEN REPLY @2649 DO ~ClearAllActions() StartCutSceneMode() StartCutScene("RR#CSLY1")~ EXIT
IF ~~ THEN REPLY @2650 DO ~SetGlobal("RR#CSAVE","GLOBAL",1)
		StartCutsceneMode()
		StartCutScene("RR#CSAVE")~ EXIT
END

IF ~~ THEN BEGIN 10d
SAY @2640
=
@2651
=
@2652
=
@2653

IF  ~!Class(Player1,PALADIN_ALL)~ THEN REPLY @2631 DO ~ClearAllActions() StartCutSceneMode() StartCutScene("RR#CSLY1")~ EXIT
IF ~CheckStatGT(Player1,15,CHR)~ THEN REPLY @2637 DO ~AddXPObject(Player1,250)~ GOTO 4b
IF ~~ THEN REPLY @2646 GOTO 4a
IF ~~ THEN REPLY @2639 GOTO 4
END

IF ~~ THEN BEGIN 10e
SAY @2640
=
@2654
=
@2652
=
@2655

IF  ~!Class(Player1,PALADIN_ALL)~ THEN REPLY @2631 DO ~ClearAllActions() StartCutSceneMode() StartCutScene("RR#CSLY1")~ EXIT
IF ~CheckStatGT(Player1,15,CHR)~ THEN REPLY @2637 DO ~AddXPObject(Player1,250)~ GOTO 4b
IF ~~ THEN REPLY @2646 GOTO 4a
IF ~~ THEN REPLY @2639 GOTO 4
END


IF ~~ THEN BEGIN 12
SAY @2656

IF ~Global("RR#CSCAN","GLOBAL",0)
	OR(2)
	Race(Player1,HUMAN)
	Race(Player1,HALFLING)
    !StateCheck(Player1,STATE_INFRAVISION)~ THEN REPLY @2657 DO ~SetGlobal("RR#CSCAN","GLOBAL",1)~ EXTERN ~RR#ZAER~ RR#ZA00

IF ~Global("RR#CSCAN","GLOBAL",0)
	!Race(Player1,HUMAN)
	!Race(Player1,HALFLING)~ THEN REPLY @2658 DO ~SetGlobal("RR#CSCAN","GLOBAL",2)~ EXTERN ~RR#ZAER~ RR#ZA01

IF ~Global("RR#CSCAN","GLOBAL",0)
	OR(2)
	Race(Player1,HUMAN)
	Race(Player1,HALFLING)
    StateCheck(Player1,STATE_INFRAVISION)
~ THEN REPLY @2659 DO ~SetGlobal("RR#CSCAN","GLOBAL",2)~ EXTERN ~RR#ZAER~ RR#ZA01

IF ~Class(Player1,PALADIN_ALL) Global("RR#CDETEVL","GLOBAL",0)~ THEN REPLY @2660 DO ~SetGlobal("RR#CDETEVL","GLOBAL",1)~ EXTERN ~RR#ZAER~ RR#ZA03

IF ~CheckStatGT(Player1,89,TRAPS) Global("RR#CTRAPS","GLOBAL",0)~ THEN REPLY @2661 DO ~SetGlobal("RR#CTRAPS","GLOBAL",1) MoveViewPoint([815.417],INSTANT)~ GOTO 13c
IF ~Global("RR#CTRAPS","GLOBAL",0)
	CheckStatLT(Player1,90,TRAPS)
	OR(2)
	Race(Player1,DWARF)
	Race(Player1,GNOME)~ THEN REPLY @2662 DO ~SetGlobal("RR#CTRAPS","GLOBAL",2) MoveViewPoint([815.417],INSTANT)~ GOTO 13d

IF ~Global("RR#CTRACK","GLOBAL",0)
	OR(2)
        Class(Player1,RANGER_ALL)
        Kit(Player1,BOUNTYHUNTER)~ THEN REPLY @2663 DO ~SetGlobal("RR#CTRACK","GLOBAL",1)~ GOTO 13e

IF ~Global("RR#CWARDS","GLOBAL",0)
	OR(2)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)~ THEN REPLY @2664 DO ~SetGlobal("RR#CWARDS","GLOBAL",1)~ GOTO 13f

IF ~~ THEN REPLY @2665 GOTO 4b
END

IF ~~ THEN BEGIN 13
SAY @2666
=
@2667
=
@2668
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ GOTO 12
END

IF ~~ THEN BEGIN 13a
SAY @2666
=
@2669
=
@2670
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ GOTO 12
END

IF ~~ THEN BEGIN 13b
SAY @2671
=
@2672
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ GOTO 12
END

IF ~~ THEN BEGIN 13c
SAY @2673
=
@2674
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ GOTO 12
END

IF ~~ THEN BEGIN 13d
SAY @2675
=
@2676
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ GOTO 12
END

IF ~~ THEN BEGIN 13e
SAY @2677
=
@2678
=
@2679
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ GOTO 12
END

IF ~~ THEN BEGIN 13f
SAY @2680
=
@2681
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ GOTO 12
END


IF ~~ THEN BEGIN 20
SAY @2682
IF ~NumInPartyAliveLT(2)~ THEN REPLY @2624 GOTO 20b
IF ~NumInPartyAliveGT(1)~ THEN REPLY @2624 GOTO 20c
END

IF ~~ THEN BEGIN 20a
SAY @2683
=
@2684
IF ~NumInPartyAliveLT(2)~ THEN REPLY @2685 GOTO 20b
IF ~NumInPartyAliveGT(1)~ THEN REPLY @2685 GOTO 20c
END

IF ~~ THEN BEGIN 20b
SAY @2686
=
@2687

IF ~Global("RR#CWARDS","GLOBAL",2)
    OR(2)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,9,INT)
	CheckStatGT(Player1,9,WIS)~ THEN REPLY @2688 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e

IF ~Global("RR#CWARDS","GLOBAL",2)
	!Class(Player1,MAGE_ALL)
	!Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,15,INT)
	CheckStatGT(Player1,15,WIS)~ THEN REPLY @2689 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e
IF ~~ THEN REPLY @2690  GOTO 20f
IF ~~ THEN REPLY @2691 GOTO 20d
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 20c
SAY @2686
=
@2692

IF ~Global("RR#CWARDS","GLOBAL",2)
    OR(2)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,9,INT)
	CheckStatGT(Player1,9,WIS)~ THEN REPLY @2688 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e

IF ~Global("RR#CWARDS","GLOBAL",2)
	!Class(Player1,MAGE_ALL)
	!Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,15,INT)
	CheckStatGT(Player1,15,WIS)~ THEN REPLY @2689 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e
IF ~~ THEN REPLY @2690  GOTO 20f
IF ~~ THEN REPLY @2693 GOTO 20d
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 20d
SAY @2694
=
@2695
=
@2696

IF ~Global("RR#CWARDS","GLOBAL",2)
    OR(2)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,9,INT)
	CheckStatGT(Player1,9,WIS)~ THEN REPLY @2697 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e

IF ~Global("RR#CWARDS","GLOBAL",2)
	!Class(Player1,MAGE_ALL)
	!Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,15,INT)
	CheckStatGT(Player1,15,WIS)~ THEN REPLY @2698 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e
IF ~~ THEN REPLY @2690  GOTO 20f
IF ~~ THEN REPLY @2576 GOTO 4b
END

IF ~~ THEN BEGIN 20e
SAY @2699
=
@2700
IF ~NumInPartyAliveLT(2)~ THEN REPLY @2701 UNSOLVED_JOURNAL @602 GOTO 20d
IF ~NumInPartyAliveGT(1)~ THEN REPLY @2702 UNSOLVED_JOURNAL @602 GOTO 20d
IF ~~ THEN REPLY @2703 UNSOLVED_JOURNAL @602 GOTO 4b
END

IF ~~ THEN BEGIN 20f
SAY @2704
=
@2705
IF ~Global("RR#CWARDS","GLOBAL",2)
    OR(2)
	Class(Player1,MAGE_ALL)
	Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,9,INT)
	CheckStatGT(Player1,9,WIS)~ THEN REPLY @2697 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e

IF ~Global("RR#CWARDS","GLOBAL",2)
	!Class(Player1,MAGE_ALL)
	!Class(Player1,BARD_ALL)
	OR(2)
	CheckStatGT(Player1,15,INT)
	CheckStatGT(Player1,15,WIS)~ THEN REPLY @2698 DO ~AddXPObject(Player1,1500)
SetGlobal("RR#CWARDS","GLOBAL",3)~ GOTO 20e
IF ~NumInPartyAliveLT(2)~ THEN REPLY @2691 GOTO 20d
IF ~NumInPartyAliveGT(1)~ THEN REPLY @2693 GOTO 20d
IF ~~ THEN REPLY @2706 GOTO 4b
END

IF ~~ THEN BEGIN 50
SAY @2707
IF ~~ THEN DO ~ClearAllActions()
        StartCutSceneMode()
        TriggerActivation("RR#BLUP",FALSE)
        TriggerActivation("RR#BLDN",FALSE)
		SmallWait(1)
        CreateCreature("RR#OBSRV",[870.408],0) // No such index
        StartCutScene("RR#CEND3")~ EXIT
END

IF ~Global("RR#CSLAY","GLOBAL",1)~ THEN BEGIN 200
SAY @2708
=
@2709
=
@2710
=
@2711

IF  ~~ THEN REPLY @2712 GOTO 201

IF ~~ THEN REPLY @2713 DO ~SetGlobal("RR#CSLAY","GLOBAL",2)
		ClearAllActions()
        StartCutSceneMode()
        TriggerActivation("RR#BLUP",FALSE)
        TriggerActivation("RR#BLDN",FALSE)
		SmallWait(1)
        CreateCreature("RR#OBSRV",[870.408],0) // No such index
        StartCutScene("RR#CEND4")~ EXIT
END


IF ~~ THEN BEGIN 201
SAY @2714

IF  ~Class(Player1,RANGER_ALL)~ THEN REPLY @2712 DO ~SetGlobal("RR#CSLAY","GLOBAL",3)
	ActionOverride(Player1,RemoveRangerHood())
	DisplayStringHead(Player1,19621) // Lost Class: Ranger
	ClearAllActions()
        StartCutSceneMode()
        StartCutScene("RR#CSLY2")~ EXIT
IF  ~!Class(Player1,RANGER_ALL)~ THEN REPLY @2712 DO ~SetGlobal("RR#CSLAY","GLOBAL",3)
	DisplayStringHead(Player1,@553) // RRAAAAWRWWRGHH!!!
	ClearAllActions()
        StartCutSceneMode()
        StartCutScene("RR#CSLY2")~ EXIT

IF ~~ THEN REPLY @2713 DO ~SetGlobal("RR#CSLAY","GLOBAL",2)
		ClearAllActions()
        StartCutSceneMode()
        TriggerActivation("RR#BLUP",FALSE)
        TriggerActivation("RR#BLDN",FALSE)
		SmallWait(1)
        CreateCreature("RR#OBSRV",[870.408],0) // No such index
        StartCutScene("RR#CEND4")~ EXIT
END



BEGIN ~RR#ZAER~ // Zaeron's interjections

IF ~~ THEN BEGIN RR#ZA00
  SAY @2080
=
@2081
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#SELI~ RR#SE00
END

IF ~~ THEN BEGIN RR#ZA01
  SAY @2082
=
@2083
=
@2084
=
@2085
  IF ~OR(2)
	  Race(Player1,ELF)
	  Race(Player1,HALF_ELF)~ THEN GOTO RR#ZA02
  IF ~!Race(Player1,ELF)
	  !Race(Player1,HALF_ELF)~ THEN DO ~AddXPObject(Player1,750)~ EXTERN ~RR#SELI~ RR#SE01
END

IF ~~ THEN BEGIN RR#ZA02
SAY @2086 
=
@2087
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ EXTERN ~RR#SELI~ RR#SE01
END

IF ~~ THEN BEGIN RR#ZA03
SAY @2088
=
@2089
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#SELI~ RR#SE07
END


BEGIN ~RR#SELI~ // Selina's interjections

IF ~~ THEN BEGIN RR#SE00
  SAY @2060
=
@2061
  IF ~Global("RR#KnowMarina","GLOBAL",0)~ THEN GOTO RR#SE03
  IF ~Global("RR#KnowMarina","GLOBAL",1)~ THEN DO ~SetGlobal("RR#KnowMarina","GLOBAL",2)~ GOTO RR#SE05
END

IF ~~ THEN BEGIN RR#SE01
  SAY @2060
=
@2062
  IF ~Global("RR#KnowMarina","GLOBAL",0)~ THEN GOTO RR#SE04
  IF ~Global("RR#KnowMarina","GLOBAL",1)~ THEN DO ~SetGlobal("RR#KnowMarina","GLOBAL",2)~ GOTO RR#SE06
END

IF ~~ THEN BEGIN RR#SE03
  SAY @2063
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#GROK~ RR#GR00
END

IF ~~ THEN BEGIN RR#SE04
  SAY @2063
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ EXTERN ~RR#GROK~ RR#GR01
END

IF ~~ THEN BEGIN RR#SE05
  SAY @2064
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#GROK~ RR#GR00
END

IF ~~ THEN BEGIN RR#SE06
  SAY @2065
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ EXTERN ~RR#GROK~ RR#GR01
END

IF ~~ THEN BEGIN RR#SE07
SAY @2066
=
@2067 
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#GROK~ RR#GR02
END

IF ~~ THEN BEGIN RR#SE08
SAY @2068
=
@2069
  IF ~~ THEN DO ~AddXPObject(Player1,250)~ EXTERN ~RR#VEND~ 3a
END


BEGIN ~RR#GROK~ // Grok's interjections

IF ~~ THEN BEGIN RR#GR00
  SAY @2020
=
@2021
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#BODK~ RR#BO00
END

IF ~~ THEN BEGIN RR#GR01
  SAY @2022
=
@2023
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ EXTERN ~RR#BODK~ RR#BO01
END

IF ~~ THEN BEGIN RR#GR02
SAY @2024
=
@2025 
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#BODK~ RR#BO02
END


BEGIN ~RR#BODK~ // Bodak's interjections

IF ~~ THEN BEGIN RR#BO00
  SAY @2000
=
@2001
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#KERT~ RR#KE00
END

IF ~~ THEN BEGIN RR#BO01
  SAY @2000
=
@2001
=
@2002
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ EXTERN ~RR#KERT~ RR#KE01
END

IF ~~ THEN BEGIN RR#BO02
SAY @2003
=
@2004 
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#KERT~ RR#KE02
END


BEGIN ~RR#KERT~ // Kerith's interjections

IF ~~ THEN BEGIN RR#KE00
  SAY @2040
=
@2041
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#VEND~ ~13~
END

IF ~~ THEN BEGIN RR#KE01
  SAY @2042
=
@2043
  IF ~~ THEN DO ~AddXPObject(Player1,750)~ EXTERN ~RR#VEND~ ~13a~
END

IF ~~ THEN BEGIN RR#KE02
SAY @2044
=
@2045 
  IF ~~ THEN DO ~AddXPObject(Player1,500)~ EXTERN ~RR#VEND~ ~13b~
END