"use strict";

import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";
import { ExecuteCommandRequest, ExecuteCommandParams } from "vscode-languageserver-protocol";

let client: LanguageClient;
const cmd_compile = "extension.bgforge.compile";
let settings: vscode.WorkspaceConfiguration;

export async function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
    const disposable = vscode.commands.registerCommand(cmd_compile, compile);
    context.subscriptions.push(disposable);

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
        },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: "file", language: "infinity-2da" },

            { scheme: "file", language: "fallout-msg" },
            { scheme: "file", language: "fallout-ssl" },

            { scheme: "file", language: "weidu-tp2" },
            { scheme: "file", language: "weidu-tp2-tpl" },

            { scheme: "file", language: "weidu-baf" },
            { scheme: "file", language: "weidu-baf-tpl" },

            { scheme: "file", language: "weidu-d" },
            { scheme: "file", language: "weidu-d-tpl" },

            { scheme: "file", language: "weidu-ssl" },
            { scheme: "file", language: "weidu-slb" },

            { scheme: "file", language: "weidu-tra" },
        ],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
        },
    };

    // Create the language client and start the client.
    client = new LanguageClient("bgforge-mls", "BGforge MLS", serverOptions, clientOptions);

    // Start the client. This will also launch the server
    await client.start();
    settings = vscode.workspace.getConfiguration("bgforge");
    conlog("BGforge MLS client started");
}

export async function deactivate(): Promise<void> {
    if (!client) {
        return undefined;
    }
    return await client.stop();
}

async function compile(
    document = vscode.window.activeTextEditor.document,
    triggered_by_save = false
) {
    // compile.exe and weidu.exe need files saved on disk to parse them
    if (!triggered_by_save) {
        await document.save();
    }
    const uri = document.uri;
    const params: ExecuteCommandParams = {
        command: cmd_compile,
        arguments: [
            {
                uri: uri.toString(),
                scheme: uri.scheme,
            },
        ],
    };
    await client.sendRequest(ExecuteCommandRequest.type, params);
}

// cache settings
vscode.workspace.onDidChangeConfiguration(async (change) => {
    const affects = change.affectsConfiguration("bgforge");
    if (affects) {
        settings = vscode.workspace.getConfiguration("bgforge");
    }
});

vscode.workspace.onDidChangeTextDocument(async (change) => {
    // same list is checked in server, update both if changing
    const compile_languages = [
        "weidu-tp2",
        "weidu-tp2-tpl",
        "weidu-d",
        "weidu-d-tpl",
        "weidu-baf",
        "weidu-baf-tpl",
        "fallout-ssl",
    ];
    const lang_id = change.document.languageId;
    if (!compile_languages.includes(lang_id)) {
        return;
    }
    const validate_on_change = settings.get("validateOnChange");
    if (!validate_on_change) {
        return;
    }
    change.document.save(); // automatically triggers compile on server
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function conlog(item: any) {
    switch (typeof item) {
        case "number":
            console.log(item.toString());
            break;
        case "boolean":
            console.log(item.toString());
            break;
        case "undefined":
            console.log(item);
            break;
        case "string":
            console.log(item);
            break;
        default:
            if (item.size && item.size > 0 && JSON.stringify(item) == "{}") {
                console.log(JSON.stringify([...item]));
            } else {
                console.log(JSON.stringify(item));
            }
            break;
    }
}
