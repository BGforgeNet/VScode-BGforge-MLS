/**
 * Integration tests for ids-to-yaml CLI: exercises the full file I/O path.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import YAML from "yaml";

const TMP_BASE = "tmp";
beforeAll(() => fs.mkdirSync(TMP_BASE, { recursive: true }));

describe("ids-to-yaml CLI", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(TMP_BASE, ".ids-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("converts IDS file to YAML", () => {
        const inputFile = path.join(tmpDir, "input.ids");
        const outputFile = path.join(tmpDir, "output.yml");
        fs.writeFileSync(inputFile, "0 None\n1 Fighter\n2 Mage\n", "utf8");

        execSync(`pnpm exec tsx scripts/utils/src/ids-to-yaml.ts "${inputFile}" "class.ids" "${outputFile}"`, {
            cwd: process.cwd(),
        });

        const result = YAML.parse(fs.readFileSync(outputFile, "utf8"));
        expect(result).toHaveLength(3);
        expect(result[0].name).toBe("None");
        expect(result[0].detail).toBe("0");
        expect(result[0].doc).toBe("class.ids");
    });
});
