/**
 * Tests for IESDP action processing functions.
 */

import { describe, expect, it } from "vitest";
import {
    actionAliasDesc,
    actionDesc,
    actionDescAbsoluteUrls,
    actionDetail,
    appendUnique,
} from "../src/ie/actions.js";
import type { ActionItem, IESDPGame } from "../src/ie/types.js";

const GAMES: IESDPGame[] = [
    { name: "bg2", ids: "/files/ids/bg2", "2da": "/files/2da/bg2", actions: "/scripting/actions/bg2" },
    { name: "bgee", ids: "/files/ids/bgee", "2da": "/files/2da/bgee", actions: "/scripting/actions/bgee" },
];
const BASE_URL = "https://gibberlings3.github.io/iesdp/";

describe("actionAliasDesc", () => {
    const actions: ActionItem[] = [
        { n: 1, name: "ActionA", desc: "Description A", bg2: 1 },
        { n: 2, name: "ActionB", alias: 1, bg2: 1 },
        { n: 3, name: "ActionC", desc: "Description C", bg2: 1 },
        { n: 3, name: "ActionC_Alias", alias: true, bg2: 1 },
        { n: 4, name: "ActionD", unknown: true, bg2: 1, desc: "Unknown" },
        { n: 5, name: "ActionE", alias: 4, bg2: 1 },
    ];

    it("resolves alias by number", () => {
        expect(actionAliasDesc(actions, actions[1]!)).toBe("Description A");
    });

    it("resolves alias=true using own n to find parent", () => {
        // alias=true means use own n to find parent with same n and no alias
        expect(actionAliasDesc(actions, actions[3]!)).toBe("Description C");
    });

    it("returns false for unknown parent", () => {
        expect(actionAliasDesc(actions, actions[5]!)).toBe(false);
    });
});

describe("actionDescAbsoluteUrls", () => {
    it("replaces template variables", () => {
        const desc = "See [ids]({{ ids }}/ea.htm) and [2da]({{ 2da }}/xpbonus.2da)";
        const result = actionDescAbsoluteUrls(desc, GAMES, "bg2", BASE_URL);
        expect(result).toContain("files/ids/bg2/ea.htm");
        expect(result).toContain("files/2da/bg2/xpbonus.2da");
    });

    it("resolves relative URLs to absolute", () => {
        const desc = "See [link](./foo.htm)";
        const result = actionDescAbsoluteUrls(desc, GAMES, "bg2", BASE_URL);
        expect(result).toContain("https://gibberlings3.github.io/iesdp/scripting/actions/foo.htm");
    });

    it("throws for unknown game", () => {
        expect(() => actionDescAbsoluteUrls("test", GAMES, "nonexistent", BASE_URL)).toThrow(
            "Game not found"
        );
    });
});

describe("actionDesc", () => {
    const actions: ActionItem[] = [
        { n: 1, name: "ActionA", desc: "Simple desc", bg2: 1 },
        { n: 2, name: "AliasAction", alias: 1, bg2: 1 },
    ];

    it("returns description for non-alias action", () => {
        const result = actionDesc(actions, actions[0]!, GAMES, BASE_URL);
        expect(result).toBe("Simple desc");
    });

    it("resolves alias description", () => {
        const result = actionDesc(actions, actions[1]!, GAMES, BASE_URL);
        expect(result).toBe("Simple desc");
    });
});

describe("appendUnique", () => {
    const existing: ActionItem[] = [
        { n: 1, name: "ActionA", bg2: 1 },
    ];

    it("appends new unique actions", () => {
        const newActions: ActionItem[] = [{ n: 2, name: "ActionB", bg2: 1 }];
        const result = appendUnique(existing, newActions);
        expect(result).toHaveLength(2);
        expect(result[1]!.name).toBe("ActionB");
    });

    it("skips duplicate names", () => {
        const newActions: ActionItem[] = [{ n: 1, name: "ActionA", bg2: 1 }];
        const result = appendUnique(existing, newActions);
        expect(result).toHaveLength(1);
    });

    it("does not mutate original array", () => {
        const newActions: ActionItem[] = [{ n: 2, name: "ActionB", bg2: 1 }];
        appendUnique(existing, newActions);
        expect(existing).toHaveLength(1);
    });
});

describe("actionDetail", () => {
    it("formats action without params", () => {
        const action: ActionItem = { n: 1, name: "NoParamAction", bg2: 1 };
        expect(actionDetail(action)).toBe("NoParamAction()");
    });

    it("formats action with params", () => {
        const action: ActionItem = {
            n: 1,
            name: "ActionWithParams",
            bg2: 1,
            params: [
                { type: "i", name: "Target" },
                { type: "s", name: "ResRef" },
            ],
        };
        expect(actionDetail(action)).toBe("ActionWithParams(I:Target, S:ResRef)");
    });

    it("includes IDS reference", () => {
        const action: ActionItem = {
            n: 1,
            name: "TestAction",
            bg2: 1,
            params: [{ type: "o", name: "Object", ids: "OBJECT" }],
        };
        expect(actionDetail(action)).toBe("TestAction(O:Object*Object)");
    });
});
