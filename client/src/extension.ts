'use strict';

import * as path from 'path';
import * as cp from 'child_process';

import { workspace, Disposable, ExtensionContext, commands, TextEditor, OutputChannel, window, ViewColumn } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';

let oc: OutputChannel;
let nscPath: string;

function runNsc(editor: TextEditor): void {
	try {
		if (editor.document.languageId !== 'ns') {
			return;
		}
		if (oc === undefined) {
			oc = window.createOutputChannel('Nox Script Compiler');
		}
    	oc.clear();
		const file = editor.document.fileName;
		let nsc = cp.spawn(nscPath, [file, '-v', '-o', path.join(path.dirname(file), path.basename(file, '.ns') + '.obj')], { cwd: path.dirname(nscPath) });    
		nsc.stdout.on('data', (data: Buffer) => {
		if (data) {
			oc.append(data.toString());
		}
		});
		nsc.stderr.on('data', (data: Buffer) => {
		if (data) {
			oc.append(data.toString());
		}
		});
    	oc.show(ViewColumn.Three);
	}
	catch(e){
		window.showErrorMessage('Running nsc failed');
	}
}

function getOSExt(): string {
	return process.platform == 'win32' ? 'exe' : process.platform;
}

export function activate(context: ExtensionContext) {
	// Set nsc path
	nscPath = context.asAbsolutePath(path.join('bin', 'nsc.' + getOSExt()));
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
	
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}
	
	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		documentSelector: ['ns'],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'noxscriptLanguageServer',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}

	let disposable = new LanguageClient('NoxScript Language Server', 'NoxScript Language Server', serverOptions, clientOptions).start();

	context.subscriptions.push(disposable);

	commands.registerTextEditorCommand('ns.compile', runNsc);
}
