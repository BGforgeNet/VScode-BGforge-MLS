/**
 * Type definitions for TD (TypeScript to D) runtime API.
 * This file is used for TypeScript validation of TD samples only.
 */

// Text references
declare function tra(ref: number): string;

// Dialog state functions
declare function say(text: string): void;
declare function say(dialog: string, text: string): void; // For CHAIN/INTERJECT contexts
declare function reply(text: string): void;
declare function goto(target: string | Function): void;
declare function exit(): void;
declare function extern(dialog: string, state: string): void;
declare function action(...actions: any[]): void;
declare function flags(value: number): void;

// Journal
declare function journal(text: string): void;
declare function solvedJournal(text: string): void;
declare function unsolvedJournal(text: string): void;

// Dialog structure
declare function begin(dialog: string, states: (Function | string)[]): any;
declare function append(dialog: string, states: Function[]): void;
declare function extendTop(dialog: string, state: string | Function, callback: () => void): void;
declare function extendBottom(dialog: string, state: string | Function, callback: () => void): void;
declare function extendBottom(dialog: string, state: string | Function, options: any, callback: () => void): void;
declare function chain(callback: Function): void;
declare function chain(entryTrigger: boolean, callback: Function): void; // With entry trigger
declare function interject(entryDialog: string, entryState: string, globalVar: string, callback: Function, exitDialog?: string, exitState?: string): void;
declare function interjectCopyTrans(entryDialog: string, entryState: string, globalVar: string, callback: Function, exitDialog?: string, exitState?: string): void;

// Modify existing
declare function alterTrans(dialog: string, states: (string | number)[], trans: number[], options: any): void;
declare function addStateTrigger(dialog: string, state: string | number | (string | number)[], trigger: any): void;
declare function addTransTrigger(dialog: string, states: (string | number)[], trigger: any, options?: { trans?: number[] }): void;
declare function addTransAction(dialog: string, states: (string | number)[], trans: number[], action: any): void;
declare function replaceTransTrigger(dialog: string, states: (string | number)[], trans: number[], from: string, to: string): void;
declare function replaceTransAction(dialog: string, states: (string | number)[], trans: number[], from: string, to: string): void;
declare function replaceTriggerText(dialog: string | string[], from: string, to: string): void;
declare function replaceActionText(dialogs: string[], from: string, to: string): void;
declare function setWeight(dialog: string, state: string | number, weight: number): void;
declare function replaceSay(dialog: string, state: string | number, text: string): void;
declare function replaceStateTrigger(dialog: string, states: (string | number)[], trigger: any): void;

// WeiDU script functions (as values, not types)
declare function Global(varName: string, scope: string, value: number): boolean;
declare function SetGlobal(varName: string, scope: string, value: number): void;
declare function InParty(name: string): boolean;
declare function InPartySlot(who: any, slot: number): boolean;
declare function See(name: string): boolean;
declare function StateCheck(who: string, state: any): boolean;
declare function NumTimesTalkedTo(count: number): boolean;
declare function SetNumTimesTalkedTo(count: number): void;
declare const LastTalkedToBy: any; // Object, not a function
declare function PartyHasItem(item: string): boolean;
declare function IsValidForPartyDialog(who: any): boolean;
declare function IsValidForPartyDialogue(who: any): boolean;
declare function ApplySpellRES(spell: string, target: any): void;
declare function GiveItemCreate(item: string, target: string, count: number, p1: number, p2: number): void;
declare function AddexperienceParty(xp: number): void;
declare function Enemy(): void;
declare function DestroyItem(item: string): void;
declare function TakePartyItem(item: string): void;
declare function ForceSpell(target: any, spell: any): void;
declare function EscapeArea(): void;
declare function False(): boolean;
declare const Myself: any;
declare const DRYAD_TELEPORT: any;
declare const STATE_SLEEPING: any;
