/**
 * Tests for header-defined symbol hover in Fallout SSL.
 * Verifies that parseHeaderToSymbols and unified storage work correctly.
 */

import { describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import { MarkupKind } from "vscode-languageserver/node";

// Mock LSP connection before importing modules that use it
vi.mock("../../src/common", () => ({
    conlog: vi.fn(),
    findFiles: vi.fn(() => []),
}));

import { parseHeaderToSymbols } from "../../src/fallout-ssl/header-parser";
import { initParser } from "../../src/fallout-ssl/parser";
import { falloutSslProvider } from "../../src/fallout-ssl/provider";
import type { ProviderContext } from "../../src/language-provider";
import type { MLSsettings } from "../../src/settings";

describe("fallout-ssl header symbol hover", () => {
    const testUri = "file:///mymod/headers/define.h";
    const workspaceRoot = "/mymod";

    beforeAll(async () => {
        await initParser();
    });

    beforeEach(async () => {
        // Initialize provider fresh for each test
        const mockContext: ProviderContext = {
            workspaceRoot,
            settings: {} as MLSsettings,
        };
        await falloutSslProvider.init(mockContext);
    });

    it("should parse header-defined constant macros", () => {
        const headerText = `
#define CURSOR_TARGETING    (2)
#define MAX_HEALTH          100
`;
        const symbols = parseHeaderToSymbols(testUri, headerText, workspaceRoot);

        // Find CURSOR_TARGETING symbol
        const cursorSymbol = symbols.find(s => s.name === "CURSOR_TARGETING");
        expect(cursorSymbol).toBeDefined();
        expect(cursorSymbol?.hover.contents).toHaveProperty("kind", MarkupKind.Markdown);

        // Constant macros show just the value, not "NAME = value"
        const hoverValue = (cursorSymbol?.hover?.contents as { value: string }).value;
        expect(hoverValue).toContain("(2)");
        expect(hoverValue).toContain("headers/define.h");
    });

    it("should parse header-defined function-like macros", () => {
        const headerText = `
#define get_msg(x) message_str(SCRIPT_SELF, x)
`;
        const symbols = parseHeaderToSymbols(testUri, headerText, workspaceRoot);

        const getMsgSymbol = symbols.find(s => s.name === "get_msg");
        expect(getMsgSymbol).toBeDefined();
        const hoverValue = (getMsgSymbol?.hover?.contents as { value: string }).value;
        expect(hoverValue).toContain("get_msg");
        expect(hoverValue).toContain("x");
    });

    it("resolveSymbol should return IndexedSymbol for header macros", async () => {
        const headerText = `
#define CURSOR_TARGETING    (2)
`;
        // Load header into unified storage via reloadFileData
        falloutSslProvider.reloadFileData!(testUri, headerText);

        // Test resolveSymbol
        const sslText = `
procedure test begin
    set_cursor_mode(CURSOR_TARGETING);
end
`;
        const sslUri = "file:///mymod/scripts/test.ssl";

        const resolved = falloutSslProvider.resolveSymbol!("CURSOR_TARGETING", sslText, sslUri);

        expect(resolved).toBeDefined();
        expect(resolved?.hover).toBeDefined();
        expect(resolved?.name).toBe("CURSOR_TARGETING");
    });

    it("resolveSymbol should include file path in hover for header symbols", async () => {
        const headerText = `
#define MY_CONSTANT    42
`;
        falloutSslProvider.reloadFileData!(testUri, headerText);

        const sslText = `variable x := MY_CONSTANT;`;
        const sslUri = "file:///mymod/scripts/test.ssl";

        const resolved = falloutSslProvider.resolveSymbol!("MY_CONSTANT", sslText, sslUri);

        expect(resolved).toBeDefined();
        const hoverValue = (resolved?.hover?.contents as { value: string })?.value;
        // Header symbols SHOULD show file path (unlike local symbols)
        expect(hoverValue).toContain("headers/define.h");
    });

    it("resolveSymbol should show relative path, not absolute realpath", async () => {
        const headerUri = "file:///home/user/mymod/headers/define.h";
        const headerText = `
#define TEST_CONST    123
`;
        // Re-init with different workspace root
        const mockContext: ProviderContext = {
            workspaceRoot: "/home/user/mymod",
            settings: {} as MLSsettings,
        };
        await falloutSslProvider.init(mockContext);

        falloutSslProvider.reloadFileData!(headerUri, headerText);

        const sslText = `variable x := TEST_CONST;`;
        const sslUri = "file:///home/user/mymod/scripts/test.ssl";

        const resolved = falloutSslProvider.resolveSymbol!("TEST_CONST", sslText, sslUri);

        expect(resolved).toBeDefined();

        // Check displayPath in source
        expect(resolved?.source.displayPath).toBe("headers/define.h");

        // Check hover doesn't contain absolute path
        const hoverValue = (resolved?.hover?.contents as { value: string })?.value;
        expect(hoverValue).not.toContain("/home/user");
        expect(hoverValue).toContain("headers/define.h");
    });

    it("reloadFileData should use relative path for headers", async () => {
        const mockContext: ProviderContext = {
            workspaceRoot: "/home/user/mymod",
            settings: {} as MLSsettings,
        };

        await falloutSslProvider.init(mockContext);

        // Simulate reloadFileData being called with absolute URI
        const headerUri = "file:///home/user/mymod/headers/test.h";
        const headerText = `
#define RELOAD_TEST    999
`;
        falloutSslProvider.reloadFileData!(headerUri, headerText);

        // Now check the symbol
        const sslText = `variable x := RELOAD_TEST;`;
        const sslUri = "file:///home/user/mymod/scripts/test.ssl";

        const resolved = falloutSslProvider.resolveSymbol!("RELOAD_TEST", sslText, sslUri);

        expect(resolved).toBeDefined();

        // The displayPath should be relative to workspace, not absolute
        expect(resolved?.source.displayPath).toBe("headers/test.h");

        // Hover should show relative path
        const hoverValue = (resolved?.hover?.contents as { value: string })?.value;
        expect(hoverValue).not.toContain("/home/user/mymod");
        expect(hoverValue).toContain("headers/test.h");
    });

    describe("getSymbolDefinition for header macros", () => {
        it("returns location for function-like macro from header", () => {
            const headerText = `#define floater(x) float_msg(self_obj, message_str(NAME,x), FLOAT_COLOR_NORMAL)`;
            falloutSslProvider.reloadFileData!(testUri, headerText);

            const location = falloutSslProvider.getSymbolDefinition!("floater");
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(testUri);
            expect(location!.range.start.line).toBe(0);
        });

        it("returns location for constant macro from header", () => {
            const headerText = `#define MAX_HP 100`;
            falloutSslProvider.reloadFileData!(testUri, headerText);

            const location = falloutSslProvider.getSymbolDefinition!("MAX_HP");
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(testUri);
        });

        it("returns location for macro defined after blank lines", () => {
            const headerText = `
#define floater(x) float_msg(self_obj, message_str(NAME,x), FLOAT_COLOR_NORMAL)
`;
            falloutSslProvider.reloadFileData!(testUri, headerText);

            const location = falloutSslProvider.getSymbolDefinition!("floater");
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(testUri);
            expect(location!.range.start.line).toBe(1);
        });

        it("returns location for indented #define inside #ifndef guard", () => {
            const headerText = `#ifndef floater
   #define floater(x)           float_msg(self_obj, message_str(NAME,x), FLOAT_COLOR_NORMAL)
#endif`;
            falloutSslProvider.reloadFileData!(testUri, headerText);

            const location = falloutSslProvider.getSymbolDefinition!("floater");
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(testUri);
            expect(location!.range.start.line).toBe(1);
        });

        it("returns location for indented procedure", () => {
            const headerText = `#ifdef SOME_FLAG
   procedure guarded_proc begin end
#endif`;
            falloutSslProvider.reloadFileData!(testUri, headerText);

            const location = falloutSslProvider.getSymbolDefinition!("guarded_proc");
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(testUri);
            expect(location!.range.start.line).toBe(1);
        });

        it("returns location for procedure from header", () => {
            const headerText = `procedure my_helper begin end`;
            falloutSslProvider.reloadFileData!(testUri, headerText);

            const location = falloutSslProvider.getSymbolDefinition!("my_helper");
            expect(location).not.toBeNull();
            expect(location!.uri).toBe(testUri);
        });
    });

    it("getCompletions should return duplicates from multiple headers", async () => {
        const mockContext: ProviderContext = {
            workspaceRoot: "/mymod",
            settings: {} as MLSsettings,
        };
        await falloutSslProvider.init(mockContext);

        // Two headers define the same constant
        const headerA = "file:///mymod/headers/a.h";
        const headerB = "file:///mymod/headers/b.h";

        falloutSslProvider.reloadFileData!(headerA, "#define PIPBOY (0x400)");
        falloutSslProvider.reloadFileData!(headerB, "#define PIPBOY (0x400)");

        // getCompletions should return BOTH symbols
        const completions = falloutSslProvider.getCompletions!("file:///mymod/scripts/test.ssl");
        const pipboyCompletions = completions.filter(c => c.label === "PIPBOY");

        // Both duplicates should be present
        expect(pipboyCompletions).toHaveLength(2);

        // Each should have different labelDetails.description showing source path
        const descriptions = pipboyCompletions.map(c => c.labelDetails?.description);
        expect(descriptions).toContain("headers/a.h");
        expect(descriptions).toContain("headers/b.h");
    });
});
