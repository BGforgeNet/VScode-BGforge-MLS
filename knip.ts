import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "off",
  },
  workspaces: {
    client: {
      entry: [
        // bundled by esbuild-base-webviews in package.json
        "src/dialog-tree/dialogTree-webview.ts",
        // test entry points for @vscode/test-electron
        "src/test/runTest.ts",
        "src/test/index.ts",
        "src/test/*.test.ts",
      ],
      ignore: ["out/**"],
    },
    server: {
      entry: [
        "src/server.ts",
      ],
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
  ],
  ignoreDependencies: [
    // loaded at runtime via path.join in server/src/sslc/ssl_compiler.ts
    "sslc-emscripten-noderawfs",
    // icon font used via CSS classes in dialogTree.ts (e.g. "codicon codicon-references")
    "@vscode/codicons",
    // run via pnpm exec in client/scripts/test.sh
    "prettier",
  ],
  // esbuild uses glob patterns that knip can't resolve as imports
  ignoreUnresolved: [/\.\/client\/src\/test\/\*\.ts/],
};

export default config;
