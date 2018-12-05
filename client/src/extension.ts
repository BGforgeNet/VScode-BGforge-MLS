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
let config_space = "ssl";
let cmd_name = 'extension.SSLcompile';
//let last_open_ssl: vscode.TextDocument;
//let ssl_ext = 'ssl';

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
	let disposable = vscode.commands.registerCommand(cmd_name, () => {
		var compile_exe = vscode.workspace.getConfiguration(config_space).get('compile');
		var dst_dir = vscode.workspace.getConfiguration(config_space).get('output_directory', '.');
		var text_document = vscode.window.activeTextEditor.document;
		text_document.save(); //need this for compiler
		//var text_document = last_open_ssl;
		let params: ExecuteCommandParams = {
			command: cmd_name,
			arguments: [compile_exe, text_document, dst_dir]
		};
		client.sendRequest(ExecuteCommandRequest.type, params);
	});
	context.subscriptions.push(disposable);

	/* doesn't work
	//vscode loses open file if clicked on console, need to track it
	disposable = vscode.window.onDidChangeActiveTextEditor((listener) => {
		let full_path = listener.document.fileName;
		if (path.extname(full_path) == ssl_ext) {
			last_open_ssl = listener.document;
			conlog('changed last editor to ' + full_path);
		}
	});
	context.subscriptions.push(disposable);
	last_open_ssl = vscode.window.activeTextEditor.document; //initial value
	*/

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
