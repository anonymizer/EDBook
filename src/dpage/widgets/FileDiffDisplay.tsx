
import * as React from 'react';
import * as classNames from "classnames";
import { VSCodeLink } from '@vscode/webview-ui-toolkit/react';
import { DiffEditor } from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';

interface FileDiffDisplayProps {
    oldFiles: { [fname: string]: string },
    newFiles: { [fname: string]: string }
}

export const FileDiffDisplay: React.FC<FileDiffDisplayProps> = ({ oldFiles, newFiles }) => {
    const [showDifFor, setShowDifFor] = React.useState<string|null>(null);
    const setShowDiffFile = React.useCallback((fname: string) => {
        if(showDifFor === fname) {
            setShowDifFor(null);
        } else {
            setShowDifFor(fname);
        }
    }, [showDifFor]);
    const {t} = useTranslation();

    const createdFiles = Object.keys(newFiles).filter(fname => !oldFiles[fname]);
    const editedFiles  = Object.keys(newFiles).filter(fname => (newFiles[fname] && oldFiles[fname]) && newFiles[fname] !== oldFiles[fname]);
    const deletedFiles = Object.keys(oldFiles).filter(fname => !newFiles[fname]);

    if(editedFiles.length === 0 && createdFiles.length === 0 && deletedFiles.length === 0) {
        return null;
    } else {
        const createdLinks = createdFiles.map((cf) => getFileLink(cf, () => setShowDiffFile(cf), showDifFor===cf));
        const edititedLinks = editedFiles.map((ef) => getFileLink(ef, () => setShowDiffFile(ef), showDifFor===ef));
        const deletedLinks = deletedFiles.map((df) => getFileLink(df, () => setShowDiffFile(df), showDifFor===df));

        const createdEnglishContent: (string|JSX.Element)[] = createdLinks.length > 0  ? [t('created'), ...englishifyMultiples(createdLinks)] : [];
        const editedEnglishContent: (string|JSX.Element)[]  = edititedLinks.length > 0 ? [t('edited'), ...englishifyMultiples(edititedLinks)] : [];
        const deletedEnglishContent: (string|JSX.Element)[] = deletedLinks.length > 0  ? [t('deleted'), ...englishifyMultiples(deletedLinks)] : [];

        const changedEnglishContent: (string|JSX.Element)[] = insertBetween<(string|JSX.Element)[]>([createdEnglishContent, editedEnglishContent, deletedEnglishContent].filter(x => x.length>0), ['; ']).flat();

        const theme_kind = document.body.getAttribute('data-vscode-theme-kind') === 'vscode-dark' ? 'vs-dark' : 'vs-light';
        return <>
            ({changedEnglishContent})
            { showDifFor && <DiffEditor theme={theme_kind}
                                        original={oldFiles[showDifFor] || ''}
                                        modified={newFiles[showDifFor] || ''}
                                        options={{readOnly: true, wordWrap: 'on'}}
                                        height="25vh"
                                        /> }
        </>
    }
};

function insertBetween<T>(arr: T[], value: T): T[] {
    return arr.flatMap((element, index) => index < arr.length - 1 ? [element, value] : [element]);
}

function englishifyMultiples<T>(arr: T[]): (T|string)[] {
    if(arr.length <= 1) {
        return arr;
    } else if(arr.length === 2) {
        return insertBetween<T|string>(arr, ' and ');
    } else {
        return [...insertBetween<T|string>(arr.slice(0, -1), ', '), ', and ', arr[arr.length-1]];
    }
}

function getFileLink(fname: string, onClick: () => any, isSelected: boolean): JSX.Element {
    return <button key={fname} onClick={onClick} className={classNames('gamma-link', 'file-diff-link', isSelected && 'selected')}>{fname}</button>;
}