import multipleChoiceDirective from "./MultipleChoiceDirective";
import buttonDirectiveComponent from './SimpleButton';
import codeDirectiveComponent from "./CodeDirective";

export type DirectiveProps = {
    id: string,
    cellId: string,
    onEvent: (e: any) => void,
}

export default {
    ...buttonDirectiveComponent,
    ...multipleChoiceDirective,
    ...codeDirectiveComponent
};