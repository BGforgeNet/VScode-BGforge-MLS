/**
 * Settings and configuration management.
 * Defines settings interfaces and loads project-specific configuration from YAML.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { conlog } from "./common";

export interface SSLsettings {
    compilePath: string;
    useBuiltInCompiler: boolean;
    compileOptions: string;
    outputDirectory: string;
    headersDirectory: string;
}

export interface WeiDUsettings {
    path: string;
    gamePath: string;
}

export interface MLSsettings {
    falloutSSL: SSLsettings;
    weidu: WeiDUsettings;
    validateOnSave: boolean;
    validateOnChange: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.

export const defaultSettings: MLSsettings = {
    falloutSSL: {
        compilePath: "compile",
        useBuiltInCompiler: false,
        compileOptions: "-q -p -l -O2 -d -s -n",
        outputDirectory: "",
        headersDirectory: "",
    },
    weidu: { path: "weidu", gamePath: "" },
    validateOnSave: true,
    validateOnChange: false,
};

export interface ProjectTraSettings {
    directory: string;
    auto_tra: boolean;
}

export interface ProjectSettings {
    translation: ProjectTraSettings;
}

const defaultProjectSettings: ProjectSettings = {
    translation: {
        directory: "tra",
        auto_tra: true,
    },
};

/** get project settings from .bgforge.yml */
export function project(dir: string) {
    const settings = defaultProjectSettings;
    // Runtime guard: server.ts declares workspaceRoot as string but only conditionally
    // assigns it. If no workspace folders exist, it remains undefined at runtime.
    if (dir === undefined) {
        return settings;
    }
    try {
        const file = fs.readFileSync(path.join(dir, ".bgforge.yml"), "utf8");
        // yaml.parse returns any, so we need explicit type checks
        const yml = yaml.parse(file) as Record<string, unknown> | null;
        const yml_settings = yml?.mls as Record<string, unknown> | undefined;
        const translation = yml_settings?.translation as Record<string, unknown> | undefined;
        if (translation !== undefined) {
            if (typeof translation.directory === "string") {
                settings.translation.directory = translation.directory;
            }
            if (typeof translation.auto_tra === "boolean") {
                settings.translation.auto_tra = translation.auto_tra;
            }
        }
    } catch (e) {
        conlog(e);
    }
    return settings;
}
