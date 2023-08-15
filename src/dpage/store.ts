/* eslint-disable no-debugger */
import update from 'immutability-helper';
import { PayloadAction, configureStore, createSlice } from '@reduxjs/toolkit';
import logger from 'redux-logger';
import { GammaPage, GammaCell, GammaParticipant, PointerEditorDecoration, MediaFile, GammaPageUserState } from '../dpage';
import { PageChangedMessage, ShowAlertMessage } from '../messages';
// import { UserCellState } from './Cell';
import { patchFileState, derivePatch } from './utils/code-diff-utils';
import { Queue, generateUUID } from './utils/dpage-utils';
import { postAndAwaitResponse } from './utils/webview-message-utils';
import { getDirectives } from './widgets/MarkdownDisplay';
import { GammaInstructorID, GammaNobodyID, GammaUserID } from '../constants';
import i18n from './widgets/i18nConfig';


export interface PageState {
    page: GammaPage
}

// const userSlice = createSlice<UserPageState, any>({
//     name: 'user',
//     initialState: {
//         cellStates: {},
//         passedCells: {}
//     },
//     reducers: {
//         clear(state: UserPageState) {
//             state.cellStates = {};
//             state.passedCells = {};
//         },
//     }
// });
// export const { addDialog, deleteDialog, addDialogMessage, setDialogMessageResponse, setDirectiveState, markCellPassed, clear } = userSlice.actions as any;

