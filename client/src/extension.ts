"use strict";

import * as path from "path";
import * as vscode from "vscode";
import { ExtensionContext, workspace } from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";
import { ExecuteCommandParams, ExecuteCommandRequest } from "vscode-languageserver-protocol";
import { ServerInitializingIndicator } from "./indicator";

let client: LanguageClient;
const loadingIndicator = new ServerInitializingIndicator(() => {
    conlog("loading start");
});
const cmd_compile = "extension.bgforge.compile";

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

    loadingIndicator.startedLoadingProject("");

    // Start the client. This will also launch the server
    await client.start();
    conlog("BGforge MLS client started");
    client.onNotification("bgforge-mls-load-finished", () => {
        loadingIndicator.finishedLoadingProject("");
    });
}

export async function deactivate(): Promise<void> {
    if (!client) {
        return undefined;
    }
    return await client.stop();
}

async function compile(document = vscode.window.activeTextEditor.document) {
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
