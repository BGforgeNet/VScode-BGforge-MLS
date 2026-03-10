import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "error",
    // Knip can't trace enum member access (e.g. DeclarationKind.Set) as usage
    enumMembers: "off",
  },
  workspaces: {
    client: {
      entry: [
        // esbuild entry points (moved from package.json to scripts/*.sh)
        "src/extension.ts",
        "src/editors/binaryEditor-webview.ts",
        "src/dialog-tree/dialogTree-webview.ts",
        // test entry points for @vscode/test-electron
        "src/test/runTest.ts",
        "src/test/index.ts",
        "src/test/*.test.ts",
        // vitest unit tests (run via client/vitest.config.ts)
        "test/*.test.ts",
      ],
    },
    server: {
      // Entry resolved from package.json "main" field (src/server.ts).
      // No explicit entry needed here.
      // vitest.smoke.config.ts is a separate config run by scripts/test.sh, not imported
      ignore: ["**/*.d.ts", "vitest.smoke.config.ts"],
    },
    "plugins/tssl-plugin": {
      entry: ["src/index.ts", "test/*.test.ts"],
    },
    "plugins/td-plugin": {
      entry: ["src/index.ts", "test/*.test.ts"],
    },
  },
  ignore: [
    // tree-sitter grammars, not TypeScript
    "grammars/**",
    // CLI packages bundled by esbuild, import across workspace boundaries
    "cli/**",
    // external repositories cloned for testing
    "external/**",
    // Claude Code worktrees and agent data
    ".claude/**",
    // standalone update scripts run via pnpm exec tsx, not imported by main code
    "scripts/**",
  ],
  ignoreDependencies: [
    // icon font used via CSS classes in dialogTree.ts (e.g. "codicon codicon-references")
    "@vscode/codicons",
    // run via pnpm exec in client/scripts/test.sh
    "prettier",
    // used by scripts/ (pnpm exec tsx scripts/...)
    "tsx",
    // invoked in scripts/*.sh build scripts, not visible to knip
    "esbuild",
    // invoked via pnpm vsce in scripts/package.sh
    "@vscode/vsce",
  ],
};

export default config;