const pageSlice = createSlice<GammaPage, any>({
    name: 'page',
    initialState: {
        id: generateUUID(),
        cellsById: {},
        participants: {
            [GammaUserID]: {
                id: GammaUserID,
                name: 'Student',
                color: 'blue',
                description: ''
            },
            [GammaInstructorID]: {
                id: GammaInstructorID,
                name: 'Instructor',
                color: 'red',
                description: 'You are a helpful instructor who is teaching a new programmer how to program in JavaScript',
            },
            [GammaNobodyID]: {
                id: GammaNobodyID,
                name: 'Nobody',
                color: 'gray',
                description: ''
            }
        },
        userState: {
            visibleCellIds: [],
            highlightedCellIds: [],
            cellStates: {},
            selectedCellId: false
        },
        media: {},
        // selectedLanguage: 'en',
        terminalCellId: null,
        dbookformat: 4,
        dbookformat_minor: 0
    },
    reducers: {
        setLanguage: (state: GammaPage) => {
            // state.participants[GammaUserID].name = i18n.t('Student');
            // console.log(i18n);
            // state.participants[GammaInstructorID].name = i18n.t('Instructor');
            // console.log("Translated Name:", state.participants[GammaInstructorID].name);
            // state.participants[GammaInstructorID].description = i18n.t('instructorDescription');
            // state.participants[GammaNobodyID].name = i18n.t('Nobody');
        },
        setPage(state: GammaPage, action: PayloadAction<GammaPage>) {
            const { payload } = action;
            state.id = payload.id;
            state.participants = payload.participants;
            state.cellsById = payload.cellsById;
            state.terminalCellId = payload.terminalCellId || null;
            state.dbookformat = payload.dbookformat;
            state.dbookformat_minor = payload.dbookformat_minor;
            state.media = payload.media || {};

            state.userState = payload.userState;
            const localStorageUserState = getUserStateFromLocalStorage(state.id);

            if(localStorageUserState) {
                console.info(`Loaded user state from local storage for page ${state.id}`);
                state.userState = localStorageUserState;
            } else {
                console.info(`No user state found in local storage for page ${state.id}`);
                state.userState = getInitialUserState(state.cellsById);
            }


            const [ passedIntegrityCheck, reason ] = checkStateIntegrity(state);
            if(!passedIntegrityCheck) {
                console.error(`State integrity check failed!\n${reason}`);
                console.error(state);
                state.userState = getInitialUserState(state.cellsById);
            }


            alertAboutStateIntegrity(state);
            // state = payload;
            // state.id = payload.metadata.id;
            // state.participants = payload.metadata.participants;
            // state.cells = payload.cells;
            // state.cellsById = payload.cellsById;
        },
        addCell(state: GammaPage, action: PayloadAction<{id: string, sender: string, parentId: string|undefined, content: string}>) {
            const parentId = action.payload.parentId;
            const index = parentId ? state.userState.visibleCellIds.indexOf(parentId) + 1 : 0;
            const parentCell = parentId ? state.cellsById[parentId] : null;
            const parentCellSender = parentCell ? parentCell.senderId : GammaUserID;
            // const index = action?.payload?.index || state.cells.length;
            // const priorCell = index === 0 ? null : state.cellsById[state.cells[index - 1]];
            // const priorCellSender = priorCell?.metadata.sender || GammaUserID;
            const defaultNextCellSender = parentCellSender === GammaUserID ? GammaInstructorID : GammaUserID;

            const senderId = action.payload.sender  || defaultNextCellSender;
            const source   = action.payload.content || '';
            const id       = action.payload.id      || generateUUID();

            const directives = getDirectives(source, id);
            const newCell = { id, source, type: "message", senderId,  directives, childrenIds: [], shortcutsTo: [], parentId, isAIContent: false } as GammaCell;

            state.userState.visibleCellIds = state.userState.visibleCellIds.slice(0, index).concat(id);
            // state.cells.splice(index, 0, id);
            state.cellsById[id] = newCell;

            if(parentCell) {
                parentCell.childrenIds.push(id);
            }

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        spliceInCell(state: GammaPage, action: PayloadAction<{id: string, sender: string, parentId: string|undefined, content: string}>) {
            const parentId = action.payload.parentId;
            const index = parentId ? state.userState.visibleCellIds.indexOf(parentId) + 1 : 0;
            const parentCell = parentId ? state.cellsById[parentId] : null;
            const parentCellSender = parentCell ? parentCell.senderId : GammaUserID;
            // const index = action?.payload?.index || state.cells.length;
            // const priorCell = index === 0 ? null : state.cellsById[state.cells[index - 1]];
            // const priorCellSender = priorCell?.metadata.sender || GammaUserID;
            const defaultNextCellSender = parentCellSender === GammaUserID ? GammaInstructorID : GammaUserID;

            const senderId = action.payload.sender  || defaultNextCellSender;
            const source   = action.payload.content || '';
            const id       = action.payload.id      || generateUUID();

            const newCell = { id, source, type: "message", senderId,  directives: [], childrenIds: [], shortcutsTo: [], parentId, isAIContent: false } as GammaCell;

            state.cellsById[id] = newCell;

            const oldChildrenIds = parentCell?.childrenIds || Object.keys(state.cellsById).filter(potentialRootId => (!state.cellsById[potentialRootId].parentId && potentialRootId !== id));

            if(parentCell) {
                parentCell.childrenIds = [id];
            }

            newCell.childrenIds = oldChildrenIds;
            oldChildrenIds.forEach(childId => {
                const childCell = state.cellsById[childId];
                childCell.parentId = id;
            });

            const parentIndex = parentId ? state.userState.visibleCellIds.indexOf(parentId) : -1;
            state.userState.visibleCellIds.splice(parentIndex + 1, 0, id);

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        setCellContent(state: GammaPage, action: PayloadAction<{cellId: string, content: string, isAIContent: boolean}>) {
            const { cellId, content, isAIContent } = action.payload;

            const directives = getDirectives(content, cellId);

            state.cellsById[cellId].source = content;
            state.cellsById[cellId].directives = directives;       
            state.cellsById[cellId].isAIContent = isAIContent;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        deleteCell(state: GammaPage, action: PayloadAction<{cellId: string}>) {
            const { cellId } = action.payload;
            const cellIndex = state.userState.visibleCellIds.indexOf(cellId);
            if(cellIndex < 0) { return; }
            const cell = state.cellsById[cellId];
            if(cell.parentId) {
                const parentCell = state.cellsById[cell.parentId];
                const childIndex = parentCell.childrenIds.indexOf(cellId);
                if(childIndex >= 0) {
                    parentCell.childrenIds.splice(childIndex, 1);
                }

                for(const childId of cell.childrenIds) {
                    const childCell = state.cellsById[childId];
                    childCell.parentId = cell.parentId;
                    parentCell.childrenIds.push(childId);
                }
            } else { // cell was the root of the tree
                if(cell.childrenIds.length > 0) {
                    const newRootId = cell.childrenIds[0];
                    const newRootCell = state.cellsById[newRootId];
                    newRootCell.parentId = undefined;
                    for(const childId of cell.childrenIds.slice(1)) {
                        const childCell = state.cellsById[childId];
                        childCell.parentId = newRootId;
                        newRootCell.childrenIds.push(childId);
                    }
                }
            }
            if(state.terminalCellId === cellId) {
                state.terminalCellId = null;
            }

            delete state.cellsById[cellId];

            if(cellIndex === 0) { // find the new root
                const rootCells = Object.keys(state.cellsById).filter(id => !state.cellsById[id].parentId);
                if(rootCells.length > 0) {
                    state.userState.visibleCellIds = [rootCells[0]];
                } else {
                    state.userState.visibleCellIds = [];
                }
            } else {
                state.userState.visibleCellIds = state.userState.visibleCellIds.slice(0, cellIndex);//.splice(cellIndex, 1);
            }

            state.userState.highlightedCellIds = [];
            state.userState.selectedCellId = false;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        setCellIndex(state: GammaPage, action: PayloadAction<{cellId: string, destinationIndex: number}>){
            const { cellId, destinationIndex } = action.payload;
            const sourceIndex = state.userState.visibleCellIds.indexOf(cellId);

            if(sourceIndex < 0 || sourceIndex === destinationIndex) { return; }

            // const cellsAfter = state.cells.slice(cellIndex + 1);

            const cell = state.cellsById[cellId];
            const { parentId: oldParentId, childrenIds: oldChildrenIds } = cell;

            const newParentId = destinationIndex === 0 ? undefined : state.userState.visibleCellIds[destinationIndex - 1];


            if(oldParentId) {
                const oldParentCell = state.cellsById[oldParentId];
                const childIndex = oldParentCell.childrenIds.indexOf(cellId);
                if(childIndex >= 0) {
                    oldParentCell.childrenIds.splice(childIndex, 1, ...oldChildrenIds);
                    oldChildrenIds.forEach(childId => {
                        const childCell = state.cellsById[childId];
                        childCell.parentId = oldParentId;
                    });
                }
            }

            if(newParentId) {
                const newParentCell = state.cellsById[newParentId];
                const childIndex = newParentCell.childrenIds.indexOf(cellId);
                if(childIndex < 0) {
                    const { childrenIds: newParentsOldChildrenIds } = newParentCell;

                    newParentCell.childrenIds = [cellId];
                    cell.childrenIds = newParentsOldChildrenIds;
                    newParentsOldChildrenIds.forEach(childId => {
                        const childCell = state.cellsById[childId];
                        childCell.parentId = cellId;
                    });
                }
            } else {
                const rootCellIds = Object.keys(state.cellsById).filter(id => (!state.cellsById[id].parentId && id !== cellId));
                cell.childrenIds = rootCellIds;
                rootCellIds.forEach(rootCellId => {
                    const childCell = state.cellsById[rootCellId];
                    childCell.parentId = cellId;
                });
            }

            cell.parentId = newParentId;

            const newCellsState = [];
            let currentCellId: string|undefined = cellId;
            while(currentCellId) {
                newCellsState.unshift(currentCellId);
                const currentCell = state.cellsById[currentCellId] as GammaCell;
                currentCellId = currentCell.parentId;
            }
            // newCellsState.push(...cellsAfter);
            state.userState.visibleCellIds = newCellsState;

            state.userState.highlightedCellIds = [cellId];
            state.userState.selectedCellId = cellId;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        advanceToNextDecisionPoint(state: GammaPage, action?: PayloadAction<{cellId?: string}>) {
            const advanceToCellId = (action && action.payload && action.payload.cellId) || false;

            const { visibleCells, selectedCell, highlightedCells } = getNewLineage(state, advanceToCellId);
            state.userState.highlightedCellIds = highlightedCells;
            state.userState.selectedCellId = selectedCell;
            state.userState.visibleCellIds = visibleCells;

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
        },

        setCellSender(state: GammaPage, action: PayloadAction<{cellId: string, sender: string}>) {
            const { cellId, sender } = action.payload;
            // const cellIndex = state.cells.findIndex((c) => c.id === cellId);
            // if(cellIndex < 0 && cellIndex === state.cells.length-1) { return; }
            state.cellsById[cellId].senderId = sender;

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },

        setSelectedCell(state: GammaPage, action: PayloadAction<{cellId: string}>) {
            const { cellId } = action.payload;
            state.userState.highlightedCellIds = [cellId];
            state.userState.selectedCellId = cellId;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
        },

        updateCellCodeFiles(state: GammaPage, action: PayloadAction<{cellId: string, files: {[fname: string]: string}}>) {
            const { cellId, files } = action.payload;
            const { cellsById } = state;

            // A map of what the **desired** file states are for each cell. We will figure this out by building it
            const fileStates: {[cellId: string]: {[fname: string]: string}} = {};
            let latestFileState: {[fname: string]: string} = {};

            // Loop through from the very first cell to the parent cell and update the file states
            // for each cell along the way
            getParentLineage(cellId, cellsById, false).forEach((id) => {
                const cell = cellsById[id];
                latestFileState = patchFileState(latestFileState, cell.fileDiff);
                fileStates[id] = latestFileState;
            });

            // Loop through this cell and all its descendants and update the *past* file states for each cell
            breadthFirstTraversal(cellId, cellsById, (id) => {
                const cell = cellsById[id];
                const { parentId } = cell;
                const parentFileState = parentId ? fileStates[parentId] : {};
                fileStates[id] = patchFileState(parentFileState, cell.fileDiff);
                return true; // continue traversal
            });

            // Now, we want to set the **desired** file states for each cell. We will do this by assigning the cell
            // and any descendants without a file diff to be the state of files that's passed in
            breadthFirstTraversal(cellId, cellsById, (id) => {
                const cell = cellsById[id];
                if(id === cellId || !cell.fileDiff) {
                    fileStates[id] = files;
                    return true;
                } else {
                    return false; // don't traverse the rest of this tree
                }
            });

            // The file diffs of the parent cells should *not* change so loop through the target cell
            // and its descendants and update the patches to acheive what we want.
            breadthFirstTraversal(cellId, cellsById, (id) => {
                const cell = cellsById[id];
                const { parentId } = cell;
                const parentFileState = parentId ? fileStates[parentId] : {};

                const patch = derivePatch(parentFileState, fileStates[id]);
                if(patch) {
                    cell.fileDiff = patch;
                } else {
                    delete cell.fileDiff;
                }

                return true; // continue traversal
            });

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        addParticipant(state: GammaPage, action?: PayloadAction<{id?: string, name?: string, color?: string}>) {
            const id    = action?.payload?.id    || generateUUID();
            const name  = action?.payload?.name  || i18n.t('participant') + (Object.keys(state.participants).length + 1);
            const possibleColors = ["var(--vscode-charts-yellow)", "var(--vscode-charts-orange)", "var(--vscode-charts-green)", "var(--vscode-charts-purple)"];
            const candidateColors = possibleColors.filter(c => !Object.values(state.participants).find(p => p.color === c));
            const randomColor = candidateColors.length > 0 ? candidateColors[Math.floor(Math.random() * candidateColors.length)] : possibleColors[Math.floor(Math.random() * possibleColors.length)];
            const color = action?.payload?.color || randomColor;
            const newParticipant: GammaParticipant = { id, name, color };
            state.participants[id] = newParticipant;

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        removeParticipant(state: GammaPage, action: PayloadAction<{participantId: string}>) {
            const { participantId } = action.payload;
            delete state.participants[participantId];

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        setParticipantName(state: GammaPage, action: PayloadAction<{participantId: string, name: string}>) {
            const { participantId, name } = action.payload;
            state.participants[participantId].name = name;

            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        setParticipantColor(state: GammaPage, action: PayloadAction<{participantId: string, color: string}>) {
            const { participantId, color } = action.payload;
            state.participants[participantId].color = color;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        setParticipantDescription(state: GammaPage, action: PayloadAction<{participantId: string, description: string}>) {
            const { participantId, description } = action.payload;
            state.participants[participantId].description = description;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },

        setDirectiveState(state: GammaPage, action: PayloadAction<{cellId: string, directiveId: string, state: any}>) {
            const { cellId, directiveId, state: directiveState } = action.payload;
            const oldPassed = directiveState && directiveState.passed;

            const cellStates = state.userState.cellStates;
            if(!cellStates[cellId]) {
                cellStates[cellId] = { directiveStates: {}, passed: false };
            }
            const oldState = cellStates[cellId].directiveStates[directiveId] || {};
            cellStates[cellId].directiveStates[directiveId] = Object.assign({...oldState}, directiveState);
            saveUserStateToLocalStorage(state);
        },
        markCellPassed(state: GammaPage, action: PayloadAction<{cellId: string, passed: boolean}>) {
            const { cellId, passed } = action.payload;
            const cellStates = state.userState.cellStates;
            const wasPassed = cellStates[cellId]?.passed || false;
            if(!cellStates[cellId]) {
                cellStates[cellId] = { directiveStates: {}, passed: false };
            }
            cellStates[cellId].passed = passed;
            if(passed && !wasPassed) {
                const { visibleCells, selectedCell, highlightedCells } = getNewLineage(state, false);
                state.userState.highlightedCellIds = highlightedCells;
                if(state.userState.highlightedCellIds.length > 1) {
                    state.userState.highlightedCellIds = state.userState.highlightedCellIds.filter(id => id !== cellId); // don't include the cell they just passed
                }
                state.userState.selectedCellId = selectedCell;
                state.userState.visibleCellIds = visibleCells;
            }
            saveUserStateToLocalStorage(state);
        },
        setTerminalCellId(state: GammaPage, action: PayloadAction<{cellId: string}>) {
            const { cellId } = action.payload;
            state.terminalCellId = cellId;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        setCellPointers(state: GammaPage, action: PayloadAction<{cellId: string, pointers: PointerEditorDecoration[]}>) {
            const { cellId, pointers } = action.payload;
            state.cellsById[cellId].editorPointers = pointers;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        addMediaFile(state: GammaPage, action: PayloadAction<{mediaFile: MediaFile}>) {
            const { mediaFile } = action.payload;
            if(!state.media) {
                state.media = {};
            }
            state.media[mediaFile.filename] = mediaFile;
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        removeMediaFile(state: GammaPage, action: PayloadAction<{filename: string}>) {
            const { filename } = action.payload;
            if(state.media) {
                delete state.media[filename];
            }
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        renameMediaFile(state: GammaPage, action: PayloadAction<{oldFilename: string, newFilename: string}>) {
            const { oldFilename, newFilename } = action.payload;
            if(state.media) {
                const mediaFile = state.media[oldFilename];
                delete state.media[oldFilename];
                state.media[newFilename] = {...mediaFile, filename: newFilename};
            }
            saveUserStateToLocalStorage(state);
            alertAboutStateIntegrity(state);
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        },
        setIsAIContent(state: GammaPage, action: PayloadAction<{cellId: string, isAIContent: boolean}>) {
            const { cellId, isAIContent } = action.payload;
            state.cellsById[cellId].isAIContent = isAIContent;
            postAndAwaitResponse({ message: 'page_changed'} as PageChangedMessage, false);
        } ,
        clearUserState(state: GammaPage) {
            state.userState = getInitialUserState(state.cellsById);
            saveUserStateToLocalStorage(state);
        }
    }
});

export const { setLanguage, setCellContent, setIntroduction, deleteCell, moveCellUp, moveCellDown, setAgentDescription,
                setPageFilename, setPage, setCellSender, setCellIndex, updateCellCodeFiles, addCell,
                addParticipant, removeParticipant, setParticipantName, setParticipantColor, setParticipantDescription,
                setDirectiveState, markCellPassed, setTerminalCellId, advanceToNextDecisionPoint, spliceInCell,
                setCellPointers, addMediaFile, removeMediaFile, renameMediaFile, setSelectedCell, setIsAIContent, clearUserState } = pageSlice.actions as any;

const pageReducer = pageSlice.reducer;
// const userReducer = userSlice.reducer;

const store = configureStore({
    reducer: {
        page: pageReducer
        // user: userReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger)
});


function saveUserStateToLocalStorage(state: GammaPage) {
    const { id, userState } = state;
    localStorage.setItem(getStorageKey(id), JSON.stringify(userState));
}
function getUserStateFromLocalStorage(id: string|undefined): GammaPageUserState | false {
    const userState = localStorage.getItem(getStorageKey(id));
    if(userState) {
        try {
            return JSON.parse(userState);
        } catch(e) {
            return false;
        }
    } else {
        return false;
    }
}

function getStorageKey(id: string|undefined): string {
    return `ANONYMIZED.gamma-userState-${id||''}`;
}

export default store;

function alertAboutStateIntegrity(state: GammaPage): void {
    const [ passed, reason ] = checkStateIntegrity(state);
    if(!passed) {
        const message = `State integrity check failed!\n${reason}`;
        console.error(message);
        console.error(state);
        postAndAwaitResponse({message: 'show-alert', content: message, type: 'error'} as ShowAlertMessage, false);
        alert(message);
    }
}

function checkStateIntegrity(state: GammaPage): [boolean, string] {
    const { cellsById, userState } = state;
    const { visibleCellIds, selectedCellId } = userState;

    function hasCycleInTree(rootId: string, visited: Set<string>): string|false {
        if(!rootId) { return false; }
        if(visited.has(rootId)) { return rootId; } // If the current node is already visited, there is a cycle
        visited.add(rootId); // Mark the current node as visited

        const root = cellsById[rootId];
        for(const childId of root.childrenIds) {
            // Recursive DFS for each child node
            const hasCycle = hasCycleInTree(childId, visited);
            if(hasCycle) { return hasCycle; }
        }
        // The current node and its descendants do not contain cycles
        return false;
    }

    const numCells = Object.keys(cellsById).length;
    if(numCells > 0) {
        const rootCells = Object.keys(cellsById).filter(id => !cellsById[id].parentId);
        if(rootCells.length === 0) { return [false, 'No root cell with multiple candidates']; }
        if(rootCells.length > 1) { return [false, 'More than one root cell']; }
        const rootCellId = rootCells[0];

        const visited: Set<string> = new Set();
        const hasCycle = hasCycleInTree(rootCellId, visited);
        if(hasCycle) { return [false, `Cycle in tree. Cell ${hasCycle} is part of the cycle.`]; }
        for(const cellId of Object.keys(cellsById)) {
            if(!visited.has(cellId)) { return [false, `Cell ${cellId} is not reachable from the root cell`]; }
        }
    }

    for(const cellId of Object.keys(cellsById)) {
        const cell = cellsById[cellId];
        for(const childId of cell.childrenIds) {
            const child = cellsById[childId];
            if(child.parentId !== cellId) { return [false, `Parent ${cellId} lists ${childId} as a child but it's parent is ${child.parentId}`]; }
        }
        if(cell.id !== cellId) { return [false, `Cell ${cellId} has an id of ${cell.id}`]; }
    }

    for(let i = visibleCellIds.length-1; i>=0; i--) {
        const cellId = visibleCellIds[i];
        if(!cellsById[cellId]) { return [false, `Could not find cell ${cellId} in cellsById but was in visible cells`]; }
        const cell = cellsById[cellId];
        if(cell.parentId) {
            if(i === 0) { return [false, `Cell ${cell.id} lists ${cell.parentId} as a parent but is the root of visible cells`]; }
            if(visibleCellIds[i-1] !== cell.parentId) { return [false, `Cell ${cell.id}'s parent is ${cell.parentId} but it's parent in visible cells is ${visibleCellIds[i-1]}`]; }
        } else {
            if(i !== 0) { return [false, `Cell ${cellId} does not have a parent but is in the middle of the list of visible cells`]; }
        }
    }

    if(selectedCellId && !visibleCellIds.includes(selectedCellId)) {
        return [false, `Selected cell ${selectedCellId} is not in visible cell hierarchy`]
    }

    if(!Object.hasOwnProperty.call(userState, 'highlightedCellIds')) { return [false, 'No highlighted cells']; }

    for(const highlightedCellId of userState.highlightedCellIds) {
        if(!cellsById[highlightedCellId]) { return [false, `Could not find cell ${highlightedCellId} in cellsById but was in highlighted cells`]; }
    }

    if(selectedCellId && !userState.highlightedCellIds.includes(selectedCellId)) {
         return [false, `Could not find selected cell ${selectedCellId} in highlighted cells`];
    }

    return [true, ''];
}

function breadthFirstTraversal(rootId: string, cellsById: {[cellId: string]: GammaCell}, action: (cellId: string) => boolean): void {
    const queue: Queue<string> = new Queue([rootId]);
    const visited: Set<string> = new Set();

    while(!queue.isEmpty()) {
        const cellId = queue.dequeue();

        if(cellId) {
            const shouldVisitChildren = action(cellId) !== false;
            if(shouldVisitChildren && !visited.has(cellId)) {
                const cell = cellsById[cellId];

                visited.add(cellId);
                queue.enqueue(...cell.childrenIds);
            }
        }
    }
}
function getParentLineage(cellId: string, cellsById: {[cellId: string]: GammaCell}, includeCell = true): string[] {
    const parentLineage: string[] = [];
    let currentParent: string|undefined = cellId;
    while(currentParent) {
        parentLineage.unshift(currentParent);
        currentParent = cellsById[currentParent].parentId;
    }
    if(includeCell) {
        return parentLineage;
    } else {
        return parentLineage.slice(0, -1);
    }
}
function getNewLineage(state: GammaPage, advanceToCellId: string|false): {visibleCells: string[], selectedCell: string|false, highlightedCells: string[]} {
    const { cellsById, userState } = state;
    const { cellStates } = userState;

    const highlightedCells: string[] = [];
    let visibleCells: string[] = [];

    if(advanceToCellId) { // advance to this cell first...
        const lineage = getParentLineage(advanceToCellId, cellsById);
        visibleCells = lineage;
        highlightedCells.push(advanceToCellId);
    } else {
        visibleCells = userState.visibleCellIds
    }

    let lastCellId: string = visibleCells[visibleCells.length - 1];
    while(lastCellId) {
        highlightedCells.push(lastCellId);
        const lastCell = state.cellsById[lastCellId];
        const childrenIds = lastCell.childrenIds;
        const children = childrenIds.map(id => state.cellsById[id]);

        if(children.length === 0) {
            break;
        } else if(children.length === 1) {
            const child = children[0];
            if(child.senderId !== GammaUserID) {
                const { directives } = lastCell;
                const hasHaltingDirective = directives && directives.some((d) => ['multiple-choice', 'button', 'edit-code'].indexOf(d.type) >= 0);
                const passedAllDirectives = !hasHaltingDirective || cellStates[lastCell.id]?.passed;
                const isHalted = !passedAllDirectives;

                if(isHalted) {
                    break;
                } else {
                    visibleCells.push(child.id);
                }
            } else {
                break;
            }
        } else {
            break;
        }
        lastCellId = visibleCells[visibleCells.length - 1];
    }
    return { selectedCell: lastCellId, visibleCells, highlightedCells }
}
function getInitialUserState(cellsById: {[id: string]: GammaCell}): GammaPageUserState {
    const userState: GammaPageUserState = { visibleCellIds: [], cellStates: {}, highlightedCellIds: [], selectedCellId: false };
    const rootCells = Object.keys(cellsById).filter(id => !cellsById[id].parentId);
    if(rootCells.length >= 1) {
        userState.visibleCellIds.push(rootCells[0]);
    }
    return userState;
}
