import { useRef, useEffect } from 'react';
export const vscode = acquireVsCodeApi();

export function generateUUID(): string {
    let dt = new Date().getTime();
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

export function objectMap(object: {[key: string]: any}, mapFn: (v: any, k: string) => any) {
    return Object.keys(object).reduce(function(result: {[key: string]: any}, key: string) {
        result[key] = mapFn(object[key], key);
        return result;
    }, {})
}

/*
FORMAT: `
LEARNER: So, I'm new to JavaScript and I've heard a lot about variables. Can you explain what they are and how they work?
INSTRUCTOR: Of course! In JavaScript, variables are like containers that store values. They allow you to store, access, and manipulate data in your program. You can think of them as labels that you assign to specific pieces of information.
LEARNER: How do I create a variable in JavaScript?
INSTRUCTOR: To create a variable, you can use the let, const, or var keyword, followed by the variable name. For example, let name; creates a variable called 'name'. The let and const keywords were introduced in ES6, while var has been available since the beginning of JavaScript.
`;
*/
export function parseDialog(dialog: string, senders: string[]): {sender: string, text: string}[] {
    const messages: {sender: string, text: string}[] = [];

    const lines = dialog.trim().split('\n');

    let currentSender = null;
    let currentText = '';

    for (const line of lines) {
        const sender = senders.find(sender => line.startsWith(sender+':'));
        if (sender) {
            if (currentSender) {
                messages.push({ sender: currentSender, text: currentText.trim() });
            }
            currentSender = sender;
            currentText = line.replace(sender+":", '');
        } else {
            currentText += '\n' + line.trim();
        }
    }

    if (currentSender) {
        messages.push({ sender: currentSender, text: currentText.trim() });
    }

    return messages;
}

export function splitIntoPairs(dialog: {sender: string, text: string}[]): {LEARNER: {sender: string, text: string}, INSTRUCTOR: {sender: string, text: string}}[] {
  const pairs: {LEARNER: {sender: string, text: string}, INSTRUCTOR: {sender: string, text: string}}[] = [];
  let currentPair: {LEARNER?: {sender: string, text: string}, INSTRUCTOR?: {sender: string, text: string}} = {};

  for (const message of dialog) {
    if (message.sender === "LEARNER") {
        currentPair.LEARNER = message;
    } else if (message.sender === "INSTRUCTOR") {
        currentPair.INSTRUCTOR = message;
    }

    if (currentPair.LEARNER && currentPair.INSTRUCTOR) {
        pairs.push(currentPair as {LEARNER: {sender: string, text: string}, INSTRUCTOR: {sender: string, text: string}});
        currentPair = {};
    }
  }

  return pairs;
}

export function isFunction(input: any): boolean {
    return typeof input === 'function';
}

function fuzzyStringMatch(str1: string, str2: string, threshold = 0.8): boolean {
    const levenshteinDistance = (a: string, b: string): number => {
        const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
            }
        }

        return matrix[a.length][b.length];
    };

    const distance: number = levenshteinDistance(str1, str2);
    const maxLen: number = Math.max(str1.length, str2.length);

    return (maxLen - distance) / maxLen >= threshold;
}

function fuzzyAttributeMatch(attrs1: NamedNodeMap, attrs2: NamedNodeMap, threshold = 0.8): boolean {
    if(attrs1.length === 0 && attrs2.length === 0) return true;
    let matchScore = 0;
    for (let i = 0; i < attrs1.length; i++) {
        const attr = attrs1[i];
        if (Array.from(attrs2).some(a => fuzzyStringMatch(attr.name, a.name, threshold) &&
            fuzzyStringMatch(attr.value, a.value, threshold))) {
            matchScore++;
        }
    }
    return (matchScore / attrs1.length) >= threshold;
}

export function fuzzyDOMMatch(element1: Element | null, element2: Element | null, threshold = 0.8): boolean {
    if (!element1 || !element2) return false;

    if (element1.tagName !== element2.tagName) return false;

    if (!fuzzyStringMatch(element1.textContent || '', element2.textContent || '', threshold)) return false;

    if (!fuzzyAttributeMatch(element1.attributes, element2.attributes, threshold)) return false;

    const children1 = element1.children;
    const children2 = element2.children;

    if (children1.length !== children2.length) return false;

    for (let i = 0; i < children1.length; i++) {
        if (!fuzzyDOMMatch(children1[i], children2[i], threshold)) return false;
    }

    return true;
}

export function parseStringToDOM(s: string) {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(s, 'text/html');
    
    const newDiv = document.createElement('div');
    const children = Array.from(parsedDocument.body.children);
    newDiv.append(...children);
    return newDiv;
}

export function getAllParents(el: Element|null): Element[] {
    const parents: Element[] = [];
    let currentParent = el;
    while (currentParent) {
        parents.push(currentParent);
        currentParent = currentParent.parentElement;
    }
    return parents;
}

export function uint8ToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return window.btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
    const binary_string =  window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array( len );
    for (let i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

export function encodeURL(url: string): string {
    const parts = url.split('/');
    for (let i = 0; i < parts.length; i++) {
        parts[i] = encodeURIComponent(parts[i].replace(/ /g, '-'));
    }
    return parts.join('/');
}

export function estimateStringSpaceUsage(str: string): string {
    let totalLength = 0;
    for (const symbol of str) {
        totalLength += symbol.length === 2 ? 4 : 2;
    }
    
    const sizeInMB = totalLength / 1048576;
    
    if (sizeInMB > 1) {
        return sizeInMB.toFixed(3) + ' MB';
    } else {
        return (sizeInMB * 1024).toFixed(3) + ' KB';
    }
}

export function getEditorTheme(): 'vs-dark' | 'vs-light' {
    return document.body.getAttribute('data-vscode-theme-kind') === 'vscode-dark' ? 'vs-dark' : 'vs-light';
}


//https://stackoverflow.com/a/51082563/570461
export function useTraceUpdate(props: any) {
    const prev = useRef(props);
    useEffect(() => {
        const changedProps = Object.entries(props).reduce((ps: any, [k, v]: [string, any]) => {
            if (prev.current[k] !== v) {
                ps[k] = [prev.current[k], v];
            }
            return ps;
        }, {});
        if (Object.keys(changedProps).length > 0) {
            console.log('Changed props:', changedProps);
        }
        prev.current = props;
    });
}

export class Queue<T> {
    public constructor(private readonly data: T[] = []) {}
    public enqueue(...elements: T[]): void { this.data.push(...elements); }
    public dequeue(): T | undefined { return this.data.shift(); }
    public isEmpty(): boolean { return this.data.length === 0; }
}

export function interpolate(num: number, low: number, high: number, numMin = 0, numMax = 100): number {
    return low + (high - low) * (num - numMin) / (numMax - numMin);
}