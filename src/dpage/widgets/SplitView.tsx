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
import * as classNames from "classnames";

interface SplitViewProps {
    initialSliderPosition?: number,
    leftPanel: JSX.Element,
    rightPanel: JSX.Element | false,
    leftClasses?: string,
    rightClasses?: string,
    leftRef?: React.RefObject<HTMLDivElement>,
    rightRef?: React.RefObject<HTMLDivElement>
}

const SplitView: React.FC<SplitViewProps> = ({initialSliderPosition, leftPanel, rightPanel, rightClasses, leftClasses, leftRef, rightRef}) => {
    const [sliderPosition, setSliderPosition] = React.useState(initialSliderPosition || 50);
    const [hover, setHover] = React.useState(false);
    const [dragging, setDragging] = React.useState(false);

    const handleMouseDown = React.useCallback((downEvent: React.MouseEvent<HTMLDivElement>) => {
        setDragging(true);
        const handleMouseMove = (e: MouseEvent) => {
            // Prevent selection while dragging
            e.preventDefault();

            // Calculate the new position of the divider
            const newPosition = (e.clientX / window.innerWidth) * 100;
            const adjustedPosition = Math.max(25, Math.min(75, newPosition));

            setSliderPosition(adjustedPosition);
        };

        const handleMouseUp = () => {
            setDragging(false);
            setHover(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        downEvent.preventDefault();
        downEvent.stopPropagation();
    }, []);

    const handleMouseEnter = React.useCallback((enterEvent: React.MouseEvent<HTMLDivElement>) => {
        setHover(true);
    }, []);
    const handleMoueLeave = React.useCallback((enterEvent: React.MouseEvent<HTMLDivElement>) => {
        if(!dragging) {
            setHover(false);
        }
    }, [dragging]);

    const draggableWidth = 5;
    const apparentWidth = 1;
    const horizontalPadding = `${apparentWidth/2}px`

    return <div className="split-view" style={{display: 'flex', flexDirection: 'row', overflow: 'hidden'}}>
        <div ref={leftRef} className={classNames("left-panel", leftClasses)} style={Object.assign({height: '100vh', overflowY: 'auto', width: '100%'}, rightPanel ? { flexBasis: `${sliderPosition}%`, height: '100vh', overflowX: 'visible', overflowY: 'auto', width: '100%'} : {}) as React.CSSProperties }>
            {leftPanel}
        </div>
        {rightPanel && 
            <>
                <div style={{ paddingLeft: horizontalPadding, paddingRight: horizontalPadding, cursor: 'col-resize', position: 'relative', background: 'var(--divider-background)' }} onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter} onMouseLeave={handleMoueLeave}>
                    <div style={{left: `${(apparentWidth-draggableWidth)/2}px`, transition: 'background 500ms ease-in', position: 'absolute', background: (hover||dragging) ? 'var(--focus-border)' : 'none', height: '100vh', width: `${draggableWidth}px`, zIndex: 9999}}></div>
                    {/* <div style={{width: `${dividerWidth}px`, height: '100vh', background: 'var(--divider-background)'}} /> */}
                </div>
                <div ref={rightRef} className={classNames("right-panel", rightClasses)} style={{ flexBasis: `${100 - sliderPosition}%`, height: '100vh', overflowY: 'auto', width: '100%' }}>{rightPanel}</div>
            </>
        }
    </div>;
}
export default SplitView;