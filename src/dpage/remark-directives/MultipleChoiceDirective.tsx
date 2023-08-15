/* eslint-disable @typescript-eslint/ban-types */
import * as React from "react";
import { ReactElement } from "react-markdown/lib/react-markdown";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { DirectiveProps } from "./directives";
import * as classNames from "classnames";
import { setDirectiveState, markCellPassed } from "../store";
import { useTranslation } from "react-i18next";

enum OptionFeedbackType {
    CORRECT="correct",
    INCORRECT="incorrect",
    NONE="none"
}

export enum MultipleChoiceSubmittedState {
    NOT_SUBMITTED="not_submitted",
    INCORRECT="incorrect",
    CORRECT="correct"
}

interface MultipleChoiceProps extends DirectiveProps {
    children: ReactElement[],
    multiple?: boolean,
    correct?: string,
    incorrect?: string
    components: {[key: string]: any}
    state?: MultipleChoiceState
}
interface MultipleChoiceState {
    selectionState: boolean[]
    submittedState: MultipleChoiceSubmittedState
}

const MultipleChoiceComponent: React.FC<MultipleChoiceProps> = ( {state, cellId, children, components, multiple, id, correct: correctFeedback, incorrect: incorrectFeedback} ) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const promptChildren: React.ReactElement<{}, string | React.JSXElementConstructor<any>>[] = [];
    const optionChildren: React.ReactElement<{}, string | React.JSXElementConstructor<any>>[] = [];
    const listedChildren: React.ReactElement<{}, string | React.JSXElementConstructor<any>>[] = [];

    if(children) {
        let foundFirstOption = false;
        for(let i = 0; i < children.length; i++) {
            const child = children[i];
            if(child.type === components.option) {
                optionChildren.push(child);
                listedChildren.push(child);
                foundFirstOption = true;
            } else if(foundFirstOption) { // we already found the first option so this should
                // be displayed as a list item rather than part of the prompt
                listedChildren.push(child);
            } else {
                promptChildren.push(child);
            }
        }
    }

    const correctOptions = optionChildren.map((child: any) => Object.prototype.hasOwnProperty.call(child.props, 'correct') && (child.props.correct !== false));
    const numOptions = optionChildren.length;
    const numCorrectOptions = correctOptions.filter((v) => v).length;
    const hasMultipleCorrectOptions = (multiple || numCorrectOptions !== 1);
    const optionType = hasMultipleCorrectOptions ? 'checkbox' : 'radio';


    const onSubmit = useCallback(() => {
        const checkedOptions = getCheckedOptions(state, numOptions);
        const isCorrectArr = checkedOptions.map((v, i) => v === correctOptions[i]);
        const allCorrect = isCorrectArr.every((v) => v);


        if(allCorrect) {
            dispatch(setDirectiveState({cellId, directiveId: id, state: ({selectionState: checkedOptions, submittedState: MultipleChoiceSubmittedState.CORRECT  } as MultipleChoiceState)}));
        } else {
            dispatch(setDirectiveState({cellId, directiveId: id, state: ({selectionState: checkedOptions, submittedState: MultipleChoiceSubmittedState.INCORRECT} as MultipleChoiceState)}));
        }
        dispatch(markCellPassed({cellId, passed: allCorrect}));
    }, [cellId, correctOptions, dispatch, id, numOptions, state]);

    const revealAnswer = useCallback(() => {
        dispatch(setDirectiveState({cellId, directiveId: id, state: ({selectionState: correctOptions, submittedState: MultipleChoiceSubmittedState.CORRECT} as MultipleChoiceState)}));
        dispatch(markCellPassed({cellId, passed: true}));
    }, [cellId, correctOptions, dispatch, id]);

    const onInputChange = useCallback((optionIndex: number) => {
        const checkedOptions = getCheckedOptions(state, numOptions);

        if(optionType === 'radio') {
            for(let i = 0; i<checkedOptions.length; i++) {
                checkedOptions[i] = (i === optionIndex);
            }
        } else {
            checkedOptions[optionIndex] = !checkedOptions[optionIndex];
        }
        dispatch(setDirectiveState({cellId, directiveId: id, state: ({selectionState: checkedOptions, submittedState: MultipleChoiceSubmittedState.NOT_SUBMITTED} as MultipleChoiceState)}));
    }, [cellId, dispatch, id, numOptions, state, optionType]);
    const selectionState = state?.selectionState;
    const displayState = state?.submittedState || MultipleChoiceSubmittedState.NOT_SUBMITTED;

    return <>
        { promptChildren }
        <ul className="multiple-choice">
            {
                listedChildren.map((child, idx) => {
                    const isOption = child.type === components.option;
                    if(isOption) {
                        const optionIndex = optionChildren.indexOf(child);
                        const checked = !!(selectionState && selectionState[optionIndex]);
                        const shouldBeChecked = !!(correctOptions[optionIndex]);
                        let feedbackType: OptionFeedbackType = OptionFeedbackType.NONE;
                        if(displayState === MultipleChoiceSubmittedState.INCORRECT) {
                            if(optionType === 'radio') {
                                if(checked && !shouldBeChecked) {
                                    feedbackType = OptionFeedbackType.INCORRECT;
                                }
                            }
                        }

                        return <li key={`${optionIndex}-${checked}`} className="multiple-choice-item">
                            {(components.option as React.FC<OptionProps>)({...child.props, type: optionType, value: `${optionIndex}`, optionIndex, id, name: id, onChange:onInputChange, checked, feedbackType })}
                        </li>;
                    } else {
                        return <li key={idx}>{child}</li>;
                    }
                })
            }
            {displayState === MultipleChoiceSubmittedState.CORRECT && <li className="valid-feedback">{correctFeedback || t('MultipleChoiceSubmittedState.correct')}</li>}
            {displayState === MultipleChoiceSubmittedState.INCORRECT && <li className="invalid-feedback">{incorrectFeedback || t('MultipleChoiceSubmittedState.incorrect')}</li>}
        </ul>
        <div className="">
            <button onClick={onSubmit} className="gamma-control">{t('submit')}</button>
            <button onClick={revealAnswer} className="gamma-control secondary">{t('revealAnswer')}</button>
        </div>
    </>;
};

