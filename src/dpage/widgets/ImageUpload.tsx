import * as React from 'react';
import { postAndAwaitResponse } from '../utils/webview-message-utils';
import { ShowAlertMessage, UploadFileMessage, UploadedFilesResponse } from '../../messages';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { base64ToUint8, encodeURL, estimateStringSpaceUsage, uint8ToBase64 } from '../utils/dpage-utils';
import { MediaFile } from '../../dpage';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { PageState, addMediaFile, removeMediaFile, renameMediaFile } from '../store';
import { EditableDisplay } from './EditableDisplay';
import { useTranslation } from 'react-i18next';
// import React, { useState, useEffect } from "react";

interface ImageUploadProps {
    onUpload?: (image: MediaFile) => void
}

const ImageUpload: React.FC<ImageUploadProps> = ({onUpload}) => {
    const {t} = useTranslation();
    const dispatch = useDispatch();
    const mediaFiles = useSelector<PageState, {[fname: string]: MediaFile}>((state) => state.page.media || {});
    const doUploadFile = React.useCallback(async () => {
        const { files } = await postAndAwaitResponse({message: 'upload-file', options: { 
                                                        filters: {
                                                            'Images': ['png', 'gif', 'jpg', 'jpeg']
                                                        },
                                                        openLabel: 'Upload Image',
                                                        canSelectFiles: true,
                                                        canSelectFolders: false,
                                                        canSelectMany: true,
                                                    }} as UploadFileMessage) as UploadedFilesResponse;
        for(const {filename: originalFilename, content} of Object.values(files)) {
            const encodedFilename = encodeURL(originalFilename);
            const data = uint8ToBase64(content);
            const mediaFile: MediaFile = {filename: encodedFilename, data, type: 'image'};
            dispatch(addMediaFile({mediaFile}));
            onUpload && onUpload(mediaFile);
        }
    }, [dispatch, onUpload]);

    return (
        <ul className="media-uploads">
            {Object.values(mediaFiles).map((mediaFile) => (
                <li key={mediaFile.filename} className="media-file"><MediaFileDisplay mediaFile={mediaFile} /></li>
            ))}
            <li><VSCodeButton onClick={() => doUploadFile()}><i className='codicon codicon-add' />{t('addImage')}</VSCodeButton></li>
        </ul>
    );
}
interface MediaFileDisplayProps {
    mediaFile: MediaFile
}

const MediaFileDisplay: React.FC<MediaFileDisplayProps> = ({mediaFile}) => {
    const dispatch = useDispatch();
    const onChange = React.useCallback((changedName: string) => {
        if(changedName.trim().length > 0) {
            const encodedFilename = encodeURL(changedName);
            dispatch(renameMediaFile({oldFilename: mediaFile.filename, newFilename: encodedFilename}));
        }
    }, [dispatch, mediaFile.filename]);
    const onRemove = React.useCallback(() => {
        dispatch(removeMediaFile({filename: mediaFile.filename}));
    }, [dispatch, mediaFile.filename]);
    const {t} = useTranslation();

    const copyMarkdown = React.useCallback(async () => {
        const { filename } = mediaFile;
        const markdownCode = `![image](${filename})`;
        await window.navigator['clipboard'].writeText(markdownCode);
        postAndAwaitResponse({message: 'show-alert', content: `Copied to clipboard: "${markdownCode}"`, type: 'info'} as ShowAlertMessage, false);
    }, [mediaFile]);

    const fileSize = estimateStringSpaceUsage(mediaFile.data);
    const ui8data = base64ToUint8(mediaFile.data);
    const blob = new Blob([ui8data]);
    const url = URL.createObjectURL(blob);
    return <><img src={url} alt={mediaFile.filename} style={{maxWidth: "50px", maxHeight: "50px"}}/>
            <EditableDisplay initialContent={mediaFile.filename} onChange={onChange} avoidSelectingExtension={true}/>
            <br />
            {fileSize}
            <br />
            <VSCodeButton appearance="secondary" onClick={copyMarkdown}><i className='codicon codicon-clippy' />&nbsp;{t('copyMarkdown')}</VSCodeButton>
            <VSCodeButton appearance="secondary" onClick={onRemove}><i className='codicon codicon-trash' />&nbsp;{t('remove')}</VSCodeButton>
            </>;
}

export default ImageUpload;
