/**
 * Type definitions for TBAF (TypeScript to BAF) runtime API.
 * This file is used for TypeScript validation of TBAF samples only.
 */

// Translation references
declare function $tra(ref: number): number;

// WeiDU script triggers (conditions)
declare function True(): boolean;
declare function False(): boolean;
declare function See(object: any): boolean;
// Global with 3 args is a trigger; with 2 args is a marker for switch statements (transpiler handles specially)
// Note: Using 'var' to ensure Global is treated as a value, not a type (avoids conflict with @types/node)
declare var Global: {
    (varName: string, scope: string): any;
    (varName: string, scope: string, value: number): boolean;
};
declare function InParty(who: any): boolean;
declare function StateCheck(who: any, state: any): boolean;

// WeiDU script actions
declare function Attack(target: any): void;
declare function SetGlobal(varName: string, scope: string, value: number): void;
declare function Continue(): void;
declare function NoAction(): void;
declare function Wait(ticks: number): void;
declare function GiveItemCreate(item: string, target: any, count: number, p1: number, p2: number): void;
declare function DisplayString(who: any, strref: number): void;
declare function DisplayStringHead(who: any, strref: number): void;
declare function ActionOverride(who: any, action: any): void;
declare function StartDialogNoSet(who: any): void;
declare function ActionA(): void;
declare function ActionB(): void;
declare function EscapeArea(): void;

// Objects
declare const Player1: any;
declare const Player2: any;
declare const Myself: any;
declare const STATE_SLEEPING: any;

// Functions that return objects
declare function NearestEnemyOf(who: any): any;
declare function LastTalkedToBy(who: any): any;
