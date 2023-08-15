import { Message } from "../../messages";
import { generateUUID, vscode } from "./dpage-utils";

const ID_KEY = '__id__';
export function postAndAwaitResponse(message: Message, actuallyAwaitResponse = true): Promise<any> {
    return new Promise((resolve, reject) => {
        let id = '';

        if(actuallyAwaitResponse) {
            id = generateUUID();
            const listener = (event: any) => {
                if (event.data[ID_KEY] === id) {
                    window.removeEventListener('message', listener);
                    const dataCopy = {...event.data};
                    delete dataCopy[ID_KEY];
                    resolve(dataCopy);
                }
            };

            window.addEventListener('message', listener);
        }

        vscode.postMessage(actuallyAwaitResponse ? { ...message, [ID_KEY]: id } : message);
    });
}

export function listenForRespondableMessages(callback: (e: Message, respond: ((response: any) => void)) => void): () => void {
    const listener = (e: any) => {
        const id = e.data[ID_KEY];

        const messageCopy = {...e.data};
        delete messageCopy[ID_KEY];

        callback(messageCopy, (response: any) => {
            vscode.postMessage({ ...response, [ID_KEY]: id });
        });
    }
    window.addEventListener('message', listener);
    return () => {
        window.removeEventListener('message', listener);
    }
}