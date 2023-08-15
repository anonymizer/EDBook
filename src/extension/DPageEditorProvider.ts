import * as vscode from 'vscode';
import { getNonce } from './utils';
import { DPageDocument } from './DPageCustomDocument';
import { CodeChangeMessage, GetPageMessage, InitialDataMessage, Message, PageDataMessage, SelectedCodeResponseMessage, ShowAlertMessage, ShowCodeMessage, UploadFileMessage, UploadedFilesResponse } from '../messages';
import { listenForRespondableMessages, postAndAwaitResponse } from './extension-message-utils';
// import { Buffer } from 'buffer';
import { DPageFileSystemProvider } from './DPageFileSystemProvider';
import { EditorDecoration, PointerEditorDecoration } from '../dpage';
// global.Buffer = Buffer;

export class DPageEditorProvider implements vscode.CustomEditorProvider {
    public static readonly uriScheme = 'gamma';
    private static readonly viewType = 'ANONYMIZED.gamma.dpage';
    private readonly uriToFilename: Map<string, string> = new Map<string, string>();
    private readonly activeEditors: Map<string, vscode.TextEditor> = new Map<string, vscode.TextEditor>();
    private ignoreFilesystemChanges = false;

    private static readonly addedContentDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: {id: 'diffEditor.insertedLineBackground'},
        borderColor: {id: 'diffEditor.insertedTextBorder'},
        isWholeLine: true,
    });
    private static readonly removedContentDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: {id: 'diffEditor.removedLineBackground'},
        borderColor: {id: 'diffEditor.removedTextBorder'},
        textDecoration: 'line-through',
        isWholeLine: true,
    });
    private static readonly pointedContentDecoration = vscode.window.createTextEditorDecorationType({
        // borderColor: {id: 'editor.wordHighlightTextBorder'},
        borderColor: {id: 'editor.findMatchBorder'},
        borderStyle: 'solid',
        borderWidth: '1px',
        borderRadius: '2px',
        // borderColor: {id: 'notebook.selectedCellBorder'},
        // borderColor: 'red',
        backgroundColor: {id: 'editor.findMatchHighlightBackground'},
        isWholeLine: false,
    });

    private constructor(private readonly _context: vscode.ExtensionContext, private readonly _filesystem: DPageFileSystemProvider) {
    }


    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<DPageDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    public async saveCustomDocument(document: DPageDocument, cancellation: vscode.CancellationToken): Promise<void> {
        await this.saveCustomDocumentAs(document, document.uri, cancellation);
    }
    public async saveCustomDocumentAs(document: DPageDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
        await document.saveAs(destination, cancellation);
    }
    public async revertCustomDocument(document: DPageDocument, cancellation: vscode.CancellationToken): Promise<void> {
        return await document.revert(cancellation);
    }
    public async backupCustomDocument(document: DPageDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        return await document.backup(context.destination, cancellation);
    }


    public static register(context: vscode.ExtensionContext, filesystem: DPageFileSystemProvider): vscode.Disposable {
        const provider = new DPageEditorProvider(context, filesystem);
        const providerRegistration = vscode.window.registerCustomEditorProvider(DPageEditorProvider.viewType, provider);
        return providerRegistration;
    }

    public async resolveCustomEditor(document: DPageDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        this._filesystem.onDidChangeFile(async (e) => {
            if(this.ignoreFilesystemChanges) { return; }
            const changedFiles = new Set<string>();
            for(const change of e) {
                changedFiles.add(change.uri.toString());
            }
            for(const changedFilename of changedFiles) {
                const uri = vscode.Uri.parse(changedFilename);
                const contentArray: Uint8Array = await this._filesystem.readFile(uri);
                const decoder = new TextDecoder("utf-8");
                const content = decoder.decode(contentArray);
                if(this.uriToFilename.has(uri.toString())) {
                    const filename = this.uriToFilename.get(uri.toString())!;
                    postAndAwaitResponse(webviewPanel, { message: 'code-changed', filename, content } as CodeChangeMessage, false);
                }
            }
        });

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);
        listenForRespondableMessages(webviewPanel, async (e: Message, respond: ((response: any) => void)) => {
            const { message } = e;
            if(message === 'ready') {
                respond({ message: 'initial_data', data: document.serialize()} as InitialDataMessage);
            } else if(message === 'page_changed') {
                this._onDidChangeCustomDocument.fire({document, undo: () => {return;}, redo: () => {return;} });

                const response = (await postAndAwaitResponse(webviewPanel, { message: 'get_page' } as GetPageMessage)) as PageDataMessage;
                if(response.data) {
                    document.setData(response.data);
                }
            } else if(message === 'get-api-key') {
                const apiKey = vscode.workspace.getConfiguration('gamma').get('apiKey') as string;
                respond({ message: 'api-key', apiKey });
            } else if(message === 'show-code') {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { Buffer } = require('buffer');
                const { files, decorations } = e as ShowCodeMessage;
                const baseURI = document.uri.fsPath;
                const toCloseEditors: Set<vscode.TextEditor> = new Set(this.activeEditors.values());
                // .map(([filename, editor]) => {
                //     return vscode.Uri.file(filename).with({ scheme: 'gamma' });
                // }));


                const directoryLocation = baseURI + '-files'
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(directoryLocation));

                for(const filename in files) {
                    const contents = files[filename];
                    // const location = vscode.Uri.file(filename).with({ scheme: DPageEditorProvider.uriScheme, query: baseURI.toString() });
                    const location = vscode.Uri.joinPath(vscode.Uri.file(directoryLocation), filename);
                    await vscode.workspace.fs.writeFile(location, Buffer.from(contents));


                    // this.ignoreFilesystemChanges = true;
                    // this._filesystem.writeFile(location, Buffer.from(contents), {create: true, overwrite: true});
                    // this.ignoreFilesystemChanges = false;

                    this.uriToFilename.set(location.toString(), filename);
                    let tentativeEditor: vscode.TextEditor|undefined = this.activeEditors.has(filename) ? this.activeEditors.get(filename) : undefined;

                    // if(tentativeEditor) {
                    //     try {
                    //         tentativeEditor.setDecorations(DPageEditorProvider.addedContentDecoration, []); // clear decorations
                    //     } catch(e) {
                    //         console.error(e);
                    //         tentativeEditor = undefined;
                    //     }
                    // }
                    
                    if(!tentativeEditor) {
                        tentativeEditor = await this.openEditor(location, contents);
                        // this.activeEditors.set(filename, tentativeEditor);
                    }

                    const editor: vscode.TextEditor = tentativeEditor;


                    const fileDecorations = decorations.filter(d => d.filename === filename);
                    this.setEditorDecorations(editor, fileDecorations);

                    if(toCloseEditors.has(editor)) {
                        toCloseEditors.delete(editor);
                    }
                }

                toCloseEditors.forEach((editor: vscode.TextEditor) => {
                    const filename = this.uriToFilename.get(editor.document.uri.toString())!;
                    this.closeEditor(editor);
                    this.activeEditors.delete(filename);
                    // this.activeEditors.delete(this.uriToFilename.get(location.toString())!);
                    // this.uriToFilename.delete(location.toString());
                });
            } else if(message === 'add-code-pointer') {
                const baseURI = document.uri.fsPath;
                const regions: PointerEditorDecoration[] = [];
                const gammaEditors = vscode.window.visibleTextEditors.filter((editor: vscode.TextEditor) => {
                    const {document} = editor;
                    const {uri} = document;
                    const { scheme, query } = uri;
                    return scheme === DPageEditorProvider.uriScheme && query === baseURI.toString();
                });


                for(const editor of gammaEditors) {
                    const {document} = editor;
                    const {uri} = document;
                    const { path } = uri;
                    const filename = path.slice(1); // get rid of initial / TODO: FIX
                    // console.log(filename);
                    // const filename = path.split()
                    // console.log(uri, uri.scheme, uri.fsPath);
                    for(const selection of editor.selections) {
                        const { start, end } = selection;
                        regions.push({ startLineNumber: start.line, startColumn: start.character, endLineNumber: end.line, endColumn: end.character, filename, type: 'pointer' });
                    }
                }
                respond({ message: 'currently-selected-code', regions } as SelectedCodeResponseMessage);
            } else if(message === 'upload-file') {
                const { options } = e as UploadFileMessage;
                const uris = await vscode.window.showOpenDialog(options);
                const files: { [filename: string]: {content: Uint8Array, filename: string} } = {};
                if(uris) {
                    for(const uri of uris) {
                        const path = uri.path;
                        try {
                            const content = new Uint8Array(await vscode.workspace.fs.readFile(uri));
                            const splitPath = path.split('/');
                            const filename = splitPath[splitPath.length - 1];

                            // console.log(vscode.Uri.parse(filename));
                            // const stringContent = new TextDecoder().decode(contents);
                            // const blob = new Blob([contents], {type: 'image/jpg'});
                            // const url = URL.createObjectURL(blob);
                            // console.log(url);
                            files[path] = {content, filename};
                        } catch(e) {
                            console.error(e);
                        }
                    }
                }
                respond({message: 'uploaded-files', files} as UploadedFilesResponse);
            } else if(message === 'show-alert') {
                const { content, type } = e as ShowAlertMessage;

                if(type === 'warning') {
                    vscode.window.showWarningMessage(content);
                } else if(type === 'error') {
                    vscode.window.showErrorMessage(content);
                } else {
                    vscode.window.showInformationMessage(content);
                }
            }
        });

        // console.log('listen');
        // vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) => {
        //     const {uri} = doc;
        //     const {scheme} = uri;
        //     console.log(uri.toString());
        //     if(scheme === DPageEditorProvider.uriScheme) {
        //         const filename = this.uriToFilename.get(uri.toString())!;
        //         this.activeEditors.delete(filename);
        //         this.uriToFilename.delete(uri.toString());
        //     }
        // });
    }
    private async closeEditor(editor: vscode.TextEditor): Promise<void> {
        const doc = editor.document;
        // const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(location);
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false, preview: false });
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }

    private async openEditor(location: vscode.Uri, contents: string): Promise<vscode.TextEditor> {
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(location);
        const editor: vscode.TextEditor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true, preview: false });
        return editor;
    }
    private setEditorDecorations(editor: vscode.TextEditor, decorations: EditorDecoration[]): void {
        const addedDecorationOptions: vscode.DecorationOptions[] = [];
        const removedDecorationOptions: vscode.DecorationOptions[] = [];
        const pointedDecorationOptions: vscode.DecorationOptions[] = [];
        decorations.forEach((decoration: EditorDecoration) => {
            const { type, startLineNumber, startColumn, endColumn, endLineNumber } = decoration;
            const decorationRange = new vscode.Range(new vscode.Position(startLineNumber, startColumn), new vscode.Position(endLineNumber, endColumn));
            if(type === 'added') {
                addedDecorationOptions.push({
                    range: decorationRange,
                    hoverMessage: 'Added content',
                });
            } else if(type === 'removed') {
                removedDecorationOptions.push({
                    range: decorationRange,
                    hoverMessage: 'Removed content',
                });
            } else {
                pointedDecorationOptions.push({
                    range: decorationRange
                });
            }
        });
        editor.setDecorations(DPageEditorProvider.addedContentDecoration,   addedDecorationOptions);
        editor.setDecorations(DPageEditorProvider.removedContentDecoration, removedDecorationOptions);
        editor.setDecorations(DPageEditorProvider.pointedContentDecoration, pointedDecorationOptions);
    }
    // public async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
    //     webviewPanel.webview.options = {
    //         enableScripts: true,
    //     };
    //     webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    // }

    public async openCustomDocument(uri: vscode.Uri, openContext: { backupId?: string}, _token: vscode.CancellationToken): Promise<DPageDocument> {
        const document: DPageDocument = await DPageDocument.create(uri, openContext.backupId, _token);
        return document;
    }

    private getHtmlForWebview(webview: vscode.Webview, document: DPageDocument): string {
        const nonce = getNonce();
        let scriptPathOnDisk: vscode.Uri;
        if (vscode.env.uiKind === vscode.UIKind.Web) {
            // eslint-disable-next-line no-restricted-globals
            const scheme = location.href.startsWith('https://') ? 'https' : 'http';
            // eslint-disable-next-line no-restricted-globals
            const authority = location.href.split('/')[2];
            const path = 'gamma/dist/dpage-webview.js';
            scriptPathOnDisk = vscode.Uri.from({scheme, authority, path});
        } else{
            scriptPathOnDisk = webview.asWebviewUri(
                vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'dpage-webview.js'));
        }

        return /* html */`
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                </head>
                <body>
                    <div id="root"></div>
                    <script nonce="${nonce}" src="${scriptPathOnDisk}"></script>
                </body>
            </html>`;
    }
}
