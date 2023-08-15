import { FileChanges, GammaCell, GammaPage } from "../../dpage";
import { GammaInstructorID, GammaNobodyID, GammaUserID } from '../../constants';

type GammaPagev1 = {
    cells: GammaCellv1[];
    metadata: {
        id?: string;
        agentDescription?: string;
        [key: string]: any;
    };
    dbookformat: number;
    dbookformat_minor: number;
}

const enum Senderv1 {
    User="user",
    Assistant="assistant",
    Other="other"
}

type GammaCellv1 = {
    id: string;
    source: string | string[];
    cell_type: "message" | string;
    metadata: {
        sender: Senderv1;
        otherName?: string
        directives: {id: string, type: string}[];
        fileDiff?: DiffPatch;
    }
}

type DiffPatch = {
    added: string[];
    removed: string[];
    codeDiffs: {
        [filename: string]: FileChanges
    }
}

function convertNotebookFromV1(notebook: GammaPagev1): GammaPage {
    const cells: string[] = [];
    const cellsById: {[id: string]: GammaCell} = {};

    for(let i = 0; i<notebook.cells.length; i++) {
        const cell = notebook.cells[i];

        const newCell: GammaCell = {
            id: cell.id,
            source: cell.source,
            type: cell.cell_type,
            parentId: i > 0 ? notebook.cells[i-1].id : undefined,
            childrenIds: i < notebook.cells.length - 1 ? [notebook.cells[i+1].id] : [],
            shortcutsTo: [],
            directives: cell.metadata.directives,
            fileDiff: cell.metadata.fileDiff,
            senderId: cell.metadata.sender === Senderv1.User ? GammaUserID : GammaInstructorID,
            isAIContent: false,
        };
        cellsById[cell.id] = newCell;
        cells.push(cell.id);
    }

    const page: GammaPage = {
        cellsById,
        id: notebook.metadata.id,
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
                description: notebook.metadata.agentDescription || ''
            },
            [GammaNobodyID]: {
                id: GammaNobodyID,
                name: 'Nobody',
                color: 'black',
                description: ''
            }
        },
        userState: {
            highlightedCellIds: [],
            visibleCellIds: cells,
            cellStates: {},
            selectedCellId: false
        },
        media: {},
        terminalCellId: null,
        dbookformat: 4,
        dbookformat_minor: 0
    };

    return page;
}
type GammaPagev2 = {
    cells: string[];
    cellsById: {
        [id: string]: GammaCellv2
    };
    metadata: {
        id?: string;
        participants: GammaParticipantListv2;
        terminalCellId?: string;
    };
    dbookformat: number;
    dbookformat_minor: number;
}

type GammaParticipantListv2 = {
    user: GammaUserParticipantv2,
    instructor: GammaInstructorParticipantv2,
    [id: string]: GammaParticipantv2
};


export type GammaParticipantv2 = {
    id: string;
    name: string;
    color: string;
    description?: string;
}

export type GammaUserParticipantv2 = GammaParticipantv2 & {
    id: 'user',
    name: 'Student'
}
export type GammaInstructorParticipantv2 = GammaParticipantv2 & {
    id: 'instructor',
    name: 'Instructor',
    description: string
}

export type GammaCellv2 = {
    id: string;
    source: string | string[];
    cell_type: "message" | string;
    parentId?: string;
    childrenIds: string[];
    shortcutsTo: string[];
    metadata: {
        sender: string;
        otherName?: string
        directives: {id: string, type: string}[];
        fileDiff?: DiffPatchv3;
    }
}
function convertNotebookFromV2(notebook: GammaPagev2): GammaPage {
    const cellsById: {[id: string]: GammaCell} = {}
    for(const id in notebook.cellsById) {
        const cell = notebook.cellsById[id];
        cellsById[id] = {
            id: cell.id,
            source: cell.source,
            type: cell.cell_type,
            parentId: cell.parentId,
            childrenIds: cell.childrenIds,
            shortcutsTo: [],
            directives: cell.metadata.directives,
            fileDiff: cell.metadata.fileDiff,
            senderId: cell.metadata.sender,
            isAIContent: false,
        };
    }

    return {
        id: notebook.metadata.id,
        participants: {
            ...notebook.metadata.participants,
            nobody: {
                id: 'nobody',
                name: 'Nobody',
                color: 'black'
            }
        },
        userState: {
            visibleCellIds: notebook.cells,
            highlightedCellIds: [],
            cellStates: {},
            selectedCellId: false
        },
        cellsById,
        terminalCellId: null,
        media: {},
        dbookformat: 4,
        dbookformat_minor: 0,
    };
}

