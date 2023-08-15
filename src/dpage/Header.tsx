import { GammaParticipant, GammaParticipantList } from "../dpage";
import * as React from "react";
import { ChangeEvent } from "react";
import { useDispatch, useStore } from "react-redux";
import { VSCodeButton, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { PageState, addParticipant, removeParticipant, setParticipantName, setParticipantColor, setParticipantDescription, clearUserState, advanceToNextDecisionPoint } from "./store";
import { GammaInstructorID, GammaNobodyID, GammaUserID } from "../constants";
import { useSelector } from "react-redux";
import { EditableDisplay } from "./widgets/EditableDisplay";
import classNames = require("classnames");
import i18n from "./widgets/i18nConfig";
import { useTranslation } from 'react-i18next';
import { setLanguage } from './store';




// console.log('Language changed to:', i18n.language);

interface HeaderProps {
    onChangeSender?: (senderID: string) => void;
    onChangeTypingSpeed?: (newSpeed: number|false) => void;
    onChangeModel?: (model: string) => void;
}

export const HeaderComponent: React.FC<HeaderProps> = ( { onChangeSender, onChangeTypingSpeed, onChangeModel } ) => {
    const headerRef = React.useRef<HTMLDivElement>(null);
    const [collapsed, setCollapsed] = React.useState<boolean>(true);
    const [useTypingEffect, setUseTypingEffect] = React.useState<boolean>(true);
    const [isScrolledDown, setIsScrolledDown] = React.useState<boolean>(false);
    const [speed, setSpeed] = React.useState<number>(50);
    const dispatch = useDispatch();
    
    const {t} =  useTranslation();
    const onChangeLanguage = (event: ChangeEvent<HTMLSelectElement> ) => {
        i18n.changeLanguage(event.target.value);
        // console.log("before setLanguage");
        // dispatch(setLanguage());
        // dispatch(addParticipant());
        // console.log("after setLanguage");
    }
    
    React.useEffect(() => {
        const header = headerRef.current;
        const onScroll = () => {
            if(header) {
                const parentElem = header.parentElement as HTMLElement;
                const scrollTop = parentElem.scrollTop;

                setIsScrolledDown(scrollTop > 50);
            }
        }

        if(header) {
            const parentElem = header.parentElement as HTMLElement;
            parentElem.addEventListener('scroll', onScroll);
        }
        return () => {
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    const doClearUserState = React.useCallback(() => {
        dispatch(clearUserState());
        dispatch(advanceToNextDecisionPoint());
    }, [dispatch]);

    const onSlide = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setSpeed(value);
        onChangeTypingSpeed && onChangeTypingSpeed(useTypingEffect ? value : false);
    }, [onChangeTypingSpeed, useTypingEffect]);

    const toggleUseTypingEffect = React.useCallback(() => {
        const nowUsingTypingEffect = !useTypingEffect;
        setUseTypingEffect(nowUsingTypingEffect);
        onChangeTypingSpeed && onChangeTypingSpeed(nowUsingTypingEffect ? speed : false);
    }, [useTypingEffect, speed, onChangeTypingSpeed]);

    const onModelSelect = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        onChangeModel && onChangeModel(value);
    }, [onChangeModel]);
    // console.log(displayName);
    return <div id="header" ref={headerRef} className={classNames(isScrolledDown && 'dim', collapsed ? 'collapsed' : 'expanded')}>
                <ParticipantsComponent key={i18n.language} isCollapsed={collapsed} onChangeSender={(id) => onChangeSender?.(id)} currentLanguage={i18n.language} />
                { !collapsed && <><VSCodeDivider />
                    <select className="gamma-control secondary" style={{float: "left"}} defaultValue={i18n.language} onChange={onChangeLanguage}>
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="ko">한국어</option>
                        <option value="es">Español</option>
                        <option value="de">Deutsch</option>
                        <option value="zhcn">简体中文</option>
                        <option value="ar">العربية</option>
                        <option value="hi">हिन्दी</option>
                    </select>
                    <select id="modelSelect" className="gamma-control secondary" style={{float: "left"}} defaultValue="gpt-3.5-turbo" onChange={onModelSelect} >
                        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                        <option value="gpt-3.5-turbo-16k">gpt-3.5-turbo-16k</option>
                        <option value="gpt-4">gpt-4</option>
                        <option value="gpt-4-32k">gpt-4-32k</option>
                    </select>
                    <label onClick={toggleUseTypingEffect} className="gamma-control"><input type="checkbox" checked={useTypingEffect} className="gamma-control"/>&nbsp;{t('typingSpeed')}:&nbsp;</label>
                    <label className="gamma-control"><input type="range" min="1" max="100" value={speed} className="gamma-control slider" onChange={onSlide} disabled={useTypingEffect===false}></input></label>
                    <button className="gamma-control secondary" onClick={doClearUserState} style={{float: 'right'}}><i className="codicon codicon-clear-all" />{t('resetProgress')}</button>
                </>}
                
                <div className="expand-collapse"><button className="gamma-control icon" onClick={ () => setCollapsed(!collapsed)}><i className={classNames('codicon', collapsed ? 'codicon-settings' : 'codicon-settings')} /></button></div>
            </div>;
};

