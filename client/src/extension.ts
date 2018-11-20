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

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	let disposable = vscode.commands.registerCommand('extension.SSLcompile', () => {
		vscode.window.showInformationMessage('SSLcompile!');
		
		var currentlyOpenTabfilePath = vscode.window.activeTextEditor.document.fileName;
		var currentlyOpenTabdirPath = path.dirname(currentlyOpenTabfilePath);
		var currentlyOpenTabfileName = path.basename(currentlyOpenTabfilePath);
		var base_name = path.parse(currentlyOpenTabfileName).name;
    console.log(vscode.workspace.getConfiguration('ssl'));
		var dst_dir = vscode.workspace.getConfiguration('ssl').get('output_directory','.');
		var dst_path = path.join(dst_dir, base_name + '.int');
		var compile_exe = vscode.workspace.getConfiguration('ssl').get('compile');
		console.log('dst_path: ' + dst_path);
		
		const cp = require('child_process');
		cp.exec(compile_exe +" "+ currentlyOpenTabfileName + ' -o ' + dst_path, {cwd: currentlyOpenTabdirPath}, (err: any, stdout: any, stderr: any) => {
				console.log('stdout: ' + stdout);
				console.log('stderr: ' + stderr);
				if (err) {
					vscode.window.showInformationMessage(err);
					console.log('error: ' + err);
				}
		});

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
		'SSLlanguageServer',
		'SSL Language Server',
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
