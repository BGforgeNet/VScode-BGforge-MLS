/**
 * Verify that all runtime file references are whitelisted in .vscodeignore.
 * Catches missing files that would cause ENOENT / MODULE_NOT_FOUND at runtime.
 *
 * Checks:
 * 1. esbuild --external deps in VSIX build scripts must be in .vscodeignore
 * 2. Runtime file loads in source (path.join, joinPath) must be in .vscodeignore
 * 3. Every .vscodeignore whitelist pattern must match at least one existing file
 * 4. __dirname-relative node_modules paths in source must be in .vscodeignore
 * 5. package.json contributes file paths must be in .vscodeignore
 */

import { readFileSync, readdirSync, globSync } from "fs";
import { join, resolve } from "path";
import picomatch from "picomatch";

const ROOT = resolve(__dirname, "..");
const VSCODEIGNORE = join(ROOT, ".vscodeignore");

// Externals provided by VSCode runtime (don't need to be in VSIX)
const RUNTIME_EXTERNALS = new Set(["vscode"]);

// Build scripts that produce VSIX artifacts
const VSIX_BUILD_SCRIPTS = [
    "scripts/build-base-server.sh",
    "scripts/build-base-client.sh",
    "scripts/build-ts-plugin.sh",
    "scripts/build-td-plugin.sh",
    "scripts/build-base-webviews.sh",
];

// Source directories to scan for runtime file references
const SOURCE_DIRS = ["client/src", "server/src"];

const errors: string[] = [];

/** Check if a file path matches any .vscodeignore whitelist pattern */
function matchesWhitelist(filePath: string, whitelist: string[]): boolean {
    return whitelist.some((pattern) => picomatch.isMatch(filePath, pattern));
}

function loadVscodeignore(): { whitelist: string[]; raw: string } {
    const raw = readFileSync(VSCODEIGNORE, "utf8");
    const whitelist = raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("!"))
        .map((line) => line.slice(1));
    return { whitelist, raw };
}

/** Check 1: every esbuild --external in VSIX build scripts is in .vscodeignore */
function checkExternals(vscodeignoreRaw: string): void {
    for (const script of VSIX_BUILD_SCRIPTS) {
        const content = readFileSync(join(ROOT, script), "utf8");
        const externalPattern = /--external:['"]?([^\s'"]+)['"]?/g;
        let match: RegExpExecArray | null;
        while ((match = externalPattern.exec(content)) !== null) {
            const ext = match[1];
            if (RUNTIME_EXTERNALS.has(ext)) continue;
            if (!vscodeignoreRaw.includes(`node_modules/${ext}`)) {
                errors.push(
                    `${script} externalizes '${ext}' but .vscodeignore has no node_modules/${ext} entry`,
                );
            }
        }
    }
}

/** Recursively collect all .ts files in a directory */
function collectTsFiles(dir: string): string[] {
    const results: string[] = [];
    const absDir = join(ROOT, dir);
    try {
        for (const entry of readdirSync(absDir, { withFileTypes: true })) {
            const fullPath = join(absDir, entry.name);
            if (entry.isDirectory()) {
                results.push(...collectTsFiles(join(dir, entry.name)));
            } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
                results.push(fullPath);
            }
        }
    } catch {
        // Directory doesn't exist, skip
    }
    return results;
}

/**
 * Check 2: runtime file references in source match .vscodeignore whitelist.
 * Detects path.join / Uri.joinPath calls with string segments like:
 *   path.join(extensionPath, "client", "src", "dialog-tree", "dialogTree.html")
 *   Uri.joinPath(context.extensionUri, "client", "out", "codicons", "codicon.css")
 */
