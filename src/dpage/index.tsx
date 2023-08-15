import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style/index.scss';
import { Provider } from 'react-redux';
import store from './store';
import { VSCodeBadge, VSCodeButton, VSCodeCheckbox, VSCodeDropdown, VSCodeOption, VSCodeRadio, VSCodeTextArea, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <Provider store={store}>
        {/* <VSCodeButton appearance="secondary">Hello</VSCodeButton>
        <button className="gamma-control secondary">Hello</button> */}
        {/* <VSCodeButton appearance="icon" className="menu-button"><i className="codicon codicon-edit"></i></VSCodeButton>
        <button className="gamma-control icon"><i className="codicon codicon-edit"></i></button> */}
        {/* <VSCodeTextArea />
        <textarea className="gamma-control" /> */}
        {/* <input type="text" className="gamma-control" placeholder='yo' />
        <VSCodeTextField placeholder="yo"/> */}
        {/* <input disabled type="text" className="gamma-control" placeholder='yo' />
        <VSCodeTextField disabled placeholder="yo"/> */}
        {/* <VSCodeButton appearance="secondary" disabled>Hello</VSCodeButton>
        <button className="gamma-control secondary" disabled>Hello</button> */}

        {/* <VSCodeCheckbox label="Hello">Hello</VSCodeCheckbox>
        <VSCodeCheckbox label="Hello" checked>Hello</VSCodeCheckbox>
        <label className="gamma-control"><input type="checkbox" className="gamma-control" checked></input> Hello</label>
        <label className="gamma-control"><input type="checkbox" className="gamma-control"></input> Hello</label> */}

        {/* <VSCodeRadio label="Hello">Hello</VSCodeRadio>
        <label className="gamma-control"><input type="radio" className="gamma-control" checked></input> Hello</label>
        <label className="gamma-control"><input type="radio" className="gamma-control"></input> Hello</label> */}

        {/* <select className="gamma-control">
            <option>hello</option>
            <option>evening</option>
            <option>bye</option>
        </select> */}

        {/* <VSCodeDropdown>
            <VSCodeOption>hello</VSCodeOption>
            <VSCodeOption>evening</VSCodeOption>
            <VSCodeOption>bye</VSCodeOption>
        </VSCodeDropdown> */}

        <App />
    </Provider>
);