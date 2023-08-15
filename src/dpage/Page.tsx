/* eslint-disable no-debugger */
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { GammaCell, GammaPage, GammaParticipantList, PointerEditorDecoration } from '../dpage';
import { GammaNobodyID, GammaUserID } from '../constants';
import { generateUUID, interpolate, parseDialog  } from './utils/dpage-utils';
import { useDispatch, useStore } from 'react-redux';
import { DragDropContext, Draggable, DropResult, Droppable } from 'react-beautiful-dnd';
import { patchFileState } from './utils/code-diff-utils';
import { CellComponent, LOADING_STR } from './Cell';
import * as classNames from 'classnames';
import { chatCompletion, fakeChatCompletion } from './utils/openai_api';
import { ResponseType, SendMessageWidget } from './SendMessageWidget';
import { PageState, updateCellCodeFiles, addCell, setCellContent, setCellIndex, deleteCell, advanceToNextDecisionPoint, spliceInCell, setSelectedCell } from './store';
import { useSelector } from 'react-redux';
import { HeaderComponent } from './Header';
import CodeFilesComponent from './widgets/CodeFilesDisplay';
import { IDisposable, editor } from 'monaco-editor';
import SplitView from './widgets/SplitView';
import SVGOverlay from './widgets/SVGOverlay';
import { TypingEffectOptions } from './widgets/TypingEffect';
import MarkdownComponent from './widgets/MarkdownDisplay';
import { useTranslation } from 'react-i18next';
// import { ParticipantsComponent } from './Participants';
// import { PromptTemplate } from 'langchain/prompts';

const FASTEST_TYPING_SPEED = 2;
const SLOWEST_TYPING_SPEED = 50;
const FASTEST_DELAY_BETWEEN_MESSAGES = 100;
const SLOWEST_DELAY_BETWEEN_MESSAGES = 1500;

let animateText = true;
let delayBetweenMessage = Math.round((SLOWEST_DELAY_BETWEEN_MESSAGES + FASTEST_DELAY_BETWEEN_MESSAGES)/2);
let model = "gpt-3.5-turbo";

const FIRST_MESSAGE_DELAY = 250;
// const DELAY_BETWEEN_MULTIPLE_MESSAGES = 800;
const DEFAULT_TYPING_EFFECT_OPTIONS: TypingEffectOptions = {
    timePerCharacter: Math.round((FASTEST_TYPING_SPEED + SLOWEST_TYPING_SPEED) / 2),
    startDelay: 0,
    maxAnimationTime: 10000
};

interface PageProps {
    filename: string;
    initialContent: GammaPage|false;
}

interface Dialog {
    sender: string;
    text: string;
}

function getDialogPrompt(topic: string): string {
    return `Task: Create a dialog between two people: a learner and an instructor. The dialog should involve multiple choice quiz questions to test their understanding.

    Multiple-choice format:
    :::multiple-choice
    <QUESTION>
    ::option[content]{{correct feedback="..."}}
    ::option[content]{{feedback="..."}}
    ...
    :::

    Topic: ${topic}

    Dialog format:\n`;
}

