/**
 * Integration tests for WeiDU BAF language features using real fixture files.
 *
 * BAF has limited features (flat IF/THEN/RESPONSE/END blocks, no user-defined constructs):
 * - Folding ranges
 * - Formatting (tested separately in format-samples)
 *
 * Uses files from external/infinity-engine/ repos.
 */

import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { initParser, isInitialized, parseWithCache } from "../../src/weidu-baf/parser";
import { createFoldingRangesProvider } from "../../src/shared/folding-ranges";
import { SyntaxType } from "../../src/weidu-baf/tree-sitter.d";
import { loadFixture, IE_FIXTURES } from "./test-helpers";

const RR_BASE = join(IE_FIXTURES, "rr");

beforeAll(async () => {
    await initParser();
});

describe("weidu-baf integration", () => {

    // =========================================================================
    // Folding Ranges
    // =========================================================================

    describe("folding ranges", () => {
        const BAF_FOLDABLE_TYPES = new Set([
            SyntaxType.Block,
            SyntaxType.Response,
        ]);
        const getFoldingRanges = createFoldingRangesProvider(isInitialized, parseWithCache, BAF_FOLDABLE_TYPES);

        it("produces folding ranges for IF/THEN blocks", () => {
            const f = loadFixture(RR_BASE, "rr/rr_core/compile/rr#stl01.baf");

            const ranges = getFoldingRanges(f.text);
            // Each IF/THEN/END block should produce a folding range
            expect(ranges.length).toBeGreaterThanOrEqual(2);
        });

        it("handles a larger BAF file with many blocks", () => {
            const f = loadFixture(RR_BASE, "rr/rr_upgr/compile/botsmith.baf");

            const ranges = getFoldingRanges(f.text);
            expect(ranges.length).toBeGreaterThanOrEqual(1);
        });
    });
});
