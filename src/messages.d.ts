import { OpenDialogOptions, Range } from "vscode";
import { EditorDecoration, EditorRange, GammaPage, PointerEditorDecoration } from "./dpage"

export const ID_KEY = '__id__';
export interface Message {
    [ID_KEY]?: string
    message: string
}

export interface ReadyMessage extends Message {
    message: 'ready'
}
export interface InitialDataMessage extends Message {
    message: 'initial_data',
    data: GammaPage
}
export interface PageChangedMessage extends Message {
    message: 'page_changed'
}
export interface GetPageMessage extends Message {
    message: 'get_page'
}
export interface PageDataMessage extends Message {
    message: 'page_data',
    data: GammaPage|null
}
export interface QueryLLMMessage extends Message {
    message: 'query-llm',
    query: string,
    priorMessages: {
        role: string | undefined;
        content: string | string[];
    }[]
}
export interface LLMResponseMessage extends Message {
    message: 'llm-response',
    response: string,
    error?: string
}
export interface ShowCodeMessage extends Message {
    message: 'show-code',
    files: {
        [filename: string]: string
    },
    decorations: EditorDecoration[]
}
export interface CodeChangeMessage extends Message {
    message: 'code-changed',
    filename: string,
    content: string
}

export interface GetAPIKeyMessage extends Message {
    message: 'get-api-key'
}

export interface APIKeyMessage extends Message {
    message: 'api-key'
    apiKey: string
}

export interface AddCodePointerMessage extends Message {
    message: 'add-code-pointer'
}

export interface SelectedCodeResponseMessage extends Message {
    message: 'currently-selected-code',
    regions: PointerEditorDecoration[]
}

export interface UploadFileMessage extends Message {
    message: 'upload-file',
    options: OpenDialogOptions
}

export interface UploadedFilesResponse extends Message {
    message: 'uploaded-files',
    files: {
        [fullPath: string]: {
            filename: string,
            content: Uint8Array
        }
    }
}

export interface ShowAlertMessage extends Message {
    message: 'show-alert',
    content: string,
    type: 'info' | 'warning' | 'error'
}