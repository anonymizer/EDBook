import { Editor } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { useCallback, useRef, useState } from "react";
import * as React from 'react';
import * as classNames from 'classnames';
import { PointerEditorDecoration } from "../../dpage";
import { postAndAwaitResponse } from "../utils/webview-message-utils";
import { ShowCodeMessage } from "../../messages";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const extensions = require('./extensions.json');
const extensionToFiletype: {[ext: string]: string} = {};
for(const filetype in extensions) {
    for(const ext of extensions[filetype]) {
        extensionToFiletype[ext] = filetype;
    }
}

export type CodeFilesComponentProps = {
    editable: boolean;
    decorationsByCellId: {[cellId: string]: PointerEditorDecoration[]};
    initialSelectedFile?: string;
    onFilesChanged: (files: {[fname: string]: string}) => void;
    onEditorMount?: (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => void;
    onChangeFile?: (fname: string|undefined) => void;
    initialFiles: {[fname: string]: string};
}

type FileState = {content: string, dirty: boolean};
function fileStateToFileMap(files: {[fname: string]: FileState}): {[fname: string]: string} {
    const newFiles: {[fname: string]: string} = {};
    for(const fname of Object.keys(files)) {
        newFiles[fname] = files[fname].content;
    }
    return newFiles;
}

function fileMapToFileState(files: {[fname: string]: string}): {[fname: string]: FileState} {
    const newFiles: {[fname: string]: FileState} = {};
    for(const fname of Object.keys(files)) {
        newFiles[fname] = {content: files[fname], dirty: false};
    }
    return newFiles;
}

const CodeFilesComponent: React.FC<CodeFilesComponentProps> = ( { onFilesChanged, initialFiles, editable, onEditorMount, onChangeFile, decorationsByCellId, initialSelectedFile } ) => {

    const editorRef = useRef<null|editor.IStandaloneCodeEditor>(null);
    // const files = initialFiles
    const [files, setFiles] = useState<{[fname: string]: FileState}>(fileMapToFileState(initialFiles));

    let initialSelectedFileState: string|undefined = undefined;
    const flattenedDecorations: PointerEditorDecoration[] = Object.values(decorationsByCellId).flat();
    if(flattenedDecorations.length > 0) {
        const decoratedFile = flattenedDecorations[0].filename;
        if(Object.prototype.hasOwnProperty.call(files, decoratedFile)) {
            initialSelectedFileState = decoratedFile;
        }
    }
    if(!initialSelectedFileState && initialSelectedFile && Object.prototype.hasOwnProperty.call(files, initialSelectedFile)) {
        initialSelectedFileState = initialSelectedFile;
    }
    if(!initialSelectedFileState && Object.keys(files).length > 0) {
        initialSelectedFileState = Object.keys(files)[0];
    }
    const [selectedFile, setSelectedFile] = useState<string|undefined>(initialSelectedFileState);

    React.useEffect(() => {
        if(onChangeFile) {
            onChangeFile(selectedFile);
        }
    }, [onChangeFile, selectedFile]);

    React.useEffect(() => {
        const editor = editorRef.current;
        if(editor) {
            const allDecorationIDs = editor.getModel()?.getAllDecorations().map(d => d.id) || [];
            editor.removeDecorations(allDecorationIDs);

            const decorationCollection = editor.createDecorationsCollection(getMonacoDecorations(decorationsByCellId, selectedFile));
            const decorationRanges = decorationCollection.getRanges();
            const visibleEditorRanges = editor.getVisibleRanges();
            for(const range of decorationRanges) {
                let isVisible = false;
                for(const vRange of visibleEditorRanges) {
                    if(vRange.containsRange(range)) {
                        isVisible = true;
                        break;
                    }
                }
                if(!isVisible) {
                    editor.revealLinesInCenterIfOutsideViewport(range.startLineNumber, range.endLineNumber);
                }
            }
            // decorationCollection.onDidChange((e: editor.IModelDecorationsChangedEvent) => {
                // console.log(decorationCollection.getRange(0));
            // });
        }
    }, [decorationsByCellId, selectedFile]);
    // useTraceUpdate({decorations});

    const onSelect = useCallback((fname: string) => {
        if(fname && Object.prototype.hasOwnProperty.call(files, fname)) {
            setSelectedFile(fname);
        } else {
            setSelectedFile(undefined);
        }
    }, [files]);
    const setFileContent = useCallback((content: string) => {
        if(selectedFile) {
            const newFiles = {...files};
            // newFiles[selectedFile] = {content, dirty: content!==initialFiles[selectedFile]};
            newFiles[selectedFile] = {content, dirty: false};
            setFiles(newFiles);
            // if(onFilesChanged) { onFilesChanged(newFiles); }
            if(onFilesChanged) { onFilesChanged(fileStateToFileMap(newFiles)); }
        }
    }, [files, onFilesChanged, selectedFile]);

    const openInVSCode = useCallback(() => {
        const filesObj = fileStateToFileMap(files);
        postAndAwaitResponse({message: 'show-code', files: filesObj, decorations: []} as ShowCodeMessage);
    }, [files]);

    const onMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
        editorRef.current = editor;
        // editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, doSave);
        onEditorMount?.(editor, monaco);
        // const model = editor.getModel();

        const decorationCollection = editor.createDecorationsCollection(getMonacoDecorations(decorationsByCellId, selectedFile));
        const ranges = decorationCollection.getRanges();
        if(ranges.length > 0) {
            editor.revealLinesInCenterIfOutsideViewport(ranges[0].startLineNumber, ranges[0].endLineNumber);
        }
        // const ranges = decorationCollection.getRanges();
        // ranges.forEach((r) => {
            
        // });
        // console.log('mount');
        // decorationCollection.onDidChange((e: editor.IModelDecorationsChangedEvent) => {
            // console.log(decorationCollection.getRange(0));
        // });
    }, [decorationsByCellId, onEditorMount, selectedFile]);
    // console.log(selectedFile, files);
    const selectedFileLang = selectedFile ? breakdownFilePath(selectedFile).extension.toLowerCase() : '';

    const theme_kind = document.body.getAttribute('data-vscode-theme-kind') === 'vscode-dark' ? 'vs-dark' : 'vs-light';
    return <div className="current-code">
                <ul id='file-list'>
                    {Object.keys(files).map((fname) => (<li key={fname} className={classNames("file", selectedFile===fname && 'selected')}  onClick={() => onSelect(fname)}>
                        {/* {editable && <EditableDisplay requireDoubleClick={true} initialContent={breakdownFilePath(fname).fileName} avoidSelectingExtension={true} onChange={setFilename} />} */}
                        {breakdownFilePath(fname).fileName}
                        {files[fname].dirty && <span className='dirty'>*</span>}
                    </li>))}
                    {/* {editable && <li className='add-file'><button onClick={() => addFile()}>+</button></li>} */}
                    <li className='add-file' style={{position: 'absolute', right: '0px'}}><button className="gamma-control icon" onClick={() => openInVSCode()}><i className="codicon codicon-go-to-file" /></button></li>
                </ul>
        {
            selectedFile!==undefined && Object.prototype.hasOwnProperty.call(files, selectedFile) &&
                <Editor
                    key={selectedFile}
                    onMount={onMount}
                    options={{ scrollBeyondLastLine: false, readOnly: !editable, quickSuggestions: false, renderLineHighlight: 'none', fontSize: 16, minimap: { enabled: false }, wordWrap: 'on' }}
                    height="calc(100vh - 35px)"
                    width="100%"
                    theme={theme_kind}
                    language={extensionToFiletype[selectedFileLang] || 'plaintext'}
                    onChange={(value) => setFileContent(value || '')}
                    value={files[selectedFile].content}
                />
        }
    </div>;
};