interface ParticipantComponentProps {
    isCollapsed: boolean;
    onChangeSender?: (senderID: string) => void;
    currentLanguage: string;
}

const ParticipantsComponent: React.FC<ParticipantComponentProps> = ( { onChangeSender, isCollapsed, currentLanguage} ) => {
    const dispatch = useDispatch();
    const participants: GammaParticipantList = useSelector<PageState, GammaParticipantList>((state: PageState) => state.page.participants);
    const [senderID, setSenderID] = React.useState<string>(GammaUserID);
    const {t} =  useTranslation();
    
    React.useEffect(() => {
        if (onChangeSender) {
            onChangeSender(senderID);
        }
    }, [senderID, onChangeSender, currentLanguage]);

    if(isCollapsed) {
        return false;
    } else {
        const canEdit = !isCollapsed;
        return <ul id="participant-list">
                {
                    Object.keys(participants).map((participantId: string) => {
                        const participant = participants[participantId];
                        const isDefaultSender = senderID === participantId;
                        const canDelete = ![GammaUserID, GammaInstructorID, GammaNobodyID].includes(participantId);
                        const color = participant.color || 'inherit';

                        const displayName = participant.name;
                        const displayColor = participant.color;

                        const displayDescription = participant.description;
                        
                        return <li key={`${participantId}-${isDefaultSender}`}>
                            <li style={{color}}><i className="codicon codicon-account" />&nbsp;<EditableDisplay initialContent={displayName} placeholder={t('name')} canEdit={canEdit} onChange={(name) => dispatch(setParticipantName({participantId, name}))} /></li>
                            <li><EditableDisplay initialContent={displayColor} placeholder={t('color')} canEdit={canEdit} onChange={(color) => dispatch(setParticipantColor({participantId, color}))} /></li>
                            <li><EditableDisplay initialContent={displayDescription || ''} placeholder={t('description')} canEdit={canEdit} onChange={(description) => dispatch(setParticipantDescription({participantId, description}))} /></li>
                            <li><label className="gamma-control" onClick={() => setSenderID(participantId)}><input className="gamma-control" type="radio" checked={isDefaultSender} value={participantId} name="default-sender" /> {t('sendAs')}</label></li>
                            <li>{canDelete && <VSCodeButton onClick={() => dispatch(removeParticipant({participantId}))}>{t('removePerson')}</VSCodeButton>}</li>
                        </li>;
                    })
                }
                <li><button className="gamma-control" onClick={() => dispatch(addParticipant())}>{t('addPerson')}</button></li>
            </ul>;
    }
};