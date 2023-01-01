import * as fs from "fs";
import * as yaml from "yaml";
import * as path from "path";
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
        auto_tra: false,
    },
};

/** get project settings from .bgforge.yml */
export async function project(dir: string) {
    let settings = defaultProjectSettings;
    try {
        const file = fs.readFileSync(path.join(dir, ".bgforge.yml"), "utf8");
        const yml_settings = yaml.parse(file).mls;
        conlog(yml_settings);
        settings = { ...settings, ...yml_settings };
    } catch (e) {
        conlog(e);
    }
    return settings;
}
