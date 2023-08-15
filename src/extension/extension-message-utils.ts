import { Message } from "../messages";
import * as vscode from 'vscode';
import { generateUUID } from "./utils";

const ID_KEY = '__id__';
export function listenForRespondableMessages(webviewPanel: vscode.WebviewPanel, callback: (e: Message, respond: ((response: any) => void)) => void): void {
    const eventListener = (e: Message) => {
        const id = e[ID_KEY];

        const messageCopy = {...e};
        delete messageCopy[ID_KEY];

        callback(messageCopy, (response: any) => {
            webviewPanel.webview.postMessage({ ...response, [ID_KEY]: id });
        });
    };
    webviewPanel.webview.onDidReceiveMessage(eventListener);
}

export function postAndAwaitResponse(webviewPanel: vscode.WebviewPanel, message: Message, actuallyAwaitResponse = true): Promise<any> {
    return new Promise((resolve, reject) => {
        let id = '';

        if(actuallyAwaitResponse) {
            id = generateUUID();

            const messageListener = webviewPanel.webview.onDidReceiveMessage((event: Message) => {
                if (event[ID_KEY] === id) {
                    messageListener.dispose();

                    const dataCopy = {...event};
                    delete dataCopy[ID_KEY];
                    resolve(dataCopy);
                }
            });
        }

        webviewPanel.webview.postMessage(actuallyAwaitResponse ? { ...message, [ID_KEY]: id } : message);
    });
}