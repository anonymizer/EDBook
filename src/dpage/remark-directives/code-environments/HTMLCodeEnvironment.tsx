import { MutableRefObject } from "react";
import * as React from "react";
import { fuzzyDOMMatch, isFunction, parseStringToDOM } from "../../utils/dpage-utils";
import { CodeEnvironment } from "./CodeEnvironment";
import i18n from '../../widgets/i18nConfig';

interface HTMLCodeEnvironmentProps {
    initialCode: string,
    testCode: string,
    onPass: () => void,
    onFail: () => void
}

interface HTMLCodeEnvironmentState {
    htmlCode: string,
    hasInitialRef: boolean
}

export default class HTMLCodeEnvironment extends React.Component<HTMLCodeEnvironmentProps, HTMLCodeEnvironmentState> implements CodeEnvironment {
    private htmlOutputRef: MutableRefObject<HTMLDivElement|null> = React.createRef();
    constructor(props: HTMLCodeEnvironmentProps) {
        super(props);
        this.state = {
            htmlCode: props.initialCode,
            hasInitialRef: false
        };
        this.runTests();
    }
    public codeChanged(newCode: string) {
        this.setState({htmlCode: newCode});
        this.runTests();
    }
    private async runTests() {
        const testResult = eval(this.props.testCode);
        if(isFunction(testResult)) {
            const result = await testResult(this.htmlOutputRef.current, utilityFunctions);
            if(result) {
                this.props.onPass();
            } else {
                this.props.onFail();
            }
        } else {
            this.props.onPass();
        }
    }
    public render() {
        return <div>
            <label>{i18n.t('output')}:</label>
            <hr className="gamma-control" />
            <div dangerouslySetInnerHTML={{__html: this.state.htmlCode}} ref={newRef => { this.htmlOutputRef.current = newRef; if(!this.state.hasInitialRef) this.setState({hasInitialRef: true}) }}></div>
            <label>{i18n.t('DOMTree')}:</label>
            <hr className="gamma-control" />
            <ul>
                {this.htmlOutputRef.current && Array.from(this.htmlOutputRef.current.children).map((n, i) => <DOMNode key={i} node={n} />) }
            </ul>
        </div>;
    }
}

const utilityFunctions = {
    fuzzyDOMMatch, parseStringToDOM
};


interface DOMNodeProps {
    node: Node;
}

const DOMNode: React.FunctionComponent<DOMNodeProps> = ({ node }) => {
    const isElement = node.nodeType === Node.ELEMENT_NODE;
    const isText = node.nodeType === Node.TEXT_NODE;

    const element = isElement ? (node as Element) : null;

    return (
        <li>
            {isElement && (
                <span>
                    <strong>{element!.tagName}</strong>
                    {Array.from(element!.attributes).map((attr, index) => (
                        <span key={index}>
                            {" "}
                            {attr.name}=&quot;{attr.value}&quot;
                        </span>
                    ))}
                </span>
            )}
            {isText && <span>{node.textContent}</span>}
            {isElement && element!.hasChildNodes() && (
                <ul>
                    {Array.from(element!.childNodes).map((childNode, index) => (
                        <DOMNode key={index} node={childNode} />
                    ))}
                </ul>
            )}
        </li>
    );
};