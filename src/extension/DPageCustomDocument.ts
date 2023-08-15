import * as vscode from 'vscode';
import { GammaPage } from '../dpage';
import { generateUUID } from './utils';
import { convertNotebookToLatest } from './format-converters/format-converters';
import { GammaInstructorID, GammaNobodyID, GammaUserID } from '../constants';

export class DPageDocument extends vscode.Disposable implements vscode.CustomDocument {
    public static async create(
        uri: vscode.Uri,
        backupId: string | undefined,
        token: vscode.CancellationToken
    ): Promise<DPageDocument> {
        const data = await DPageDocument.readFile(uri);
        const document = new DPageDocument(uri, data);

        return document;
    }

    public constructor(
            private readonly _uri: vscode.Uri,
            private data: GammaPage) {
        super(() => this.dispose());
    }

    public get uri(): vscode.Uri { return this._uri; }

    public static async readFile(uri: vscode.Uri): Promise<GammaPage> {
        const readData = await vscode.workspace.openTextDocument(uri);
        const text = readData.getText();

        try {
            const parsedContents = JSON.parse(text) as GammaPage;
            const page = convertNotebookToLatest(parsedContents);
            return page;
        } catch (e) {
            return {
                id: generateUUID(),
                cellsById: {},
                participants: {
                    [GammaUserID]: {
                        id: GammaUserID,
                        name: 'Student',
                        color: 'var(--vscode-charts-blue)',
                        description: ''
                    },
                    [GammaInstructorID]: {
                        id: GammaInstructorID,
                        name: 'Instructor',
                        color: 'var(--vscode-charts-red)',
                        description: ''
                    },
                    [GammaNobodyID]: {
                        id: GammaNobodyID,
                        name: 'Nobody',
                        color: 'var(--vscode-charts-black)',
                        description: ''
                    }
                },
                userState: {
                    visibleCellIds: [],
                    highlightedCellIds: [],
                    cellStates: {},
                    selectedCellId: false
                },
                terminalCellId: null,
                media: {},
                dbookformat: 4,
                dbookformat_minor: 0
            };
        }
    }

    public serialize(): GammaPage {
        return this.getData();
    }

    public setData(data: GammaPage): void {
        this.data = data;
    }

    public getData(includeUserData = false): GammaPage {
        if(includeUserData) {
            return this.data;
        } else {
            const data = {...this.data};
            data.userState = {
                visibleCellIds: [],
                highlightedCellIds: [],
                cellStates: {},
                selectedCellId: false
            };
            return data;
        }
    }
    public async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);

		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// noop
				}
			}
		};
	}

    public async revert(_cancellation: vscode.CancellationToken): Promise<void> {
		const diskContent = await DPageDocument.readFile(this.uri);
        this.setData(diskContent);
	}
    /**
	 * Called by VS Code when the user saves the document.
	 */
	async save(cancellation: vscode.CancellationToken): Promise<void> {
		await this.saveAs(this.uri, cancellation);
	}

	/**
	 * Called by VS Code when the user saves the document to a new location.
	 */
	async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
        const data = this.getData();
		if (cancellation.isCancellationRequested) {
			return;
		}

        await vscode.workspace.fs.writeFile(targetResource, Buffer.from(JSON.stringify(data, null, 4)));
	}

}