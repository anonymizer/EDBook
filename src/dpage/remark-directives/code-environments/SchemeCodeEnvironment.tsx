import * as React from "react";
import { CodeEnvironment } from "./CodeEnvironment";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import std from '@jcubic/lips/dist/std.scm';
import i18n from '../../widgets/i18nConfig';
// import std from '!!raw-loader!./std.scm';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { exec, env, Pair, nil } = require("@jcubic/lips").default;

env.set('assert', function(condition: boolean, message?: string) {
    if (!condition) {
        if(!message) {
            message = `Assertion failed`;
        }
        throw new Error(message);
    }
    return true;
});
const stdExecPromise = exec(std);

interface SchemeCodeEnvironmentProps {
    initialCode: string,
    testCode: string,
    onPass: () => void,
    onFail: () => void,
}

interface SchemeCodeEnvironmentState {
    code: string,
    hasInitialRef: boolean,
    isLoading: boolean,
    output: string[],
    errorOutput: string[]
}

export default class SchemeCodeEnvironment extends React.Component<SchemeCodeEnvironmentProps, SchemeCodeEnvironmentState> implements CodeEnvironment {
    constructor(props: SchemeCodeEnvironmentProps) {
        super(props);
        this.state = {
            code: props.initialCode,
            output: [],
            errorOutput: [],
            hasInitialRef: false,
            isLoading: false
        };
    }
    public codeChanged(newCode: string) {
        this.setState({code: newCode});
    }
    
    private async executePythonCode(code: string): Promise<void> {
        try {
            this.setState({ output: [], errorOutput: []});
            // env.inherit('gamma', {
            //     stdout: {
            //         write: (...args: any[]) => {
            //             console.log(args);
            //             this.setState((state) => ({ output: [...state.output, args.join(' ')] }));
            //             // args.forEach((arg) => {
            //                 // term.echo(arg, {keepWords: true});
            //             // });
            //         }
            //     }
            // });
            env.set('print', (...args: any[]) => {
                this.setState((state) => ({ output: [...state.output, args.join(' ')] }));
                return args;
            });
            env.set('display', (...args: any[]) => {
                this.setState((state) => ({ output: [...state.output, args.join(' ')] }));
                return args;
            });
            env.set('console-log', (...args: any[]) => {
                console.log(args);
                return args;
            });
            //eslint-disable-next-line no-debugger
            // debugger;
            await stdExecPromise; // Should already have run but just in case...
            const results = await exec(code);
            this.setState({ output: results.map((r: any) => r && r.toString() || ''), isLoading: false});

            const testCode = this.props.testCode;
            if(testCode) {
                let outputCons = nil;
                for(let i = results.length-1; i>=0; i--) {
                    if(Array.isArray(results[i])) {
                        for(let j = 0; j < results[i].length; j++) {
                            outputCons = Pair(results[i][j], outputCons);
                        }
                    } else {
                        outputCons = Pair(results[i], outputCons);
                    }
                }
                env.set('output', outputCons);
                await exec(testCode);
            }
            this.props.onPass();
        } catch (error) {
            console.error(error);
            this.setState((state) => ({ errorOutput: [...state.errorOutput, `${error}`] }));
            this.props.onFail();
        }
    }
    private handleRunCode = async () => {
        await this.executePythonCode(this.state.code);
    };
  
    public render() {      
        return <div>
            <button className="gamma-control" disabled={this.state.isLoading} onClick={this.handleRunCode}><i className="codicon codicon-play"></i>&nbsp;{i18n.t('run')}</button>
            {this.state.isLoading && <div className="loading"><VSCodeProgressRing /> {i18n.t('loading')}</div>}
            {!this.state.isLoading && <div>
                {(this.state.output.length > 0 || this.state.errorOutput.length > 0) && <hr className="gamma-control" /> }
                <pre>{this.state.output.join('\n')}</pre>
                {this.state.errorOutput.length > 0 && <pre className="error">{this.state.errorOutput.join('\n')}</pre>}
            </div>
            }
        </div>;
    }
}

