// The settings

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
