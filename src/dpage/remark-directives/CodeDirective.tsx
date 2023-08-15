import * as React from "react";
import * as monaco from 'monaco-editor';
import { ReactElement } from "react-markdown/lib/react-markdown";
import { useCallback, useRef } from "react";
import { useDispatch } from "react-redux";
import { DirectiveProps } from "./directives";
import { Editor } from "@monaco-editor/react";
import HTMLCodeEnvironment from "./code-environments/HTMLCodeEnvironment";
import { setDirectiveState, markCellPassed } from "../store";
import { getEditorTheme } from "../utils/dpage-utils";
import PythonCodeEnvironment from "./code-environments/PythonCodeEnvironment";
import { CodeEnvironment } from "./code-environments/CodeEnvironment";
import SchemeCodeEnvironment from "./code-environments/SchemeCodeEnvironment";
import { useTranslation } from "react-i18next";

interface CodeDirectiveProps extends DirectiveProps {
    children: ReactElement[],
    state: CodeDirectiveState
    correct?: string,
    passed?: boolean
}
interface CodeDirectiveState {
    userCode: string,
    showingSolution: boolean
}

const CodeDirectiveComponent: React.FC<CodeDirectiveProps> = ( { children, cellId, id, state, correct: correctFeedback} ) => {
    const dispatch = useDispatch();
    // console.log(children);
    const envRef = useRef<CodeEnvironment|null>(null);
    const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor|null>(null);
    const [passed, setPassed] = React.useState(false);
    const {t} = useTranslation();
    // const [showingSolution, setShowingSolution] = React.useState(false);
    let defaultLanguage = '';
    let unformattedContent = '';
    let defaultCodeContent = '';
    let testContent = '';
    let sampleSolution = '';
    let environment = '';
    const preChildren = [];
    let height = '10em';
    for(const child of children || []) {
        if(child.type === 'language') {
            if(Object.prototype.hasOwnProperty.call(child.props, 'children') && (child.props as any).children.length > 0) {
                defaultLanguage = (child.props as any).children[0];
            }
        } else if(child.type === 'environment') {
            if(Object.prototype.hasOwnProperty.call(child.props, 'children') && (child.props as any).children.length > 0) {
                environment = (child.props as any).children[0];
            }
        } else if(child.type === 'p') {
            if(Object.prototype.hasOwnProperty.call(child.props, 'children') && (child.props as any).children.length > 0) {
                unformattedContent = (child.props as any).children.join('');
            }
        } else if(child.type === 'pre') {
            if(Object.prototype.hasOwnProperty.call(child.props, 'children') && (child.props as any).children.length > 0) {
                const sources = (child.props as any).children.map((c: any) => {
                    return c.props.children.join('');
                });
                preChildren.push(...sources);
            }
        } else if(child.type === 'height') {
            if(Object.prototype.hasOwnProperty.call(child.props, 'children') && (child.props as any).children.length > 0) {
                height = (child.props as any).children.join('');
            }
        }
    }

    if(preChildren.length > 0) {
        defaultCodeContent = preChildren[0];
        if(preChildren.length > 1) {
            testContent = preChildren[1];
            if(preChildren.length > 2) {
                sampleSolution = preChildren[2];
            }
        }
    } else {
        defaultCodeContent = unformattedContent;
    }

    // console.log(codeContent);
    // const parts = codeContent.split(/\+{3,}/); // split by 3 or more +'s
    // console.log(parts);

    // const filteredParts = parts.filter(part => part.trim() !== '');
    // console.log(filteredParts);
    // console.log(codeContent);
    // console.log(parts);
    // if(parts.length > 0) {
    //     defaultCodeContent = parts[0].trim();
    //     if(parts.length > 1) {
    //         testContent = parts[1].trim();
    //         if(parts.length > 2) {
    //             sampleSolution = parts[2].trim();
    //         }
    //     }
    // } else {
    //     defaultCodeContent = codeContent;
    // }

    React.useEffect(() => {
        dispatch(setDirectiveState({cellId, directiveId: id, state: ({showingSolution: false} as CodeDirectiveState)}));
    }, [cellId, dispatch, id]);

    let currentUserCode = defaultCodeContent;
    const isShowingSolution = state && Object.prototype.hasOwnProperty.call(state, 'showingSolution') && state.showingSolution;
    const storedUserCode = (state && Object.prototype.hasOwnProperty.call(state, 'userCode')) ? state.userCode : '';
    // const shouldIgnoreEditorChanges = isShowingSolution;
    const shouldIgnoreEditorChanges = useRef<boolean>(isShowingSolution);

    if(isShowingSolution) {
        currentUserCode = sampleSolution;
    } else if(storedUserCode) {
        currentUserCode = storedUserCode;
    }

    const onChange = useCallback((code?: string) => {
        if(!shouldIgnoreEditorChanges.current) {
            dispatch(setDirectiveState({cellId, directiveId: id, state: ({userCode: code} as CodeDirectiveState)}));
        }
        if(envRef.current) {
            envRef.current.codeChanged(code || '');
        }
        // dispatch(markCellPassed({cellId, passed: true}));
    }, [cellId, dispatch, id]);
    const onPass = useCallback(() => {
        dispatch(markCellPassed({cellId, passed: true}));
        setPassed(true);
    }, [cellId, dispatch]);
    const onFail = useCallback(() => {
        dispatch(markCellPassed({cellId, passed: false}));
        setPassed(false);
    }, [cellId, dispatch]);

    const toggleShowSolution = useCallback(() => {
        const editor = editorRef.current;
        if(editor) {
            const isShowingSolution = state && Object.prototype.hasOwnProperty.call(state, 'showingSolution') && state.showingSolution;
            if(isShowingSolution) {
                dispatch(setDirectiveState({cellId, directiveId: id, state: ({showingSolution: false} as CodeDirectiveState)}));
                shouldIgnoreEditorChanges.current = false;

                onChange(storedUserCode);
            } else {
                shouldIgnoreEditorChanges.current = true;
                dispatch(setDirectiveState({cellId, directiveId: id, state: ({showingSolution: true} as CodeDirectiveState)}));
            }
        }
    }, [state, dispatch, cellId, id, onChange, storedUserCode]);
    const skip = useCallback(() => {
        dispatch(markCellPassed({cellId, passed: true}));
        setPassed(true);
    }, [cellId, dispatch]);

    return <div>
        <Editor
            value={currentUserCode}
            onChange={onChange}
            options={{
                // lineNumbers: 'off',
                quickSuggestions: false,
                // renderLineHighlight: 'none',
                fontSize: 16,
                minimap: { enabled: false },
                readOnly: isShowingSolution,
                readOnlyMessage: {value: 'Editor is read-only while showing the solution. Click "Hide solution" below to edit.'},
                wordWrap: 'on' }}
            height={height}
            onMount={(editor, monaco) => {
                editorRef.current = editor;
            }}
            theme={getEditorTheme()}
            defaultLanguage={defaultLanguage}></Editor>
        <button className="gamma-control secondary" style={{float: "right"}} onClick={skip}>{t('skip')}</button>
        {sampleSolution && <button className="gamma-control secondary" style={{float: "right"}} onClick={toggleShowSolution}>{isShowingSolution ? t('hideSolution') : t('showSolution')}</button>}
        {environment === 'html'   && <HTMLCodeEnvironment   ref={(x: HTMLCodeEnvironment)   => envRef.current = x} initialCode={currentUserCode} testCode={testContent} onPass={onPass} onFail={onFail}></HTMLCodeEnvironment>}
        {environment === 'python' && <PythonCodeEnvironment ref={(x: PythonCodeEnvironment) => envRef.current = x} initialCode={currentUserCode} testCode={testContent} onPass={onPass} onFail={onFail}></PythonCodeEnvironment>}
        {environment === 'scheme' && <SchemeCodeEnvironment ref={(x: SchemeCodeEnvironment) => envRef.current = x} initialCode={currentUserCode} testCode={testContent} onPass={onPass} onFail={onFail}></SchemeCodeEnvironment>}
        {passed && <div className="valid-feedback">{correctFeedback || t('MultipleChoiceSubmittedState.correct')}</div>}
    </div>;
};

export default {
    'edit-code': CodeDirectiveComponent
};