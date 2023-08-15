import * as React from "react";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { markCellPassed, setDirectiveState } from "../store";
import { DirectiveProps } from "./directives";

interface ButtonDirectiveProps extends DirectiveProps {
    children: string,
    state: ButtonDirectiveState
}
interface ButtonDirectiveState {
    clicked: boolean
}

const ButtonDirectiveComponent: React.FC<ButtonDirectiveProps> = ( {children, id, cellId, state} ) => {
    const dispatch = useDispatch();
    const onClick = useCallback(() => {
        dispatch(setDirectiveState({cellId, directiveId: id, state: ({clicked: true} as ButtonDirectiveState)}));
        dispatch(markCellPassed({cellId, passed: true}));
    }, [cellId, dispatch, id]);
    return <button disabled={state?.clicked} type="button" className="gamma-control" onClick={onClick}>{children}</button>;
};

export default {
    'button': ButtonDirectiveComponent
};