function checkRuntimePaths(whitelist: string[]): void {
    // Match: "client" or "server" or "node_modules" followed by comma-separated quoted strings
    const pathPattern = /"(client|server|node_modules)"(\s*,\s*"[^"]*")+/g;

    const runtimePaths = new Set<string>();

    for (const dir of SOURCE_DIRS) {
        for (const file of collectTsFiles(dir)) {
            const content = readFileSync(file, "utf8");
            let match: RegExpExecArray | null;
            while ((match = pathPattern.exec(content)) !== null) {
                // Convert "client","src","dialog-tree","dialogTree.html" to client/src/dialog-tree/dialogTree.html
                const segments = match[0].replace(/"\s*,\s*"/g, "/").replace(/"/g, "");
                runtimePaths.add(segments);
            }
        }
    }

    for (const runtimePath of runtimePaths) {
        if (!matchesWhitelist(runtimePath, whitelist)) {
            errors.push(
                `Source references '${runtimePath}' at runtime but .vscodeignore has no matching whitelist entry`,
            );
        }
    }
}

/**
 * Check 3: every .vscodeignore whitelist pattern matches at least one existing file.
 * Requires a prior build — patterns like client/out/* only exist after build:client.
 * In test.sh this runs after build steps, so this is fine for CI.
 */
function checkPatternsResolve(whitelist: string[]): void {
    for (const pattern of whitelist) {
        // Skip node_modules patterns (deps may not exist until build/install)
        if (pattern.includes("node_modules")) continue;

        const matches = globSync(join(ROOT, pattern));
        if (matches.length === 0) {
            errors.push(`.vscodeignore whitelists '${pattern}' but no matching files exist`);
        }
    }
}

/**
 * Check 4: __dirname-relative node_modules paths in source must be in .vscodeignore.
 * Detects patterns like:
 *   path.join(__dirname, "../node_modules/sslc-emscripten-noderawfs/compiler.mjs")
 * These are runtime deps loaded via fork() or require() that won't be caught by
 * esbuild --external scanning.
 */
function checkDirnameNodeModules(vscodeignoreRaw: string): void {
    // Match __dirname followed by a string containing node_modules/package-name
    const dirnamePattern = /__dirname\s*,\s*"[^"]*node_modules\/([^/"]+)/g;

    for (const dir of SOURCE_DIRS) {
        for (const file of collectTsFiles(dir)) {
            const content = readFileSync(file, "utf8");
            let match: RegExpExecArray | null;
            while ((match = dirnamePattern.exec(content)) !== null) {
                const pkg = match[1];
                if (RUNTIME_EXTERNALS.has(pkg)) continue;
                if (!vscodeignoreRaw.includes(`node_modules/${pkg}`)) {
                    const relFile = file.replace(ROOT + "/", "");
                    errors.push(
                        `${relFile} loads '${pkg}' via __dirname at runtime but .vscodeignore has no node_modules/${pkg} entry`,
                    );
                }
            }
        }
    }
}

/**
 * Check 5: package.json contributes file paths must be in .vscodeignore.
 * Scans contributes.languages[].configuration, contributes.grammars[].path,
 * contributes.snippets[].path, contributes.themes[].path,
 * contributes.iconThemes[].path, and the root "main" and "icon" fields.
 */
function checkPackageJsonContributes(whitelist: string[]): void {
    const pkgPath = join(ROOT, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    const contributePaths: string[] = [];

    // Root-level fields
    if (pkg.main) {
        // "main" can omit .js extension; vsce resolves both
        const main = pkg.main.replace(/^\.\//, "");
        contributePaths.push(main.endsWith(".js") ? main : `${main}.js`);
    }
    if (pkg.icon) {
        contributePaths.push(pkg.icon.replace(/^\.\//, ""));
    }

    const contributes = pkg.contributes ?? {};

    // languages[].configuration
    for (const lang of contributes.languages ?? []) {
        if (lang.configuration) {
            contributePaths.push(lang.configuration.replace(/^\.\//, ""));
        }
    }

    // grammars[].path
    for (const grammar of contributes.grammars ?? []) {
        if (grammar.path) {
            contributePaths.push(grammar.path.replace(/^\.\//, ""));
        }
    }

    // snippets[].path
    for (const snippet of contributes.snippets ?? []) {
        if (snippet.path) {
            contributePaths.push(snippet.path.replace(/^\.\//, ""));
        }
    }

    // themes[].path
    for (const theme of contributes.themes ?? []) {
        if (theme.path) {
            contributePaths.push(theme.path.replace(/^\.\//, ""));
        }
    }

    // iconThemes[].path
    for (const iconTheme of contributes.iconThemes ?? []) {
        if (iconTheme.path) {
            contributePaths.push(iconTheme.path.replace(/^\.\//, ""));
        }
    }

    // typescriptServerPlugins[].name → resolves from node_modules/
    for (const plugin of contributes.typescriptServerPlugins ?? []) {
        if (plugin.name) {
            const pluginPath = `node_modules/${plugin.name}`;
            if (!whitelist.some((p) => p.startsWith(pluginPath))) {
                errors.push(
                    `package.json contributes typescriptServerPlugins '${plugin.name}' but .vscodeignore has no ${pluginPath} entry`,
                );
            }
        }
    }

    for (const contributePath of contributePaths) {
        if (!matchesWhitelist(contributePath, whitelist)) {
            errors.push(
                `package.json references '${contributePath}' but .vscodeignore has no matching whitelist entry`,
            );
        }
    }
}

// --- Run all checks ---

const { whitelist, raw } = loadVscodeignore();

checkExternals(raw);
checkRuntimePaths(whitelist);
checkDirnameNodeModules(raw);
checkPackageJsonContributes(whitelist);
checkPatternsResolve(whitelist);

if (errors.length > 0) {
    for (const e of errors) {
        console.error(`ERROR: ${e}`);
    }
    console.error(`\nFAILED: ${errors.length} packaging issue(s) found`);
    process.exit(1);
}

console.log("OK: All runtime deps and file references are in .vscodeignore");
