'use strict';

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { ExecuteCommandRequest, ExecuteCommandParams } from 'vscode-languageserver-protocol';

let client: LanguageClient;
const config_space = "bgforge";
const cmd_name = 'extension.bgforge.compile';

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
	const disposable = vscode.commands.registerCommand(cmd_name, () => {
		const fallout_ssl_compile_exe = vscode.workspace.getConfiguration(config_space).get('fallout-ssl.compile');
		const fallout_ssl_dst_dir = vscode.workspace.getConfiguration(config_space).get('fallout-ssl.output_directory', '.');
		const text_document = vscode.window.activeTextEditor.document;
		text_document.save(); //need this for compiler
		const weidu_path = vscode.workspace.getConfiguration(config_space).get('weidu.path', 'weidu');
		const weidu_game_path = vscode.workspace.getConfiguration(config_space).get('weidu.game_path', '');
		const params: ExecuteCommandParams = {
			command: cmd_name,
			arguments: [fallout_ssl_compile_exe, text_document, fallout_ssl_dst_dir, weidu_path, weidu_game_path]
		};
		client.sendRequest(ExecuteCommandRequest.type, params);
	});
	context.subscriptions.push(disposable);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			{ scheme: 'file', language: 'fallout-ssl' },
			{ scheme: 'file', language: 'weidu' },
			{ scheme: 'file', language: 'weidu-baf' },
			{ scheme: 'file', language: 'weidu-dialog' },
			{ scheme: 'file', language: 'weidu-tpl' },
			{ scheme: 'file', language: 'weidu-baf-tpl' },
			{ scheme: 'file', language: 'weidu-dialog-tpl' }
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'bgforge-mls',
		'BGforge MLS',
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
