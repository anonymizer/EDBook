import { EditorDecoration, GammaCell, GammaParticipant, GammaParticipantList, PointerEditorDecoration } from "../dpage";
import * as monaco from 'monaco-editor';
import * as React from "react";
import * as classNames from "classnames";
import { useDispatch } from "react-redux";
import { VSCodeButton, VSCodeDivider, VSCodeDropdown, VSCodeOption, VSCodePanelTab, VSCodePanelView, VSCodePanels, VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import { Editor } from "@monaco-editor/react";
import MarkdownComponent from "./widgets/MarkdownDisplay";
import { PageState, updateCellCodeFiles, setCellContent, setCellSender, setTerminalCellId, setCellPointers, setIsAIContent } from "./store";
import { GammaNobodyID, GammaUserID } from "../constants";
import { useSelector } from "react-redux";
import { EditableDisplay } from "./widgets/EditableDisplay";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { FileDiffDisplay } from "./widgets/FileDiffDisplay";
import ImageUpload from "./widgets/ImageUpload";
import { getEditorTheme } from "./utils/dpage-utils";
import { TypingEffectOptions } from "./widgets/TypingEffect";
import { useTranslation } from "react-i18next";

export const LOADING_STR = 'Loading...';
const AI_CONTENT_WARNING = 'This cell contains AI-generated content that has not been verified.';

// export type UserCellState = {
//     directiveStates: {[key: string]: any};
// }
monaco.editor.defineTheme('gammaTheme', {
    base: "vs-dark",
    inherit: false,
    rules: [],
    colors: {}
});

interface CellProps {
    hasCode: boolean;
    changesCode: boolean;
    id: string;
    sender: GammaParticipant;
    source: string;
    editorPointers: PointerEditorDecoration[];
    filename: string;
    halted: boolean;
    isSelected: boolean;
    branches: boolean;
    branchesAwayFromTerminal: boolean;
    showSender: boolean;
    dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
    codeEditorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor>;
    editingFilenameRef: React.RefObject<string|undefined>;
    beforeCode: {[fname: string]: string};
    afterCode: {[fname: string]: string};
    onSelect?: (cellId: string) => void;
    onDelete?: (cellId: string) => void;
    onFilesChanged?: (cellId: string) => void;
    isAIContent: boolean;
    animateText: boolean | TypingEffectOptions;
    // onAddCodePointer?: (cellId: string) => void;
}

export const CellComponent: React.FC<CellProps> = ( { filename, id, sender, source, halted, hasCode, editorPointers, changesCode, isSelected, onSelect, branches, branchesAwayFromTerminal, onFilesChanged, dragHandleProps, onDelete, beforeCode, afterCode, showSender, codeEditorRef, editingFilenameRef, isAIContent, animateText } ) => {
    const {t} = useTranslation();
    const dispatch = useDispatch();
    const [showMenu, setShowMenu] = React.useState<boolean>(false);
    const [currentlyEditing, setCurrentlyEditing] = React.useState<boolean>(false);
    // const [showCode, setShowCode] = React.useState<{[fname: string]: string}>({});
    const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor|null>(null);
    const participants = useSelector<PageState, GammaParticipantList>((state: PageState) => state.page.participants);

    const handleFilesChanged = React.useCallback((files: {[key: string]: string}) => {
        dispatch(updateCellCodeFiles({cellId: id, files}));
        onFilesChanged && onFilesChanged(id);
    }, [id, dispatch, onFilesChanged]);
    const handlePointersChanged = React.useCallback((pointers: PointerEditorDecoration[]) => {
        dispatch(setCellPointers({cellId: id, pointers}));
    }, [id, dispatch]);
    const mouseEnter = React.useCallback(() => {
        setShowMenu(true);
    }, []);
    const mouseLeave = React.useCallback(() => {
        setShowMenu(false);
    }, []);
    const click = React.useCallback(() => {
        if(!isSelected) {
            onSelect && onSelect(id);
        }
    }, [id, isSelected, onSelect]);
    const beginEdit = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // if(editableDisplayRef.current) {
        setCurrentlyEditing(true);
            // editableDisplayRef.current.startEditing();
        // }
    }, []);
    const doneEditing = React.useCallback(() => {
        setCurrentlyEditing(false);
        if(editorRef.current) {
            // const source: string = typeof cell.source === 'string' ? cell.source : cell.source.join('\n');
            const content = editorRef.current.getValue();
            dispatch(setCellContent({cellId: id, content }));
        }
    }, [id, dispatch]);
    const doRemove = React.useCallback(() => {
        onDelete && onDelete(id);
    }, [id, onDelete]);

    const markAsTerminal = React.useCallback(() => {
        dispatch(setTerminalCellId({cellId: id}));
    }, [id, dispatch]);
    const toggleAIGenerated = React.useCallback(() => {
        dispatch(setIsAIContent({isAIContent: !isAIContent, cellId: id}));
    }, [dispatch, id, isAIContent]);

    // const addCodePointer = React.useCallback(async () => {
    //     onAddCodePointer && onAddCodePointer(cell.id);
    // }, [cell.id, onAddCodePointer]);

    const senderColor = sender.color;

    return <div className={classNames("speech-bubble", {"selected": isSelected, "nobody": sender.id===GammaNobodyID, "user": sender.id===GammaUserID})} onMouseEnter={mouseEnter} onMouseLeave={mouseLeave} onClick={click} style={ (sender.id === GammaNobodyID || sender.id === GammaUserID) ? {} : {"borderLeft": `1.5px solid ${senderColor}`}}>
            <div className="drag-handle"{...dragHandleProps}></div>
            {/* <span className={classNames("avatar")} >
                <i className={classNames("codicon", "codicon-account")} style={{color: sender.color}} />
            </span> */}
            { showSender && sender.id !== GammaNobodyID && sender.id !== GammaUserID && <span className="sender-name" style={{color: senderColor}}>{sender.name}:</span> }
            {showMenu && !currentlyEditing &&
                <div className="menu">
                    <VSCodeButton appearance="icon" className="menu-button" onClick={beginEdit}><i className="codicon codicon-edit"></i></VSCodeButton>
                    {/* <VSCodeButton className="menu-button" onClick={onClickCodeButton}>Code</VSCodeButton> */}
                    {/* <VSCodeButton appearance="icon" className="menu-button" onClick={()=>dispatch(addDialog({cellId: cell.id}))}><i className="codicon codicon-hubot"></i></VSCodeButton> */}
                </div>
            }
            { currentlyEditing && 
                <VSCodePanels>
                    <VSCodePanelTab tabId="edit-message" tabLabel="Message">{t('message')}</VSCodePanelTab>
                    <VSCodePanelTab tabId="edit-code" tabLabel="Code">{t('code')}</VSCodePanelTab>
                    <VSCodePanelTab tabId="edit-media" tabLabel="Image">{t('images')}</VSCodePanelTab>
                    <VSCodePanelTab tabId="edit-more" tabLabel="More">{t('more')}</VSCodePanelTab>
                    <VSCodePanelView tabId="edit-message" tabLabel="Message">
                        <Editor options={{ lineNumbers: 'off', quickSuggestions: false, renderLineHighlight: 'none', fontSize: 16, minimap: { enabled: false }, wordWrap: 'on' }}
                                height="25vh"
                                defaultLanguage="markdown"
                                theme={getEditorTheme()}
                                defaultValue={source || ''}
                                onMount={(editor, monaco) => {
                                    editorRef.current = editor;
                                }}
                                />
                        <hr className="gamma-control" />
                         <VSCodeButton appearance="primary" onClick={doneEditing}>{t('done')}</VSCodeButton>
                    </VSCodePanelView>
                    <VSCodePanelView tabId="edit-code" tabLabel="Code Files">
                        <CodeFileListComponent onChange={handleFilesChanged} files={afterCode} />
                        <CodePointerListComponent codeEditorRef={codeEditorRef} editingFilenameRef={editingFilenameRef} onChange={handlePointersChanged} pointers={editorPointers} />
                        <hr className="gamma-control" />
                        <VSCodeButton appearance="primary" onClick={doneEditing}>{t('done')}</VSCodeButton>
                    </VSCodePanelView>
                    <VSCodePanelView tabId="edit-media" tabLabel="Images">
                        <ImageUpload />
                        <VSCodeDivider />
                        <VSCodeButton appearance="primary" onClick={doneEditing}>{t('done')}</VSCodeButton> 
                    </VSCodePanelView>
                    <VSCodePanelView tabId="edit-more" tabLabel="More" style={{height: '250px'}}>
                        <div>{t('cellID')}: {id}</div>
                        <VSCodeDropdown value={sender.id} onChange={(e: any) => dispatch(setCellSender({cellId: id, sender: (e.target.value as string)}))}>
                            {
                               Object.keys(participants).map((key: string) => {
                                    const p = participants[key];
                                    return <VSCodeOption key={p.id} value={p.id}>{p.name}</VSCodeOption>;
                                })
                            }
                        </VSCodeDropdown>
                        <VSCodeDivider />
                        {/* <VSCodeButton appearance="secondary" className="menu-button" onClick={addCodePointer}><i className="codicon codicon-references"></i> Add Code Pointer</VSCodeButton>
                        <VSCodeDivider /> */}
                        <label onClick={toggleAIGenerated}><input type="checkbox" className="gamma-control" checked={isAIContent}></input> {t('aiContent')}</label>
                        <VSCodeButton appearance="secondary" className="menu-button" onClick={markAsTerminal}><i className="codicon codicon-check-all"></i> {t('markAsTerminalCell')}</VSCodeButton>
                        <VSCodeDivider />
                        <VSCodeButton appearance="secondary" className="menu-button" onClick={doRemove}><i className="codicon codicon-trash"></i> {t('deleteCell')}</VSCodeButton>
                        <VSCodeDivider />
                        <VSCodeButton appearance="primary" onClick={doneEditing}>{t('done')}</VSCodeButton> 
                    </VSCodePanelView>
                </VSCodePanels>
            }
            { !currentlyEditing && source === LOADING_STR && <VSCodeProgressRing />}
            {
                !currentlyEditing && <div className="cell-content"><MarkdownComponent prefix={`${id}`} useTypingEffect={animateText}>{source}</MarkdownComponent></div>
            }
            { !currentlyEditing && changesCode && isSelected && <><hr className="gamma-control" /><FileDiffDisplay oldFiles={beforeCode} newFiles={afterCode} /></> }
            {/* { (hasCode || changesCode) && <span className={classNames("code-badge", !changesCode && 'no-change')}><i className={classNames("codicon", "codicon-code")} /></span> } */}
            { branches && <span className={classNames("gamma-badge", "branches-badge", branchesAwayFromTerminal && "branches-away")}><i className={classNames("codicon", "codicon-type-hierarchy-sub")} /></span> }
            { isAIContent && isSelected && <div className="ai-content-warning"><hr className="gamma-control" /><i className={classNames("codicon", "codicon-warning")} />&nbsp;{AI_CONTENT_WARNING}</div> }
        </div>;
};