export default CodeFilesComponent;

function breakdownFilePath(filePath: string): { fileName: string, extension: string, path: string } {
    const pathSeparator = '/';
    const lastSeparatorIndex = filePath.lastIndexOf(pathSeparator);
    const fullPath = filePath.substring(0, lastSeparatorIndex + 1);
    const fileNameWithExtension = filePath.substring(lastSeparatorIndex + 1);
    let fileName = fileNameWithExtension;
    let extension = '';
    
    const lastDotIndex = fileNameWithExtension.lastIndexOf('.');
    if (lastDotIndex !== -1) {
        fileName = fileNameWithExtension.substring(0, lastDotIndex);
        extension = fileNameWithExtension.substring(lastDotIndex + 1);
    }

    return {
        fileName: fileNameWithExtension, // include extension in the fileName
        extension,
        path: fullPath
    };
}


function getMonacoDecorations(decorations: {[cellId: string]: PointerEditorDecoration[]}, selectedFile: string|undefined): editor.IModelDeltaDecoration[] {
    const fileDecorationsByCellId: {[cellId: string]: PointerEditorDecoration[]} = {};
    for(const cellId in decorations) {
        const cellDecorations = decorations[cellId];
        const fileDecorations = cellDecorations.filter((d) => d.filename === selectedFile);
        if(fileDecorations.length > 0) {
            fileDecorationsByCellId[cellId] = fileDecorations;
        }
    }

    // const allDecorations: editor.IModelDecoration[][] = Object.values(fileDecorationsByCellId).map((d) => d.map((d) => ({
    //     const d = fileDecorationsByCellId[cellId];
    // }

    // const fileDecorations = decorations.filter((d) => d.filename === selectedFile);
    const modelDecorations: editor.IModelDeltaDecoration[] = [];
    for(const cellId in fileDecorationsByCellId) {
        const cellDecorations = fileDecorationsByCellId[cellId];
        const cellModelDecorations: editor.IModelDeltaDecoration[] = cellDecorations.map((d) => ({
            range: {startColumn: d.startColumn, startLineNumber: d.startLineNumber, endColumn: d.endColumn, endLineNumber: d.endLineNumber},
            options: {
                className: `code-pointer cell-${cellId}`, 
                inlineClassName: `code-pointer-inline`,
            }
        }));
        modelDecorations.push(...cellModelDecorations);
    }

    return modelDecorations;
}