const Page: React.FC<PageProps> = ( { filename } ) => {
    const dispatch = useDispatch();
    const store = useStore<PageState>();
    const [currentEditor, setEditor] = useState<editor.IStandaloneCodeEditor|null>(null);
    const editorRef = React.useRef<null|editor.IStandaloneCodeEditor>(null);
    const currentFileRef = React.useRef<string|undefined>(undefined);
    const defaultSenderRef = React.useRef<string>(GammaUserID);
    const participants = useSelector<PageState, GammaParticipantList>((state: PageState) => state.page.participants);
    const selectedCellId = useSelector<PageState, string|false>((state: PageState) => state.page.userState.selectedCellId);
    const highlightedCellIds = useSelector<PageState, string[]>((state: PageState) => state.page.userState.highlightedCellIds);
    const visibleCellIds = useSelector<PageState, string[]>((state: PageState) => state.page.userState.visibleCellIds);
    const [timePerCharacter, setTimePerCharacter] = useState<number>(DEFAULT_TYPING_EFFECT_OPTIONS.timePerCharacter || SLOWEST_TYPING_SPEED);
    const {t} = useTranslation();

    // const { cellsById, userState, terminalCellId } = page; 

    const svgOverlayRef = React.useRef<SVGOverlay>(null);
    const pageRef = React.useRef<HTMLDivElement>(null);
    const codeElemRef = React.useRef<HTMLDivElement>(null);
    const state = store.getState();


    const doSelectCell = useCallback((cellId: string|null) => {
        dispatch(setSelectedCell({cellId}));
    }, [dispatch]);

    useEffect(() => {
        dispatch(advanceToNextDecisionPoint());
    }, [dispatch, doSelectCell, store]);


    useEffect(() => {
        if(selectedCellId) {
            if(selectedCellId === visibleCellIds[visibleCellIds.length-1]) {
                scrollToBottom(pageRef.current, 100);
            } else {
                scrollToId(pageRef.current, selectedCellId);
            }
        }
    }, [selectedCellId, visibleCellIds]);


    const doAddCell = useCallback(async (o: {parentId: string | false, responses: ResponseType, content: string, spliceIn: boolean}) => {
        const { content, responses, parentId, spliceIn } = o;
        const sender = defaultSenderRef.current || GammaUserID;

        const { page } = store.getState();
        let addedCellId = generateUUID();
        if(spliceIn) {
            dispatch(spliceInCell({ parentId, content, id: addedCellId, sender}));
        } else {
            dispatch(addCell({ parentId, content, id: addedCellId, sender}));
        }
        dispatch(setSelectedCell({cellId: addedCellId}));

        if(responses === ResponseType.One) {
            const llmResponseID = generateUUID();
            dispatch(addCell({id: llmResponseID, parentId: addedCellId, content: LOADING_STR, sender: 'instructor'}));
            dispatch(setSelectedCell({cellId: llmResponseID}));
            const { response }  = await chatCompletion(page, content, addedCellId, model);
            dispatch(setCellContent({cellId: llmResponseID, content: response, isAIContent: true }));
        }

        if(responses === ResponseType.Many) {
            let filledPrompt: string = getDialogPrompt(content);
            
            for (const participantId in participants) {
                if (participantId !== GammaNobodyID) {
                    filledPrompt += `${participants[participantId].name}: ...\n`;
                }
            }

            //add a LOADING_STR and later set to a fixed message
            const loadingCellId = generateUUID();
            dispatch(addCell({id: loadingCellId, parentId: addedCellId, content: LOADING_STR, sender: GammaNobodyID}));
            scrollToId(pageRef.current, loadingCellId, 10);
            addedCellId = loadingCellId;

            let { response } = await chatCompletion(page, filledPrompt, addedCellId, model);
            // response = response.replace(/\{\{([^\}]+)\}\}/g, '{$1}');
            
            const regexPattern = /::option\[content="([^"]*)"(, correct)?\]/g;

            response = response.replace(regexPattern, function(match, p1, p2) {
                if(p2) {
                    return `::option[${p1}]{correct feedback="your feedback here"}`;
                } else {
                    return `::option[${p1}]{feedback="your feedback here"}`;
                }
            });
            
            const senderNames = Object.values(participants).map(p => p.name);
            const responsePairs: Dialog[] = parseDialog(response, senderNames);
            dispatch(setCellContent({cellId: addedCellId, content: "The following is an example." }));

            for (const responsePair of responsePairs) {
                responsePair.text = responsePair.text.replace(/\{\{correct feedback="([^"]*)"\}\}/g, '{correct feedback="$1"}');
                responsePair.text = responsePair.text.replace(/\{\{feedback="([^"]*)"\}\}/g, '{feedback="$1"}');

                const llmResponseID = generateUUID();
                const senderParticipantId = Object.keys(participants).find(key => participants[key].name === responsePair.sender) || GammaNobodyID;

                dispatch(addCell({id: llmResponseID, parentId: addedCellId, content: LOADING_STR, sender: senderParticipantId}));


                dispatch(setCellContent({cellId: llmResponseID, content: responsePair.text }));
                scrollToId(pageRef.current, llmResponseID, 10);
                addedCellId = llmResponseID;
            }
        }
    }, [participants, dispatch, store]);

    const onAdvance = useCallback((id: string) => {
        dispatch(advanceToNextDecisionPoint({cellId: id}));
    }, [dispatch]);

    const handleOnDragEnd = React.useCallback((result: DropResult) => {
        if (!result.destination) return;
        const cellId = store.getState().page.userState.visibleCellIds[result.source.index];
        dispatch(setCellIndex({ cellId, destinationIndex: result.destination.index }));
        dispatch(advanceToNextDecisionPoint());
    }, [dispatch, store]);

    const onDeleteCell = useCallback((cellId: string) => {
        dispatch(deleteCell({cellId}));
        dispatch(advanceToNextDecisionPoint());
    }, [dispatch]);


    const onFilesChanged = useCallback((files: {[key: string]: string}) => {
        if(selectedCellId) {
            dispatch(updateCellCodeFiles({cellId: selectedCellId, files}));
        }
    }, [dispatch, selectedCellId]);



    const cellSpecs = getCellSpecs(state, selectedCellId, highlightedCellIds, timePerCharacter);
    const cells = useSelector<PageState, (GammaCell|false)[]>((state) => {
        return cellSpecs.map((spec) => {
            if(spec.type === 'cell') {
                return state.page.cellsById[spec.cellId];
            } else {
                return false;
            }
        });
    });

    let lastSenderId: string|null = null;
    let files: {[fname: string]: string} = {};
    let currentFilesState: {[fname: string]: string} = {};
    const editorDecorationsByCellId: {[cellId: string]: PointerEditorDecoration[]} = {};
    const cellElements: (JSX.Element|false)[] = cellSpecs.map((spec, i) => {
        const { type } = spec;
        if(type === 'add') {
            const { suggestedNext, parentId, selectedNext } = spec;
            return <div key={`add-cell-${i}`} className="add-cell always-show"><SendMessageWidget nextSuggestionCellIDs={suggestedNext} selectedNext={selectedNext} onAdvance={onAdvance} onAddCell={(content: string, responses: ResponseType, spliceIn: boolean) => doAddCell({content, responses, parentId, spliceIn})} /></div>;
        } else if(type === 'cell') {
            const { type, hasCode, changesCode, isHalted, forksAwayFromTerminal, isSelected, isHighlighted, isFaded, isRead, animationOptions } = spec;
            const decorations: PointerEditorDecoration[] = [];
            const beforeCode = { ...files }
            const cell = cells[i] as GammaCell;
            const { senderId, editorPointers } = cell;
            const sender = participants[senderId] || participants[GammaNobodyID];
            const source: string = typeof cell.source === 'string' ? cell.source : cell.source.join('\n');

            const isNewSender = lastSenderId !== senderId;
            lastSenderId = senderId;

            files = patchFileState(files, cell.fileDiff);
            const afterCode = { ...files };
            if(isSelected) {
                currentFilesState = {...files};
                if(editorPointers && editorPointers.length > 0) {
                    decorations.push(...editorPointers);
                    editorDecorationsByCellId[cell.id] = [...editorPointers];
                }
                // editorDecorations.push(...(cell.editorPointers || []));
            } else if(isHighlighted) { // if none of the children before the selected cells changes the code, include these decorations too
                let codeChangedBeforeSelectedCell = false;
                for(let j = i; j < cellSpecs.length; j++) {
                    if(cellSpecs[j].type !== 'add') {
                        const { changesCode, isSelected } = cellSpecs[j] as CellDisplaySpec;
                        if(changesCode) {
                            codeChangedBeforeSelectedCell = true;
                            break;
                        } else if(isSelected) {
                            break;
                        }
                    }
                }
                if(!codeChangedBeforeSelectedCell) {
                    if(editorPointers && editorPointers.length > 0) {
                        decorations.push(...editorPointers);
                        editorDecorationsByCellId[cell.id] = [...editorPointers];
                    }
                }
            }
            return <Draggable draggableId={cell.id} index={i} key={cell.id}>
                    {(provided) => (
                            <div id={`cell-${cell.id}`} className={classNames("row", {"dim": isFaded, "selected": isSelected, "read": isRead, "highlighted": isHighlighted})} key={cell.id}
                                ref={provided.innerRef} {...provided.draggableProps}>
                                <CellComponent  dragHandleProps={provided.dragHandleProps}
                                                branchesAwayFromTerminal={forksAwayFromTerminal}
                                                sender={sender}
                                                showSender={isNewSender}
                                                branches={cell.childrenIds.length > 1}
                                                onSelect={doSelectCell}
                                                isSelected={isSelected}
                                                filename={filename}
                                                halted={isHalted}
                                                id={cell.id}
                                                source={source}
                                                editorPointers={editorPointers || []}
                                                hasCode={hasCode}
                                                beforeCode={beforeCode}
                                                afterCode={afterCode}
                                                onDelete={onDeleteCell}
                                                codeEditorRef={editorRef}
                                                editingFilenameRef={currentFileRef}
                                                changesCode={changesCode}
                                                isAIContent={cell.isAIContent}
                                                animateText={animationOptions}
                                                />
                            </div>
                    )}
                </Draggable>;
        } else if(type === 'go-back-to-main-thread') {
            const { destinationCellId } = spec;
            return <button className='gamma-link back-to-main-thread-link' key={`go-back-to-main-thread-${i}`} onClick={() => onAdvance(destinationCellId)}>({t('goBackToMainThread')})</button>;
        } else if(type === 'done') {
            return <div className='done' key={`done-${i}`}><i className='codicon codicon-check-all' />&nbsp;That&apos;s all! Feel free to keep exploring.</div>;
        } else {
            return false;
        }
    });
    useEffect(() => {
        const pageElement = pageRef.current;
        const svgOverlay = svgOverlayRef.current;
        const editor = currentEditor;

        const paths: {[id: string]: string} = {};
        const props = {
            className: 'annotation-path'
        }
        const onScroll = () => {
            highlightedCellIds.forEach((id) => {
                const cellElem = document.querySelector(`.highlighted#cell-${id}`);
                if(cellElem) {
                    const annotations = document.querySelectorAll(`.code-pointer.cell-${id}`);
                    const cellbb = cellElem.getBoundingClientRect();
                    const startX = cellbb.left + cellbb.width;
                    const startY = cellbb.top  + cellbb.height / 2;
                    const cellPivotX = startX + 100;
                    let i = 0;
                    for(; i<annotations.length; i++) {
                        const annotationId = `${id}-${i}`;
                        const annotation = annotations[i];
                        const annotationbb = annotation.getBoundingClientRect();
                        const endX = annotationbb.left;
                        const endY = annotationbb.top  + annotationbb.height / 2;
                        const annotationPivotX = endX - 100;

                        const path = `M ${startX} ${startY} C ${cellPivotX} ${startY} ${annotationPivotX} ${endY} ${endX} ${endY}`;

                        if(svgOverlay) {
                            if(paths[annotationId]) {
                                // debugger;
                                svgOverlay.setPath(paths[annotationId], path, {...props, id});
                            } else {
                                paths[annotationId] = svgOverlay.addPath(path, {...props, id});
                            }
                        }
                    }
                    while(paths[`${id}-${i}`]) {
                        if(svgOverlay) {
                            svgOverlay.removePath(paths[`${id}-${i}`]);
                        }
                        i++;
                    }
                }
            });
        };

        let cleanupOnDidScrollChange: null|IDisposable = null;
        if(editor) {
            cleanupOnDidScrollChange = editor.onDidScrollChange(() => {
                onScroll();
            });
        }

        if(svgOverlay) {
            svgOverlay.clearPaths();
        }
        onScroll();
        if(pageElement) {
            pageElement.addEventListener('scroll', onScroll);
        }
        const intervalId = setInterval(onScroll, 500);

        return () => {
            if(pageElement) {
                pageElement.removeEventListener('scroll', onScroll);
            }
            if(cleanupOnDidScrollChange) {
                cleanupOnDidScrollChange.dispose();
            }
            clearInterval(intervalId);
        };
    }, [dispatch, store, highlightedCellIds, currentEditor]);
    const fileList = Object.keys(currentFilesState);


    return <><SVGOverlay ref={svgOverlayRef}></SVGOverlay><SplitView leftPanel={
                            <>
                                <HeaderComponent onChangeSender={(id: string) => (defaultSenderRef.current = id)}
                                                onChangeTypingSpeed={(newSpeed: number|false) => {
                                                                            if(typeof newSpeed === 'number') {
                                                                                animateText = true;
                                                                                setTimePerCharacter(interpolate(newSpeed, SLOWEST_TYPING_SPEED, FASTEST_TYPING_SPEED));
                                                                                delayBetweenMessage = interpolate(newSpeed, SLOWEST_DELAY_BETWEEN_MESSAGES, FASTEST_DELAY_BETWEEN_MESSAGES);
                                                                            } else {
                                                                                animateText = false;
                                                                            }
                                                                        }}
                                                onChangeModel={(m: string) => {
                                                    model = m;
                                                }} />
                                <DragDropContext onDragEnd={handleOnDragEnd}>
                                    <Droppable droppableId='droppable-1'>
                                        {(provided) => (
                                            <div {...provided.droppableProps} ref={provided.innerRef} id="cells">
                                                {cellElements}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            </>
                        }
                        rightPanel={
                            currentFilesState && fileList.length > 0 &&
                                        <CodeFilesComponent onEditorMount={(editor) => {editorRef.current=editor; setEditor(editor);}}
                                                            key={`${selectedCellId}-${fileList.join(',')}`}
                                                            initialFiles={currentFilesState}
                                                            editable={true}
                                                            onFilesChanged={onFilesChanged}
                                                            decorationsByCellId={editorDecorationsByCellId}
                                                            onChangeFile={(fname) => currentFileRef.current = fname } />
                        }
                        leftRef={pageRef}
                        rightRef={codeElemRef}
                        rightClasses={"page-code"}/></>;
}

export default Page;


type CellDisplaySpec = {
    type: 'cell',
    // 'faded' | 'selected' | 'read',
    isFaded: boolean,
    isRead: boolean,
    isSelected: boolean,
    isHighlighted: boolean,
    cellId: string,
    hasCode: boolean,
    changesCode: boolean,
    files: {[fname: string]: string},
    isHalted: boolean,
    forksAwayFromTerminal: boolean,
    animationOptions: boolean|TypingEffectOptions
}

type AddCellSpec = {
    type: 'add',
    parentId: string | false,
    suggestedNext: string[],
    selectedNext: string | false
}

type GoBackToMainThreadSpec = {
    type: 'go-back-to-main-thread',
    destinationCellId: string
}

type DoneSpec = {
    type: 'done'
}

type CellsSpecs = (CellDisplaySpec | AddCellSpec | GoBackToMainThreadSpec | DoneSpec)[];


function getCellSpecs(state: PageState, selectedCell: string|false, highlightedCellIds: string[], animationTimePerCharacter: number): CellsSpecs {
    const { page } = state;
    const { cellsById, userState, terminalCellId } = page; 
    const { visibleCellIds, cellStates } = userState;

    const terminalPath = computeTerminalPath(page);
    const terminalPathMap = terminalPath ? Object.fromEntries(terminalPath.map((cellId) => [cellId, true])) : {};

    let files: {[fname: string]: string} = {};
    let iBeyondSelectedCell = false;
    let haltedOnInteraction = false;
    let firstCellToForkAwayFromTerminal: string | false = false;
    const result: CellsSpecs = [];
    let currentAnimationDelay = FIRST_MESSAGE_DELAY;
    for(let i = 0; i<visibleCellIds.length; i++) {
        // debugger;
        const cellId = visibleCellIds[i];
        const cell = cellsById[cellId];
        const { directives, fileDiff, source, senderId } = cell;
        const hasHaltingDirective = directives && directives.some((d) => ['multiple-choice', 'button', 'edit-code'].indexOf(d.type) >= 0);
        const passedAllDirectives = !hasHaltingDirective || cellStates[cell.id]?.passed;
        const isHalted = !passedAllDirectives;
        const isLastVisibleCell = i === visibleCellIds.length - 1;


        const changesCode = !!fileDiff;
        const hasCode = Object.keys(files).length > 0;

        const isSelected = selectedCell === cellId;
        const isHighlighted = highlightedCellIds.includes(cellId);
        const isFaded = iBeyondSelectedCell;
        const isRead = !isFaded && !isSelected;


        files = patchFileState(files, fileDiff);



                                 //  there is a terminal cell...
                                 //        |               ...and we have selected some sub-option...
                                 //        |               |                                ...and the sub-option we selected is not in the critical path
                                 //        |               |                                |                                                ...and we haven't passed the terminal cell
                                 //        |               |                                |                                                |
        const forksAwayFromTerminal = !!(terminalCellId && (i < visibleCellIds.length-1) && terminalPathMap[visibleCellIds[i+1]] !== true && !visibleCellIds.includes(terminalCellId));
        
        if(firstCellToForkAwayFromTerminal === false && forksAwayFromTerminal) {
            firstCellToForkAwayFromTerminal = cellId;
        }

        let animationOptions: boolean|TypingEffectOptions = false;
        if(animateText && isHighlighted && senderId !== GammaUserID) {
            animationOptions = {...DEFAULT_TYPING_EFFECT_OPTIONS, startDelay: currentAnimationDelay, timePerCharacter: animationTimePerCharacter};

            const cellSource = typeof source === 'string' ? source : source.join('\n');
            const processedSource = MarkdownComponent.filterTextForAnimation(cellSource);
            const totalTimeToAnimation = processedSource.length * (animationOptions.timePerCharacter ?? 0);
            currentAnimationDelay += totalTimeToAnimation + delayBetweenMessage;
        }

        result.push({type: 'cell', cellId, hasCode, changesCode, files, isHalted, isFaded, forksAwayFromTerminal, isSelected, isHighlighted, isRead, animationOptions} as CellDisplaySpec);

        if(!passedAllDirectives) {
            haltedOnInteraction = true;
            break;
        }


        if(isSelected) {
            iBeyondSelectedCell = true;
            const nextCellId = visibleCellIds[i+1];
            const senders = cell.childrenIds.map((cid) => cellsById[cid].senderId);
            const anySentByUser = senders.some((s) => s === GammaUserID);
            const unorderedNext = (anySentByUser || isLastVisibleCell) ? cell.childrenIds : [];

            let suggestedNext: string[] = [...unorderedNext];

            for(let j = 0; j<unorderedNext.length; j++) {
                const sn = unorderedNext[j];
                if(terminalPathMap[sn]) { // If it's in the terminal path
                    // create a new array that is a clone of suggested next with item j first
                    suggestedNext = [sn, ...unorderedNext.filter((x) => x !== sn)];
                    break;
                }
            }


            if(firstCellToForkAwayFromTerminal !== false) {
                if(cell.childrenIds.length === 0) { // no children; add "back to main thread" first
                    result.push({type: 'go-back-to-main-thread', destinationCellId: firstCellToForkAwayFromTerminal} as GoBackToMainThreadSpec);
                    result.push({type: 'add', suggestedNext, selectedNext: nextCellId,  parentId: cell.id} as AddCellSpec);
                } else {
                    result.push({type: 'add', suggestedNext, selectedNext: nextCellId,  parentId: cell.id} as AddCellSpec);
                    result.push({type: 'go-back-to-main-thread', destinationCellId: firstCellToForkAwayFromTerminal} as GoBackToMainThreadSpec);
                }
            } else {
                result.push({type: 'add', suggestedNext, selectedNext: nextCellId,  parentId: cell.id} as AddCellSpec);
            }


        }
    }

    if(terminalCellId && visibleCellIds.includes(terminalCellId) && !haltedOnInteraction) {
        result.push({type: 'done'} as DoneSpec);
    }

    if(iBeyondSelectedCell === false && !haltedOnInteraction) { // nothing selected
        result.push({type: 'add', suggestedNext: [], selectedNext: false, parentId: (visibleCellIds.length > 0) ? visibleCellIds[visibleCellIds.length - 1] : false} as AddCellSpec);
    }


    return result;
}

function computeTerminalPath(page: GammaPage): string[] | false {
    const { cellsById, terminalCellId } = page;
    if(!terminalCellId) { return false; }
    const terminalPath: string[] = [];
    let currentCellId: string|undefined = terminalCellId;
    while(currentCellId) {
        terminalPath.push(currentCellId);
        const currentCell: GammaCell = cellsById[currentCellId];
        const { parentId } = currentCell;
        currentCellId = parentId;
    }
    return terminalPath;
}

function scrollToId(elem: HTMLElement|null, id: string|null, delay: number|false = false): void {
    if(delay === false) {
        doScroll();
    } else {
        setTimeout(doScroll, delay);
    }
    function doScroll() {
        if(id) {
            const el = document.getElementById(id);
            if(el) {
                el.scrollIntoView({behavior: 'smooth'});
            }
        }
    }
}

function scrollToBottom(elem: HTMLElement|null, delay: number|false = false): void {
    if(delay === false) {
        doScroll();
    } else {
        setTimeout(doScroll, delay);
    }
    function doScroll() {
        if(elem) {
            elem.scrollTo({top: elem.scrollHeight, behavior: 'smooth'});
        }
    }
}