const CodeFileListComponent: React.FC<{files: {[fname: string]: string}, onChange: (newfiles: {[fname: string]: string}) => void}> = ({onChange, files }) => {
    // const [files, setFiles] = React.useState<{[fname: string]: string}>(initFiles);
    // const filesSelector = useSelector<PageState, {[fname: string]: string}>((state: PageState) => state.page.cellsById[cellId].metadata.);
    const {t} = useTranslation();
    const addFile = React.useCallback(() => {
        let fileExtension = 'html';
        if(Object.keys(files).length > 0) {
            const selectedFileExtension = breakdownFilePath(Object.keys(files)[0]).extension.toLowerCase();
            fileExtension = selectedFileExtension;
        }
        const file_index = Object.keys(files).length + 1;
        let newFileName = `file_${file_index}.${fileExtension}`;
        let i = 0;
        while(Object.prototype.hasOwnProperty.call(files, newFileName)) {
            i++;
            newFileName = `file_${file_index}_${i}.${fileExtension}`;
        }

        const newFiles = {...files, [newFileName]: ''};
        onChange(newFiles);
    }, [files, onChange]);

    const removeFile = React.useCallback((fname: string) => {
        const newFiles = {...files};
        delete newFiles[fname];
        onChange(newFiles);
    }, [files, onChange]);

    const renameFile = React.useCallback((fname: string, newFileName: string) => {
        const newFiles = {...files};
        if(newFileName !== fname) {
            newFiles[newFileName] = newFiles[fname];
            delete newFiles[fname];
            onChange(newFiles);
        }
    }, [files, onChange]);

    return <ul className="file-list">
        { Object.keys(files).map((fname, i) =>
                <li key={fname} className='file'>
                    <EditableDisplay initialContent={fname} avoidSelectingExtension={true} onChange={(newFileName) => renameFile(fname, newFileName)} />
                    <VSCodeButton appearance="secondary" onClick={() => removeFile(fname)}><i className="codicon codicon-trash"/> {t('remove')}
                </VSCodeButton></li>) }
        <li><VSCodeButton onClick={() => addFile()}><i className='codicon codicon-add' />{t('addFile')}</VSCodeButton></li>
    </ul>;
};

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

