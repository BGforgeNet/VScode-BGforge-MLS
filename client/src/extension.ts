"use strict";

import * as fs from "fs";
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
import { registerBinaryEditor } from "./editors/binaryEditor";
import { ServerInitializingIndicator } from "./indicator";

let client: LanguageClient;
const loadingIndicator = new ServerInitializingIndicator(() => {
    conlog("loading start");
});
const cmd_compile = "extension.bgforge.compile";
const cmd_preview = "extension.bgforge.preview";
let previewSrcDir: string;

interface PreviewData {
    nodes: { data: { id: string } }[];
    edges: { data: { id: string; source: string; target: string } }[];
}

let currentPanel: vscode.WebviewPanel | undefined;

export async function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
    let disposable = vscode.commands.registerCommand(cmd_compile, compile);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand(cmd_preview, preview);
    context.subscriptions.push(disposable);
    previewSrcDir = context.asAbsolutePath(path.join("client", "out", "webview"));

    // Register binary file editor
    context.subscriptions.push(registerBinaryEditor(context));

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
            { scheme: "file", language: "fallout-worldmap-txt" },

            { scheme: "file", language: "weidu-tp2" },
            { scheme: "file", language: "weidu-tp2-tpl" },

            { scheme: "file", language: "weidu-baf" },
            { scheme: "file", language: "weidu-baf-tpl" },

            { scheme: "file", language: "weidu-d" },
            { scheme: "file", language: "weidu-d-tpl" },

            { scheme: "file", language: "weidu-ssl" },
            { scheme: "file", language: "weidu-slb" },

            { scheme: "file", language: "weidu-tra" },

            { scheme: "file", pattern: "**/*.tbaf" },
            { scheme: "file", pattern: "**/*.tssl" },
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

    client.onNotification("bgforge-mls/load-finished", () => {
        loadingIndicator.finishedLoadingProject("");
    });
}

async function preview() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("No active editor");
        return;
    }
    const document = editor.document;
    const uri = document.uri;
    const params: ExecuteCommandParams = {
        command: cmd_preview,
        arguments: [
            {
                uri: uri.toString(),
                scheme: uri.scheme,
            },
        ],
    };

    const data = await client.sendRequest(ExecuteCommandRequest.type, params) as PreviewData | undefined;
    if (!data) {
        vscode.window.showInformationMessage("No preview data available for this file");
        return;
    }

    showPreviewPanel(data, document.fileName);
}

function showPreviewPanel(data: PreviewData, fileName: string) {
    const column = vscode.ViewColumn.Beside;

    if (currentPanel) {
        currentPanel.reveal(column);
        currentPanel.webview.html = getWebviewContent(currentPanel.webview, data);
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        "bgforgePreview",
        `Callgraph: ${path.basename(fileName)}`,
        column,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(previewSrcDir)],
        }
    );

    currentPanel.webview.html = getWebviewContent(currentPanel.webview, data);

    currentPanel.onDidDispose(() => {
        currentPanel = undefined;
    });
}

function getWebviewContent(webview: vscode.Webview, data: PreviewData): string {
    const scriptPath = path.join(previewSrcDir, "index.js");
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        #cy {
            height: 100vh;
            width: 100vw;
            position: absolute;
            left: 0;
            top: 0;
        }
    </style>
</head>
<body>
    <div id="cy"></div>
    <script>
        window.previewData = ${JSON.stringify(data)};
    </script>
    <script>${scriptContent}</script>
</body>
</html>`;
}

export async function deactivate(): Promise<void> {
    if (!client) {
        return undefined;
    }
    return await client.stop();
}

async function compile(document = vscode.window.activeTextEditor?.document) {
    if (!document) {
        return;
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
