import * as React from 'react';
import { postAndAwaitResponse } from '../utils/webview-message-utils';
import { ShowAlertMessage, UploadFileMessage, UploadedFilesResponse } from '../../messages';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { base64ToUint8, encodeURL, estimateStringSpaceUsage, generateUUID, uint8ToBase64 } from '../utils/dpage-utils';
import { MediaFile } from '../../dpage';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { PageState, addMediaFile, removeMediaFile, renameMediaFile } from '../store';
import { EditableDisplay } from './EditableDisplay';
// import React, { useState, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SVGOverlayProps { }
interface SVGOverlayState {
    paths: {[id: string]: {path: string, props: {[propName: string]: string}}};
}

class SVGOverlay extends React.Component<SVGOverlayProps, SVGOverlayState> {
    constructor(props: SVGOverlayProps) {
        super(props);
        this.state = {
            paths: {}
        };
    }

    public addPath(path: string, props: {[propName: string]: string} = {}): string {
        const id = generateUUID();
        this.setState((state) => ({paths: {...state.paths, [id]: {path, props}}}));
        return id;
    }

    public removePath(id: string): void {
        this.setState((state) => {
            const paths = {...state.paths};
            delete paths[id];
            return {paths};
        });
    }

    public clearPaths(): void {
        this.setState({paths: {}});
    }

    public setPath(id: string, path: string, props: {[propName: string]: string} = {}): void {
        this.setState((state) => {
            const paths = {...state.paths};
            paths[id] = {path, props};
            return {paths};
        });
    }

    public render(): React.JSX.Element {
        return (
            <div className="svg-overlay">
                <svg>
                    {
                        Object.keys(this.state.paths).map((id) => <path key={id} d={this.state.paths[id].path} {...this.state.paths[id].props} />)
                    }
                </svg>
            </div>
        );
    }
};

export default SVGOverlay;