import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { conlog } from "./common";

export interface SSLsettings {
    compilePath: string;
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
    if (dir !== undefined) {
        try {
            const file = fs.readFileSync(path.join(dir, ".bgforge.yml"), "utf8");
            const yml_settings = yaml.parse(file).mls;
            if (yml_settings.translation) {
                if (yml_settings.translation.directory) {
                    settings.translation.directory = yml_settings.translation.directory;
                }
                if (yml_settings.translation.auto_tra) {
                    settings.translation.auto_tra = yml_settings.translation.auto_tra;
                }
            }
        } catch (e) {
            conlog(e);
        }
    }
    return settings;
}
