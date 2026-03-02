import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "off",
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
        "src/ts-plugin.ts",
        "src/td-plugin.ts",
        // test entry points for @vscode/test-electron
        "src/test/runTest.ts",
        "src/test/index.ts",
        "src/test/*.test.ts",
        // vitest unit tests (run via client/vitest.config.ts)
        "test/*.test.ts",
      ],
      ignore: ["out/**"],
    },
    server: {
      // Entry resolved from package.json "main" field (src/server.ts).
      // No explicit entry needed here.
      ignore: ["out/**", "**/*.d.ts"],
    },
  },
  ignore: [
    "**/out/**",
    "**/node_modules/**",
    // tree-sitter grammars, not TypeScript
    "grammars/**",
    // separate Cytoscape preview bundle
    "preview/**",
    // CLI packages bundled by esbuild, import across workspace boundaries
    "cli/**",
    // external repositories cloned for testing
    "external/**",
    // standalone update scripts run via pnpm exec tsx, not imported by main code
    "scripts/**",
  ],
  ignoreDependencies: [
    // loaded at runtime via path.join in server/src/sslc/ssl_compiler.ts
    "sslc-emscripten-noderawfs",
    // icon font used via CSS classes in dialogTree.ts (e.g. "codicon codicon-references")
    "@vscode/codicons",
    // run via pnpm exec in client/scripts/test.sh
    "prettier",
    // used by scripts/ (pnpm exec tsx scripts/...)
    "tsx",
    // invoked in scripts/*.sh build scripts, not visible to knip
    "esbuild",
  ],
};

export default config;