type CodePointerListProps = {
    codeEditorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor>;
    editingFilenameRef: React.RefObject<string|undefined>;
    pointers: PointerEditorDecoration[]|undefined;
    onChange: (newPointers: PointerEditorDecoration[]) => void;
}
const CodePointerListComponent: React.FC<CodePointerListProps> = ({onChange, pointers: initPointers, codeEditorRef, editingFilenameRef}) => {
    const {t} = useTranslation();
    const [pointers, setPointers] = React.useState<PointerEditorDecoration[]>(initPointers || []);
    const addCodePointer = React.useCallback(() => {
        const editor = codeEditorRef.current;
        const editingFilename = editingFilenameRef.current;
        if(editor && editingFilename) {
            const selections = editor.getSelections() || [];

            const decorations: PointerEditorDecoration[] = selections.map((selection) => {
                if(!selection.isEmpty()) {
                    const { startLineNumber, startColumn, endLineNumber, endColumn } = selection;
                    const filename = editingFilename;
                    const decoration: PointerEditorDecoration = { type: 'pointer', filename, startLineNumber, startColumn, endLineNumber, endColumn };
                    return decoration;
                } else {
                    return false;
                }
            }).filter((decoration) => decoration !== false) as PointerEditorDecoration[];
            if(decorations.length > 0) {
                const newPointers = [...pointers, ...decorations];
                setPointers(newPointers);
                onChange && onChange(newPointers);
            }
        }
    }, [codeEditorRef, editingFilenameRef, onChange, pointers]);

    const removePointer = React.useCallback((pointerIndex: number) => {
        const newPointers = [...pointers];
        newPointers.splice(pointerIndex, 1);
        setPointers(newPointers);
        onChange && onChange(newPointers);
    }, [onChange, pointers]);


    return <ul className="pointer-list">
        { pointers.map((pointer, i) => (
            <li key={i} className='pointer'>
                <span className="pointer-filename">{pointer.filename}</span>,&nbsp;
                <span className="pointer-range">{t('line')} {pointer.startLineNumber} ({t('character')} {pointer.startColumn}) - {t('line')} {pointer.endLineNumber} ({t('character')} {pointer.endColumn})</span>
                <button className="gamma-control secondary" onClick={() => removePointer(i)}><i className="codicon codicon-trash"/>{t('Remove')}</button>
            </li>
        ))}
        {/* { Object.keys(pointers).map((pointer, i) =>
                <li key={fname} className='file'>
                    <EditableDisplay initialContent={fname} avoidSelectingExtension={true} onChange={(newFileName) => renameFile(fname, newFileName)} />
                    <VSCodeButton appearance="secondary" onClick={() => removeFile(fname)}><i className="codicon codicon-trash"/> Remove
                </VSCodeButton></li>) }
        <li><VSCodeButton onClick={() => addFile()}><i className='codicon codicon-add' />&nbsp;Add file</VSCodeButton></li> */}
        <li><button className="gamma-control" onClick={() => addCodePointer()}><i className='codicon codicon-add' />{t('addCodePointer')}</button></li>
    </ul>;
};