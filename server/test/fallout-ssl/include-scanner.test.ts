/**
 * Unit tests for fallout-ssl/include-scanner.ts -- AST-based include extraction.
 */

import { describe, expect, it, beforeAll } from "vitest";

import { extractIncludes } from "../../src/fallout-ssl/include-scanner";
import { initParser, parseWithCache } from "../../src/fallout-ssl/parser";

beforeAll(async () => {
    await initParser();
});

/** Parse SSL text and extract includes. */
function getIncludes(text: string): readonly string[] {
    const tree = parseWithCache(text);
    if (!tree) return [];
    return extractIncludes(tree.rootNode);
}

describe("fallout-ssl/include-scanner", () => {
    it("extracts quoted includes", () => {
        const text = '#include "headers/sfall.h"\n\nprocedure start begin end';
        const includes = getIncludes(text);

        expect(includes).toContain("headers/sfall.h");
    });

    it("extracts angle bracket includes", () => {
        const text = '#include <sfall.h>\n\nprocedure start begin end';
        const includes = getIncludes(text);

        expect(includes).toContain("sfall.h");
    });

    it("extracts multiple includes", () => {
        const text = `
#include "headers/sfall.h"
#include "headers/define.h"
#include <stdlib.h>

procedure start begin end
`;
        const includes = getIncludes(text);

        expect(includes).toHaveLength(3);
        expect(includes).toContain("headers/sfall.h");
        expect(includes).toContain("headers/define.h");
        expect(includes).toContain("stdlib.h");
    });

    it("returns empty for file with no includes", () => {
        const text = "procedure start begin end";
        const includes = getIncludes(text);

        expect(includes).toEqual([]);
    });

    it("extracts includes inside ifdef blocks", () => {
        const text = `
#ifdef SFALL
#include "sfall.h"
#endif

procedure start begin end
`;
        const includes = getIncludes(text);

        expect(includes).toContain("sfall.h");
    });

    it("extracts includes from both ifdef and ifndef blocks", () => {
        const text = `
#ifndef GUARD_H
#include "base.h"
#endif

#ifdef FEATURE_X
#include "feature_x.h"
#endif

procedure start begin end
`;
        const includes = getIncludes(text);

        expect(includes).toContain("base.h");
        expect(includes).toContain("feature_x.h");
    });
});
