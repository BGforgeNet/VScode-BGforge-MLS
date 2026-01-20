/**
 * Unit tests for WeiDU TP2 completion routing based on file extension.
 * Tests that functions from .tph files are shared (headers),
 * while functions from .tpa/.tpp/.tp2 files are file-local (self).
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

// Mock the server module to avoid LSP connection issues
vi.mock("../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

// Mock isSubpath to always return true (files don't actually exist on disk for these tests)
vi.mock("../src/common", async (importOriginal) => {
    const mod = await importOriginal<typeof import("../src/common")>();
    return {
        ...mod,
        isSubpath: vi.fn(() => true),
    };
});

import { Language, Features } from "../src/data-loader";
import { LANG_WEIDU_TP2 } from "../src/core/languages";
import { pathToUri } from "../src/common";
import { initParser } from "../src/weidu-tp2/parser";
import * as path from "path";

beforeAll(async () => {
    await initParser();
});

const features: Features = {
    completion: true,
    definition: true,
    hover: true,
    udf: true,
    headers: true,
    externalHeaders: false,
    headerExtension: ".tph",
    parse: false,
    parseRequiresGame: false,
    signature: false,
    staticCompletion: false,
    staticHover: false,
    staticSignature: false,
};

describe("weidu-tp2: completion routing by file extension", () => {
    // Use src as workspace root (it exists and is real)
    // Note: For routing tests, we use actual existing file paths (weidu-tp2/*.ts)
    // but treat them as TP2 files for testing purposes
    const workspaceRoot = path.resolve(__dirname, "..", "src");

    it("routes .tph functions to headers (shared across workspace)", async () => {
        // Create a Language instance
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tph file with a function definition
        // Use an existing file (parser.ts) and change extension to .tph in URI for routing test
        const basePath = path.join(workspaceRoot, "weidu-tp2", "parser.ts");
        const tphUri = pathToUri(basePath.replace(/\.ts$/, ".tph"));
        const tphContent = `DEFINE_ACTION_FUNCTION shared_func BEGIN
    PRINT ~shared~
END`;
        lang.reloadFileData(tphUri, tphContent);

        // Get completions for a different file (.tp2)
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "provider.ts").replace(/\.ts$/, ".tp2"));
        const completions = lang.completion(tp2Uri);

        // The .tph function should appear in completions for the .tp2 file
        const sharedFunc = completions?.find((item) => item.label === "shared_func");
        expect(sharedFunc).toBeDefined();
        expect(sharedFunc?.label).toBe("shared_func");
    });

    it("routes .tpa functions to self (file-local only)", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tpa file with a function definition
        const tpaUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "symbol.ts").replace(/\.ts$/, ".tpa"));
        const tpaContent = `DEFINE_ACTION_FUNCTION local_func BEGIN
    PRINT ~local~
END`;
        lang.reloadFileData(tpaUri, tpaContent);

        // Get completions for a different file (.tp2)
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "provider.ts").replace(/\.ts$/, ".tp2"));
        const completions = lang.completion(tp2Uri);

        // The .tpa function should NOT appear in completions for the .tp2 file
        const localFunc = completions?.find((item) => item.label === "local_func");
        expect(localFunc).toBeUndefined();
    });

    it("shows .tpa functions in the same file's completions", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tpa file with a function definition
        const tpaUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "symbol.ts").replace(/\.ts$/, ".tpa"));
        const tpaContent = `DEFINE_ACTION_FUNCTION local_func BEGIN
    PRINT ~local~
END`;
        lang.reloadFileData(tpaUri, tpaContent);

        // Get completions for the SAME .tpa file
        const completions = lang.completion(tpaUri);

        // The .tpa function SHOULD appear in its own file's completions
        const localFunc = completions?.find((item) => item.label === "local_func");
        expect(localFunc).toBeDefined();
        expect(localFunc?.label).toBe("local_func");
    });

    it("routes .tpp functions to self (file-local only)", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tpp file with a function definition
        const tppUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "rename.ts").replace(/\.ts$/, ".tpp"));
        const tppContent = `DEFINE_PATCH_FUNCTION patch_func BEGIN
    READ_SHORT 0x00 value
END`;
        lang.reloadFileData(tppUri, tppContent);

        // Get completions for a different file (.tp2)
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "provider.ts").replace(/\.ts$/, ".tp2"));
        const completions = lang.completion(tp2Uri);

        // The .tpp function should NOT appear in completions for the .tp2 file
        const patchFunc = completions?.find((item) => item.label === "patch_func");
        expect(patchFunc).toBeUndefined();
    });

    it("routes .tp2 functions to self (file-local only)", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tp2 file with a function definition
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "provider.ts").replace(/\.ts$/, ".tp2"));
        const tp2Content = `DEFINE_ACTION_FUNCTION setup_func BEGIN
    PRINT ~setup~
END`;
        lang.reloadFileData(tp2Uri, tp2Content);

        // Get completions for a different .tp2 file
        const otherTp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "definition.ts").replace(/\.ts$/, ".tp2"));
        const completions = lang.completion(otherTp2Uri);

        // The .tp2 function should NOT appear in completions for the other .tp2 file
        const setupFunc = completions?.find((item) => item.label === "setup_func");
        expect(setupFunc).toBeUndefined();
    });

    it("combines .tph functions from multiple header files", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load multiple .tph files
        const tph1Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "parser.ts").replace(/\.ts$/, ".tph"));
        const tph1Content = `DEFINE_ACTION_FUNCTION func1 BEGIN
    PRINT ~func1~
END`;
        lang.reloadFileData(tph1Uri, tph1Content);

        const tph2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "header-parser.ts").replace(/\.ts$/, ".tph"));
        const tph2Content = `DEFINE_ACTION_FUNCTION func2 BEGIN
    PRINT ~func2~
END`;
        lang.reloadFileData(tph2Uri, tph2Content);

        // Get completions for a .tp2 file
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "provider.ts").replace(/\.ts$/, ".tp2"));
        const completions = lang.completion(tp2Uri);

        // Both .tph functions should appear
        const func1 = completions?.find((item) => item.label === "func1");
        const func2 = completions?.find((item) => item.label === "func2");
        expect(func1).toBeDefined();
        expect(func2).toBeDefined();
    });

    it("keeps .tph and .tpa functions separate in routing", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tph file (shared)
        const tphUri = pathToUri(path.join(workspaceRoot, "shared", "completion.ts").replace(/\.ts$/, ".tph"));
        const tphContent = `DEFINE_ACTION_FUNCTION shared_func BEGIN
    PRINT ~shared~
END`;
        lang.reloadFileData(tphUri, tphContent);

        // Load a .tpa file (file-local)
        const tpaUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "completion-context.ts").replace(/\.ts$/, ".tpa"));
        const tpaContent = `DEFINE_ACTION_FUNCTION local_func BEGIN
    PRINT ~local~
END`;
        lang.reloadFileData(tpaUri, tpaContent);

        // Get completions for a third file (.tp2)
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "provider.ts").replace(/\.ts$/, ".tp2"));
        const completions = lang.completion(tp2Uri);

        // Only the .tph function should appear, not the .tpa function
        const sharedFunc = completions?.find((item) => item.label === "shared_func");
        const localFunc = completions?.find((item) => item.label === "local_func");
        expect(sharedFunc).toBeDefined();
        expect(localFunc).toBeUndefined();

        // But the .tpa file should see its own function
        const tpaCompletions = lang.completion(tpaUri);
        const tpaLocalFunc = tpaCompletions?.find((item) => item.label === "local_func");
        expect(tpaLocalFunc).toBeDefined();
    });

    it("clears .tph functions from headers when file is deleted", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tph file
        const tphUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "parser.ts").replace(/\.ts$/, ".tph"));
        const tphContent = `DEFINE_ACTION_FUNCTION shared_func BEGIN
    PRINT ~shared~
END`;
        lang.reloadFileData(tphUri, tphContent);

        // Verify it appears in completions
        const tp2Uri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "provider.ts").replace(/\.ts$/, ".tp2"));
        let completions = lang.completion(tp2Uri);
        let sharedFunc = completions?.find((item) => item.label === "shared_func");
        expect(sharedFunc).toBeDefined();

        // Delete the file
        lang.clearFileData(tphUri);

        // Verify it no longer appears in completions
        completions = lang.completion(tp2Uri);
        sharedFunc = completions?.find((item) => item.label === "shared_func");
        expect(sharedFunc).toBeUndefined();
    });

    it("clears .tpa functions from self when file is deleted", async () => {
        // Create a Language instance
        // Uses workspaceRoot from outer scope
        const lang = new Language(LANG_WEIDU_TP2, features, workspaceRoot);
        await lang.init();

        // Load a .tpa file
        const tpaUri = pathToUri(path.join(workspaceRoot, "weidu-tp2", "symbol.ts").replace(/\.ts$/, ".tpa"));
        const tpaContent = `DEFINE_ACTION_FUNCTION local_func BEGIN
    PRINT ~local~
END`;
        lang.reloadFileData(tpaUri, tpaContent);

        // Verify it appears in its own completions
        let completions = lang.completion(tpaUri);
        let localFunc = completions?.find((item) => item.label === "local_func");
        expect(localFunc).toBeDefined();

        // Delete the file
        lang.clearFileData(tpaUri);

        // Verify it no longer appears in its own completions
        completions = lang.completion(tpaUri);
        localFunc = completions?.find((item) => item.label === "local_func");
        expect(localFunc).toBeUndefined();
    });
});