type OptionProps = {
    type: "radio"|"checkbox",
    children?: ReactElement[],
    checked: boolean,
    id: string,
    name: string,
    value: string,
    optionIndex: number,
    feedback?: string,
    feedbackType: OptionFeedbackType,
    onChange?: (idx: number) => void,
}

const OptionComponent: React.FC<OptionProps> = ( {checked, children, type, id, name, value, onChange, feedbackType, feedback, optionIndex} ) => {
    // const changeCallback = useCallback(() => {
    //     onChange && onChange(optionIndex);
    // }, [onChange, optionIndex]);
    // const changeCallback = () => null;
    // const { t } = useTranslation();

    return <label onClick={() => onChange && onChange(optionIndex)} className="gamma-control form-check-label stretched-link">
            <input type={type} checked={checked} name={name} value={value} className={classNames("gamma-control", "multiple-choice-option", {"is-valid": feedbackType===OptionFeedbackType.CORRECT, "is-invalid": feedbackType===OptionFeedbackType.INCORRECT})} />
            {children}
            {/* {feedbackType === OptionFeedbackType.CORRECT && <span className="valid-feedback">&nbsp;{feedback || t('OptionFeedbackType.correct')}</span>}
            {feedbackType === OptionFeedbackType.INCORRECT && <span className="invalid-feedback">&nbsp;{feedback || t('OptionFeedbackType.incorrect')}</span>} */}
            {feedbackType === OptionFeedbackType.CORRECT && <span className="valid-feedback">&nbsp;{feedback || "Correct!"}</span>}
            {feedbackType === OptionFeedbackType.INCORRECT && <span className="invalid-feedback">&nbsp;{feedback || "Incorrect"}</span>}
        </label>;
};
OptionComponent.displayName = 'option';

export default {'multiple-choice': MultipleChoiceComponent, 'option': OptionComponent};

function getCheckedOptions(state: MultipleChoiceState|undefined, numOptions: number): boolean[] {
    const checkedOptions: boolean[] = state ? ([...state.selectionState] || []) : [];

    if(checkedOptions.length > numOptions) {
        checkedOptions.splice(numOptions, (checkedOptions.length - numOptions));
    } else {
        while(checkedOptions.length < numOptions) {
            checkedOptions.push(false);
        }
    }
    return checkedOptions;
}