type GammaPagev3 = {
    id?: string;
    cellsById: {
        [id: string]: GammaCellv3,
    };
    participants: GammaParticipantListv3;
    terminalCellId: string | null;
    userState: GammaPageUserStatev3;
    dbookformat: number;
    dbookformat_minor: number;
    media: {
        [fname: string]: MediaFilev3
    }
}

type GammaParticipantListv3 = {
    user: GammaUserParticipantv3,
    instructor: GammaInstructorParticipantv3,
    nobody: GammaNobodyParticipantv3,
    [id: string]: GammaParticipantv3
};


export type GammaParticipantv3 = {
    id: string;
    name: string;
    color: string;
    description?: string;
}
export type UserCellStatev3 = {
    passed: boolean;
    directiveStates: {[key: string]: any};
}
export type GammaPageUserStatev3 = {
    visibleCellIds: string[];
    cellStates: {[key: string]: UserCellStatev3};
}
// export const GammaUserID = 'user';
// export const GammaInstructorID = 'instructor';

export type GammaNobodyParticipantv3 = GammaParticipantv3 & {
    id: 'nobody',
    name: 'Nobody'
}

export type GammaUserParticipantv3 = GammaParticipantv3 & {
    id: 'user',
    name: 'Student'
}
export type GammaInstructorParticipantv3 = GammaParticipantv3 & {
    id: 'instructor',
    name: 'Instructor',
    description: string
}

export type GammaCellv3 = {
    id: string;
    source: string | string[];
    cell_type: "message" | string;
    parentId?: string;
    childrenIds: string[];
    shortcutsTo: string[];
    metadata: {
        sender: string;
        directives: {id: string, type: string}[];
        fileDiff?: DiffPatchv3;
        editorPointers?: PointerEditorDecorationv3[];
    }
}

export type DiffPatchv3 = {
    added: string[];
    removed: string[];
    codeDiffs: {
        [filename: string]: FileChangesv3
    }
}

export type RemovalFileChangev3   = [-1, number];
export type UnchangedFileChangev3 = [ 0, number];
export type AdditionFileChangev3  = [ 1, string];
export type FileChangesv3 = (RemovalFileChangev3 | UnchangedFileChangev3 | AdditionFileChangev3)[];

export type EditorRangev3 = {
    start: EditorPositionv3;
    end: EditorPositionv3;
    wholeLine: boolean;
}
export type EditorPositionv3 = {
    line: number;
    ch: number;
}

export type EditorDecorationv3 = {
    range: EditorRangev3,
    filename: string,
    type: 'added' | 'removed' | 'pointer'
}

export type PointerEditorDecorationv3 = EditorDecorationv3 & {
    type: 'pointer'
}

export type MediaFilev3 = {
    filename: string;
    data: string;
    type: string;
}

function convertNotebookFromV3(notebook: GammaPagev3): GammaPage {
    const cellsById: {[id: string]: GammaCell} = {}
    for(const id in notebook.cellsById) {
        const cell = notebook.cellsById[id];
        cellsById[id] = {
            id: cell.id,
            source: cell.source,
            type: cell.cell_type,
            parentId: cell.parentId,
            childrenIds: cell.childrenIds,
            shortcutsTo: [],
            directives: cell.metadata.directives || undefined,
            fileDiff: cell.metadata.fileDiff,
            senderId: cell.metadata.sender,
            isAIContent: false,
            editorPointers: cell.metadata.editorPointers?.map((ep) => {
                return {type: ep.type, filename: ep.filename, startLineNumber: ep.range.start.line, startColumn: ep.range.start.ch, endLineNumber: ep.range.end.line, endColumn: ep.range.end.ch};
            })
        };
    }

    return {
        id: notebook.id,
        participants: notebook.participants,
        userState: {...notebook.userState, selectedCellId: false, highlightedCellIds: []},
        cellsById,
        terminalCellId: null,
        media: notebook.media,
        dbookformat: 4,
        dbookformat_minor: 0,
    };
}

export function convertNotebookToLatest(notebook: GammaPage | GammaPagev1 | GammaPagev2 | GammaPagev3): GammaPage {
    if(notebook.dbookformat === 1) {
        return convertNotebookFromV1(notebook as GammaPagev1);
    } else if(notebook.dbookformat === 2) {
        return convertNotebookFromV2(notebook as GammaPagev2);
    } else if(notebook.dbookformat === 3) {
        return convertNotebookFromV3(notebook as GammaPagev3);
    } else {
        return notebook as GammaPage;
    }
}