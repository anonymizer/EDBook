import * as React from "react";
import { CodeEnvironment } from "./CodeEnvironment";
import { loadPyodide } from 'pyodide';
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";

interface PythonCodeEnvironmentProps {
    initialCode: string,
    testCode: string,
    onPass: () => void,
    onFail: () => void
}

interface PythonCodeEnvironmentState {
    code: string,
    hasInitialRef: boolean,
    isLoading: boolean,
    output: string[],
    errorOutput: string[]
}

export default class PythonCodeEnvironment extends React.Component<PythonCodeEnvironmentProps, PythonCodeEnvironmentState> implements CodeEnvironment {
    constructor(props: PythonCodeEnvironmentProps) {
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
    
    private async executePythonCode(pythonCode: string): Promise<void> {
        try {
            this.setState({ output: [], errorOutput: [], isLoading: true });
            const pyodide = await loadPyodide({
                indexURL : "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
                stdout: (outp: string) => {
                    this.setState((state) => ({ output: [...state.output, outp] }));
                },
                stderr: (erroutp: string) => {
                    this.setState((state) => ({ errorOutput: [...state.errorOutput, erroutp] }));
                },

            });
            this.setState({ isLoading: false });
            await pyodide.runPythonAsync(pythonCode);

            const testCode = this.props.testCode;
            if(testCode) {
                await pyodide.runPythonAsync(testCode);
            }
            this.props.onPass();
        } catch (error) {
            this.setState((state) => ({ errorOutput: [...state.errorOutput, `${error}`] }));
            this.props.onFail();
        }
    }
    private handleRunCode = async () => {
        await this.executePythonCode(this.state.code);
    };
  
    public render() {
        return <div>
            <button className="gamma-control" disabled={this.state.isLoading} onClick={this.handleRunCode}><i className="codicon codicon-play"></i>&nbsp;Run</button>
            {this.state.isLoading && <div className="loading"><VSCodeProgressRing /> Loading...</div>}
            {!this.state.isLoading && <div>
                {(this.state.output.length > 0 || this.state.errorOutput.length > 0) && <hr className="gamma-control" /> }
                <pre>{this.state.output.join('\n')}</pre>
                {this.state.errorOutput.length > 0 && <pre className="error">{this.state.errorOutput.join('\n')}</pre>}
            </div>
            }
        </div>;
    }
}