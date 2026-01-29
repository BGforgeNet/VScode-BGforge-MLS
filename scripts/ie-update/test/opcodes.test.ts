/**
 * Tests for opcode name normalization.
 */

import { describe, expect, it } from "vitest";
import { opcodeNameToId } from "../src/ie/opcodes.js";

describe("opcodeNameToId", () => {
    it("converts spaces and special chars to underscores", () => {
        expect(opcodeNameToId("Cure Sleep")).toBe("cure_sleep");
    });

    it("strips parentheses", () => {
        expect(opcodeNameToId("Cure (Sleep)")).toBe("cure_sleep");
    });

    it("removes colons, commas, ampersands, periods, apostrophes", () => {
        expect(opcodeNameToId("AC: Slash & Piercing")).toBe("ac_slash_piercing");
    });

    it("replaces hyphens and slashes with underscores", () => {
        expect(opcodeNameToId("Magic-Fire Damage/Resist")).toBe("magic_fire_damage_resist");
    });

    it("applies word replacements (modifier->mod, resistance->resist)", () => {
        expect(opcodeNameToId("Damage Modifier")).toBe("damage_mod");
        expect(opcodeNameToId("Fire Resistance")).toBe("fire_resist");
    });

    it("applies removal_remove -> remove", () => {
        expect(opcodeNameToId("Removal Remove Curse")).toBe("remove_curse");
    });

    it("applies high_level_ability -> HLA", () => {
        expect(opcodeNameToId("High Level Ability")).toBe("HLA");
    });

    it("deduplicates underscores", () => {
        expect(opcodeNameToId("A  B")).toBe("a_b");
    });

    it("strips left-side prefixes", () => {
        expect(opcodeNameToId("Item Curse")).toBe("curse");
        expect(opcodeNameToId("Graphics Translucency")).toBe("translucency");
        expect(opcodeNameToId("Spell Effect Immunity")).toBe("immunity");
        expect(opcodeNameToId("Spell Duration Modifier")).toBe("duration_mod");
        expect(opcodeNameToId("Stat Strength")).toBe("strength");
        expect(opcodeNameToId("State Sleep")).toBe("sleep");
        expect(opcodeNameToId("Summon Creature")).toBe("creature");
    });

    it("strips leading/trailing underscores", () => {
        expect(opcodeNameToId("_test_")).toBe("test");
    });

    it("returns known skip names unchanged", () => {
        expect(opcodeNameToId("empty")).toBe("empty");
        expect(opcodeNameToId("crash")).toBe("crash");
        expect(opcodeNameToId("unknown")).toBe("unknown");
    });
});
