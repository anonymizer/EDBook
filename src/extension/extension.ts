import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
import { DPageEditorProvider } from './DPageEditorProvider';
import { DPageFileSystemProvider } from './DPageFileSystemProvider';
// import {simpleGit} from 'simple-git';

export function activate(context: vscode.ExtensionContext) {
	// const disposable = vscode.commands.registerCommand('ANONYMIZED.gamma.new', async () => {
        // vscode.window.showInformationMessage('Create a new gamma file');
		// const git = simpleGit();
		// //can change to other github repo html
        // const uri = 'https://github.com/ANONYMIZED';

        // if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		// 	const workspaceFolder = vscode.workspace.workspaceFolders[0].uri;
		// 	const newDirectoryName = 'tuorials'; 
        // 	const newDirectoryPath = path.join(workspaceFolder.fsPath, newDirectoryName);
			
	
		// 	if (uri) {
		// 		try {
		// 			if (!fs.existsSync(newDirectoryPath)) {
		// 				fs.mkdirSync(newDirectoryPath);
		// 				await git.clone(uri, newDirectoryPath);
		// 			}
		// 			const newWorkspaceFolder = { uri: vscode.Uri.file(newDirectoryPath), name: newDirectoryName };
		// 			vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, newWorkspaceFolder);
		// 			vscode.window.showInformationMessage('Repository cloned and added to workspace');
		
		// 		}
		// 		catch (err: any) {
		// 			vscode.window.showErrorMessage('Failed to clone repository: ' + err.message);
		// 		}
		// 	}
		// 	else{
		// 		vscode.window.showInformationMessage('uri not exist');
		// 	}

		// } else {
		// 	vscode.window.showErrorMessage('No folder is open in the workspace');
		// 	return;
		// }
	const gammaFilesystem = new DPageFileSystemProvider();

	// context.subscriptions.push(disposable);
	context.subscriptions.push(DPageEditorProvider.register(context, gammaFilesystem));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider(DPageEditorProvider.uriScheme, gammaFilesystem, { isCaseSensitive: true }));
}

// This method is called when your extension is deactivated
export function deactivate() { return; }
