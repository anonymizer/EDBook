import * as vscode from 'vscode';
import { GSFS } from './gsfs';

declare const navigator: unknown;

export function activate(context: vscode.ExtensionContext) {
	if (typeof navigator === 'object') {	// do not run under node.js
		const gsfs = enableFs(context);
		gsfs.seed();

		vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`gsfs:/samples/README.dpage`));
	}
}

function enableFs(context: vscode.ExtensionContext): GSFS {
	const gsfs = new GSFS();
	context.subscriptions.push(gsfs);

	return gsfs;
}