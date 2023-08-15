import { useCallback, useState } from "react";
import * as React from "react";
import { useStore } from "react-redux";
import { TextareaWithButton } from "./widgets/TextareaWithButton";
import classNames = require("classnames");
import { PageState } from "./store";
import { useSelector } from "react-redux";
import { GammaUserID } from "../constants";
import { GammaParticipantList } from "../dpage";
import { ReactMarkdown } from "react-markdown/lib/react-markdown";
import { useTranslation } from 'react-i18next';

export enum ResponseType {
    None = 'none',
    One  = 'one',
    Many = 'many'
}

type AddCellProps = {
    onAddCell?: (m: string, r: ResponseType, spliceIn: boolean) => void;
    onAdvance?: (id: string) => void;
    nextSuggestionCellIDs: string[];
    selectedNext: string | false;
};
export const SendMessageWidget: React.FC<AddCellProps> = ({ onAddCell, nextSuggestionCellIDs, onAdvance, selectedNext }) => {
    const store = useStore<PageState>();
    const { page } = store.getState();
    const { cellsById } = page;
    const participants: GammaParticipantList = useSelector<PageState, GammaParticipantList>((state: PageState) => state.page.participants);
    const userColor: string = participants[GammaUserID].color;
    const acceptNextSuggestion = useCallback((id: string) => {
        if(onAdvance) {
            onAdvance(id);
        }
    }, [onAdvance]);
    const {t} = useTranslation();
    // let nextSuggestion = null;
    // if(nextSuggestionCellID) {
    //     // const cellIndex = cells.indexOf(nextSuggestionCellID);
    //     const cell = cellsById[nextSuggestionCellID];
    //     if(cell) {
    //         const source = cell.source instanceof Array ? cell.source.join('\n') : cell.source;
    //         // nextSuggestion = <div className="next-suggestion"><MarkdownComponent prefix={cell.id}>{source}</MarkdownComponent></div>;
    //         nextSuggestion = <div className="next-suggestion" onClick={() => acceptNextSuggestion(nextSuggestionCellID)}>{source}</div>;
    //     }
    // }
    const onSubmit = useCallback((message: string, action?: string) => {
        const responseType = action === "no-response"
                            ? ResponseType.None
                            : action === "insert-independently"
                            ? ResponseType.None
                            : action === "many-response"
                            ? ResponseType.Many
                            : ResponseType.One;
        const spliceIn = action === 'insert-independently';

        // Check if this text exactly matches any of the next suggestions
        if(responseType === ResponseType.One) {
            for(const nextSuggestionCellID of nextSuggestionCellIDs) {
                const cell = cellsById[nextSuggestionCellID];
                if(cell) {
                    const source = cell.source instanceof Array ? cell.source.join('\n') : cell.source;

                    if(message.trim() === source.trim() && onAdvance) {
                        acceptNextSuggestion(nextSuggestionCellID);
                        return;
                    }
                }
            }
        }

        if(onAddCell) {
            onAddCell(message, responseType, spliceIn);
        }
    }, [acceptNextSuggestion, cellsById, nextSuggestionCellIDs, onAddCell, onAdvance]);


    return <div className='add-menu'>
        <span className={classNames("avatar", 'user-sent')} >
            <i className={classNames("codicon", "codicon-chevron-right")} style={{color: userColor}} />
        </span>
        {
            nextSuggestionCellIDs.map((id) => {
                const cell = cellsById[id];
                if(!cell) { return false; }
                const source = cell.source instanceof Array ? cell.source.join('\n') : cell.source;
                const senderIcon = cell.senderId !== GammaUserID && <i className={classNames("codicon", "codicon-account")} style={{color: participants[cell.senderId]?.color }} />;
                return <div key={id} className={classNames("next-suggestion", selectedNext===id && 'active-next')} onClick={() => acceptNextSuggestion(id)}>{senderIcon}<ReactMarkdown>{source}</ReactMarkdown></div>;
            })
        }
        <TextareaWithButton
                    placeholderText={t('message')}
                    buttonChildren={<i className="codicon codicon-send" />}
                    onSubmit={onSubmit}
                    otherActions={{'no-response': t('addWithoutResponse'), 'insert-independently': t('insertAsIndependentCell'), 'many-response': t('addManyResponse')}}
                    />
    </div>;
};