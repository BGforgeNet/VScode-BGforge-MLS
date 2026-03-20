import { describe, expect, it } from "vitest";

import { getServerCapabilities } from "../src/server-capabilities";

describe("server-capabilities", () => {
    it("advertises full semantic tokens with the shared legend", () => {
        const capabilities = getServerCapabilities();

        expect(capabilities.semanticTokensProvider).toEqual({
            legend: {
                tokenTypes: ["parameter", "variable"],
                tokenModifiers: [],
            },
            full: true,
        });
    });
});
