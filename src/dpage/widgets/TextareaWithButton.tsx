import classNames = require("classnames");
import * as React from "react";
import { getAllParents } from "../utils/dpage-utils";

type TextareaWithButtonProps = {
    placeholderText?: string,
    buttonChildren?: React.ReactNode[] | React.ReactNode,
    disableButtonIfEmpty?: boolean,
    otherActions?: {
        [key: string]: React.ReactNode[] | React.ReactNode
    },
    onSubmit?: (textContent: string, action?: string) => void
};

export const TextareaWithButton: React.FC<TextareaWithButtonProps> = ({ placeholderText, buttonChildren, otherActions, disableButtonIfEmpty, onSubmit}) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [emptyMessage, setEmptyMessage] = React.useState<boolean>(true);
    const otherActionsRef = React.useRef<HTMLUListElement>(null);
    const expandButtonRef = React.useRef<HTMLButtonElement>(null);
    const [showOtherActions, setShowOtherActions] = React.useState<boolean>(false);

    const onChange = React.useCallback(() => {
        const message = textareaRef.current?.value;
        const messageIsEmpty = !message || message.trim().length === 0;
        setEmptyMessage(messageIsEmpty);
    }, []);

    const doSubmit = React.useCallback((action?: string) => {
        if(onSubmit && textareaRef.current) {
            const message = textareaRef.current.value;
            onSubmit(message, action);
            textareaRef.current.value = '';
            onChange();
            setShowOtherActions(false);
        }
    }, [onChange, onSubmit]);

    React.useEffect(() => {
        const clickListener = (e: MouseEvent) => {
            const targetParents = getAllParents(e.target as HTMLElement | null);
            if(!targetParents.includes(otherActionsRef.current!) && !targetParents.includes(expandButtonRef.current!)) {
                setShowOtherActions(false);
                e.preventDefault();
                e.stopPropagation();
            }
        };
        const keydownListener = (e: KeyboardEvent) => {
            if(e.key === 'Escape') {
                setShowOtherActions(false);
                e.preventDefault();
                e.stopPropagation();
            } else if((e.ctrlKey || e.metaKey) && e.shiftKey) {
                const code = e.code;
                if(code.startsWith('Digit') || code.startsWith('Numpad')) {
                    try {
                        const codeInt = parseInt(code.slice(-1));
                        const otherActionsKeys = Object.keys(otherActions || {});
                        if(codeInt <= otherActionsKeys.length) {
                            const action = otherActionsKeys[codeInt - 1];
                            doSubmit(action);
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    } catch(e) {
                        return;
                    }
                }
            }
        };

        window.addEventListener('click', clickListener);
        window.addEventListener('keydown', keydownListener);

        return () => {
            window.removeEventListener('click', clickListener);
            window.removeEventListener('keydown', keydownListener);
        }
    }, [doSubmit, otherActions]);

    const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            doSubmit();
        }
    }, [doSubmit]);

    const toggleOtherActionsDisplay = React.useCallback(() => {
        setShowOtherActions((soa) => !soa);
    }, []);


    let otherActionsElements = null;
    if(otherActions && showOtherActions) {
        otherActionsElements = <ul className="other-actions" ref={otherActionsRef}> { Object.keys(otherActions).map((action) => {
                    return <li key={action} className="other-action"><button className="gamma-control" onClick={() => doSubmit(action)}>{otherActions[action]}</button></li>;
                }) } </ul>
    }

    const otherActionsDropdown = otherActions ? <button className="expand-button" disabled={emptyMessage || disableButtonIfEmpty===false} ref={expandButtonRef}><i className={classNames("codicon", showOtherActions ? "codicon-triangle-up" : "codicon-triangle-down")} onClick={toggleOtherActionsDisplay}/></button> : null;


    return <div className={classNames("text-area-with-button", otherActions && 'has-expand')}>
        <textarea placeholder={placeholderText} ref={textareaRef} onKeyDown={onKeyDown} onChange={onChange}></textarea>
        <button className="primary-action" disabled={emptyMessage || disableButtonIfEmpty===false} onClick={() => doSubmit()}>{buttonChildren}</button>{otherActionsDropdown}
        {otherActionsElements}
    </div>;
}