import axios, { AxiosResponse } from "axios";
import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum, CreateChatCompletionResponse } from "openai";
import { GammaPage } from "../../dpage";
import { GammaInstructorID, GammaUserID } from "../../constants";
import { postAndAwaitResponse } from "./webview-message-utils";
import { APIKeyMessage, GetAPIKeyMessage } from "../../messages";
import { patchFileState } from "./code-diff-utils";

async function getChatCompletion(apiKey: string, messages: ChatCompletionRequestMessage[], model: string): Promise<AxiosResponse<CreateChatCompletionResponse, any>> {
    const response = await axios({
        method: 'post',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        data: { model, messages, temperature: 0.7 }
    })

    return response;
}

export async function chatCompletion(page: GammaPage, content: string, toId: string, model: string): Promise<{error: boolean, response: string}> {
    const { userState, cellsById } = page;
    const { visibleCellIds, cellStates } = userState;
    let files: {[fname: string]: string} = {};
    const messages: ChatCompletionRequestMessage[] = [];
    const agentDescription = page.participants[GammaInstructorID].description;
    if(agentDescription) {
        messages.push({ role: ChatCompletionRequestMessageRoleEnum.System, content: agentDescription });
    }
    for(let i = 0; i<visibleCellIds.length; i++) {
        const cellId = visibleCellIds[i];
        const c = cellsById[cellId];
        files = patchFileState(files, c.fileDiff);
        const source = c.source instanceof Array ? c.source.join('\n') : c.source;
        const role: ChatCompletionRequestMessageRoleEnum = c.senderId === GammaUserID ? ChatCompletionRequestMessageRoleEnum.User : ChatCompletionRequestMessageRoleEnum.Assistant;
        messages.push({ role, content: source });
        if(cellId === toId) {
            break;
        }
    }
    const filesContent = Object.keys(files).map(fname => `File: ${fname}\n\`\`\`\n${files[fname]}\n\`\`\``).join('\n\n');
    messages.push({ role: ChatCompletionRequestMessageRoleEnum.User, content: `${filesContent ? filesContent+"\n\n" : ""}${content}` });
    // console.log(messages);

    const { apiKey } = await postAndAwaitResponse({message: 'get-api-key'} as GetAPIKeyMessage) as APIKeyMessage;

    try {
        
        const chatCompletion = await getChatCompletion(apiKey, messages, model);
        const {content: llmResponse} = chatCompletion.data.choices[0].message!;
        return {error: false, response: llmResponse || ''};
    } catch(e: any) {
        let { message } = e.response.data.error;

        if(message.startsWith('Incorrect API key')) {
            message = `OpenAI ERROR: ${message}\n\nThen, enter your API key in the VS Code Settings (**Settings -> Extensions -> Gamma -> Api Key**).`
        }

        if(message.startsWith('You exceeded your')) {
            message = `OpenAI ERROR: ${message}`
        }

        
        return {error: true, response: message};
        // dispatch(setCellContent({cellId: llmResponseID, content: message}));
        // if(index === undefined) {
        //     setTimeout(() => {
        //         window.scrollTo(0, document.body.scrollHeight);
        //     }, 100);
        // }
    }
}

export async function fakeChatCompletion(page: GammaPage, content: string, toId: string, model: string): Promise<{error: boolean, response: string}>{
    const markupOptions = [(s: string) => `**${s}**`, (s: string) => `*${s}*`, (s: string) => `\`${s}\``, (s: string) => `\n\`\`\`\n${repeat(s, 50)}\n\`\`\`\n`, (s: string) => `\n# ${s}\n`, (s: string) => `\n## ${s}\n` ];
    function genRandomString(length: number): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const charLength = chars.length;
        let result = '';
        for (let i = 0; i < length; i++ ) {
            result += chars.charAt(Math.floor(Math.random() * charLength));
        }
        return result;
    }
    const numChunks = Math.round(10 + Math.random() * 10);
    const words = [model];
    for(let i = 0; i<numChunks; i++) {
        const numWords = Math.round(1 + Math.random() * 10);
        const wordsInChunk = [];
        for(let j = 0; j<numWords; j++) {
            const word = genRandomString(Math.round(1 + Math.random() * 10));
            wordsInChunk.push(Math.random() < 0.1 ? markupOptions[Math.round(Math.random() * (markupOptions.length - 1))](word) : word);
            if(Math.random() < 0.05) {
                wordsInChunk.push('\n');
            }
        }
        words.push(wordsInChunk.join(' ')+'. ');
    }

    function repeat(s: string, n: number): string {
        return new Array(n + 1).join(s);
    }

    return {error: false, response: words.join(' ') };
}