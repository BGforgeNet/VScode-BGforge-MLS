'use strict';

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';
import { createConnection } from 'net';
import { ExecuteCommandRequest, ExecuteCommandParams } from 'vscode-languageserver-protocol';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	var cmd_name = 'extension.SSLcompile';
	let disposable = vscode.commands.registerCommand(cmd_name, () => {
		var compile_exe = vscode.workspace.getConfiguration('ssl').get('compile');
		var dst_dir = vscode.workspace.getConfiguration('ssl').get('output_directory', '.');
		var text_document = vscode.window.activeTextEditor.document;
		let params: ExecuteCommandParams = {
			command: cmd_name,
			arguments: [compile_exe, text_document, dst_dir]
		};
		client.sendRequest(ExecuteCommandRequest.type, params);
	});
	context.subscriptions.push(disposable);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'ssl' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'ssl',
		'BGforge SSL server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

function conlog(item: any) {
	switch (typeof (item)) {
		case "number":
			console.log(item);
			break;
		case "boolean":
			console.log(item);
			break;
		case "undefined":
			console.log(item);
			break;
		case "string":
			console.log(item);
			break;
		default:
			console.log(JSON.stringify(item));
			break;
	}
}
