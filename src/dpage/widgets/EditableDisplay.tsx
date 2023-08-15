import * as React from 'react';
import * as classNames from "classnames";

interface EditableDisplayProps {
    initialContent: string|null
    avoidSelectingExtension?: boolean
    placeholder?: string
    editOnMount?: boolean
    requireDoubleClick?: boolean
    onChange?: (value: string) => void
    canEdit?: boolean
}

enum EditableDisplayMode {
    Display,
    Edit
}

export const EditableDisplay: React.FC<EditableDisplayProps> = ({ editOnMount, initialContent, onChange, canEdit, placeholder, avoidSelectingExtension, requireDoubleClick }) => {
    const [mode, setMode] = React.useState<EditableDisplayMode>(editOnMount ? EditableDisplayMode.Edit : EditableDisplayMode.Display);
    const [value, setValue] = React.useState<string>(initialContent || '');
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (mode === EditableDisplayMode.Edit) {
            const inputEl = inputRef.current;
            if(inputEl) {
                inputEl.focus();
                if(avoidSelectingExtension) {
                    const value = inputEl.value;
                    const dotIndex = value.lastIndexOf('.');
                    if (dotIndex > 0) {
                        inputEl.setSelectionRange(0, dotIndex);
                    } else {
                        inputEl.select();
                    }
                } else {
                    inputEl.select();
                }
            }
        }
    }, [avoidSelectingExtension, mode]);

    const startEditing = React.useCallback(() => {
        if(canEdit !== false) {
            setMode(EditableDisplayMode.Edit);
        }
    }, [canEdit]);

    const doSubmit = React.useCallback(() => {
        const value = inputRef.current?.value || '';
        setMode(EditableDisplayMode.Display);
        setValue(value);
        if(onChange) { onChange(value); }
    }, [onChange]);

    const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            doSubmit();
        } else if(e.key === 'Escape') {
            setMode(EditableDisplayMode.Display);
        }
    }, [doSubmit]);

    const onBlur = React.useCallback(() => {
        doSubmit();
    }, [doSubmit]);

    const usePlaceholder = !value.trim();
    return <>
        {mode === EditableDisplayMode.Display && <span onClick={() => !requireDoubleClick && startEditing()} onDoubleClick={() => requireDoubleClick && startEditing()} className={classNames(usePlaceholder && 'placeholder')}>{usePlaceholder ? placeholder : value}</span>}
        {mode === EditableDisplayMode.Edit && <input className="control gamma-control" type="text" onBlur={onBlur} placeholder={placeholder} ref={inputRef} defaultValue={value} onKeyDown={onKeyDown} />}
    </>;
};