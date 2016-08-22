'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind,	SignatureHelp, Hover
} from 'vscode-languageserver';

// Builtin functions
import builtins_json from './builtins';

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			},
			signatureHelpProvider: {
				triggerCharacters: ["(", ","],
			},
			hoverProvider: true,
		}
	}
});

let keywords = [
	'if', 'else', 'int', 'float', 'string', 'object', 'goto', 'return', 'continue', 'break', 'while', 'for', 'void',
	'self', 'other', 'true', 'false'
];

let completionItemList = [];
for (let keyword of keywords) {
	completionItemList.push({
		label: keyword,
		kind: CompletionItemKind.Keyword,
		detail: keyword,
	});
}
for (let builtin of builtins_json) {
	completionItemList.push({
		label: builtin.name,
		kind: CompletionItemKind.Function,
		detail: builtin.text,
		documentation: builtin.brief,
	});
}

let builtinsMap = {};
for (let builtin of builtins_json) {
	builtinsMap[builtin.name] = builtin;
}

function parseFuncDecls(uri: string) {
	let userFunctions = [];
	let text = documents.get(uri).getText();
	let regex = /^[^"]*?([a-z]+)\s+([a-zA-Z0-9_]+)\s*\(\s*(([a-z]+\s+[a-zA-Z0-9_]+\s*,?\s*)*)\)/gm;
	let match = null;
	while ((match = regex.exec(text)) !== null) {
		let type = match[1];
		let funcName = match[2];
		let args = match[3].split(',').map((x) => x.trim());
		let signature = type + ' ' + funcName + ' (' + args.join(', ') + ')';
		userFunctions.push({
			type: type,
			name: funcName,
			args: args,
			text: signature,
		});
	}
	return userFunctions;
}

connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover => {
	let doc = documents.get(textDocumentPosition.textDocument.uri);
	let text = doc.getText();
	let offset = doc.offsetAt(textDocumentPosition.position) - 1;
	let value = null;
	if (getNumQuotes(text, offset) % 2 == 0) {
		let start = offset;
		let end = offset + 1;
		while (start >= 0 && /[a-zA-Z0-9_]/.test(text[start])) { start--; }
		while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) { end++; }
		let name = text.substr(start+1, end - start - 1);
		if (builtinsMap[name]) {
			value = builtinsMap[name].text;
		}
		else {
			for (let func of parseFuncDecls(textDocumentPosition.textDocument.uri)) {
				if (func.name === name) {
					value = func.text;
					break;
				}
			}
		}
	} 
	return {
		contents: value === null ? [] : [{ language: 'ns', value: value }]
	};
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	let userFunctions = parseFuncDecls(textDocumentPosition.textDocument.uri);

	return completionItemList.concat(userFunctions.map((f) => {
		return {
			label: f.name,
			kind: CompletionItemKind.Function,
			detail: f.text,
		}
	}));
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	return item;
});

function getNumQuotes(text: string, offset: number) {
	let result = 0;
	while (offset >= 0 && text[offset] != '\n') {
		if (text[offset] == '"' && text[offset-1] != '\\')
			result++;
		offset--;
	}
	return result;
}

function getFuncName(text: string, offset: number) {
	let result = null;
	let lastSpace = offset + 1;
	while (offset >= 0) {
		if (/\s/.test(text[offset])) {
			if (result !== null)
				break;
			lastSpace = offset;
		}
		else if (/[a-zA-Z0-9_]/.test(text[offset])) {
			result = offset;
		}
		else {
			break;
		}
		offset--;
	}
	if (result === null)
		return null;
	return text.substr(result, lastSpace - result);
}

connection.onSignatureHelp((textDocumentPosition: TextDocumentPositionParams): SignatureHelp => {
	let doc = documents.get(textDocumentPosition.textDocument.uri);
	let text = doc.getText();
	let offset = doc.offsetAt(textDocumentPosition.position) - 1;
	let funcName = null;
	let paramNum = 0;
	let nestLevel = 0;
	let inString = (getNumQuotes(text, offset) % 2 == 1);

	while (inString || text[offset] != ';') {
		if (inString) {
			if ((text[offset] == '"' && text[offset-1] != '\\') || text[offset] == '\n')
				inString = false;
		}
		else if (text[offset] == '"') {
			inString = true;
		}
		else if (text[offset] == '(') {
			if (nestLevel == 0) {
				funcName = getFuncName(text, offset - 1);
				if (funcName != null)
					break;
			}
			else {
				nestLevel--;
			}
		}
		else if (text[offset] == ')') {
			nestLevel++;
		}
		else if (text[offset] == ',' && nestLevel == 0) {
			paramNum++;
		}
		offset--;
		if (offset < 0)
			break;
	}

	if (funcName === null)
		return { signatures: [] };

	if (builtinsMap[funcName]) {
		return {
			signatures: [builtinsMap[funcName].signature],
			activeSignature: 0,
			activeParameter: paramNum
		}
	}
	else {
		let userFunctions = parseFuncDecls(textDocumentPosition.textDocument.uri);
		for (let func of userFunctions) {
			if (func.name == funcName) {
				return {
					signatures: [{
						label: func.text,
						parameters: func.args.map((param) => {
							return { label: param };
						})
					}],
					activeSignature: 0,
					activeParameter: paramNum,
				};
			}
		}
	}
	return { signatures: [] };
});

// Listen on the connection
connection.listen();