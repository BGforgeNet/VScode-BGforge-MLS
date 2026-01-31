/**
 * TypeScript Language Service Plugin for TSSL files.
 * Suppresses TS6133 ("declared but never read") diagnostics for Fallout
 * engine procedure names (start, talk_p_proc, etc.) in .tssl files.
 *
 * Loaded by tsserver via contributes.typescriptServerPlugins in package.json.
 * Bundled by esbuild into node_modules/bgforge-tssl-plugin/index.js (CJS, self-contained).
 */

import type ts from "typescript";
import { filterEngineProcedureDiagnostics } from "./filter-diagnostics";

const TSSL_EXTENSION = ".tssl";

function isTsslFile(fileName: string): boolean {
    return fileName.endsWith(TSSL_EXTENSION);
}

function init(_modules: { typescript: typeof ts }): ts.server.PluginModule {
    function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
        const proxy = new Proxy(info.languageService, {
            get(target, prop, receiver) {
                if (prop === "getSemanticDiagnostics") {
                    return (fileName: string) => {
                        const diagnostics = target.getSemanticDiagnostics(fileName);
                        if (!isTsslFile(fileName)) {
                            return diagnostics;
                        }
                        return filterEngineProcedureDiagnostics(diagnostics);
                    };
                }
                if (prop === "getSuggestionDiagnostics") {
                    return (fileName: string) => {
                        const diagnostics = target.getSuggestionDiagnostics(fileName);
                        if (!isTsslFile(fileName)) {
                            return diagnostics;
                        }
                        return filterEngineProcedureDiagnostics(diagnostics);
                    };
                }
                return Reflect.get(target, prop, receiver);
            },
        });

        return proxy;
    }

    return { create };
}

export = init;
