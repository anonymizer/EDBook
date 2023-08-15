import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive'
import remarkDirectiveRehype from 'remark-directive-rehype'
import directives from '../remark-directives/directives';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype/lib';
import rehypeStringify from 'rehype-stringify';
import {visit} from 'unist-util-visit';
import { base64ToUint8, objectMap } from '../utils/dpage-utils';
import { connect } from 'react-redux';
import { PageState } from '../store';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { MediaFile } from '../../dpage';
import { TypingEffect, TypingEffectOptions } from './TypingEffect';

interface MarkdownComponentProps {
    prefix: string,
    children: string,
    mediaFiles?: {[fname: string]: MediaFile},
    directiveStates?: any,
    useTypingEffect?: boolean | TypingEffectOptions
    // onDirectiveEvent?: directiveEventListener
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface MarkdownComponentState {
    source: string;
    doneAnimating: boolean;
}

class MarkdownComponent extends React.Component<MarkdownComponentProps, MarkdownComponentState> {
    private directiveIndices: {[key: string]: number} = {};
    private typingEffect: TypingEffect | undefined;
    private components: any;
    private estimatedHeight = -1;
    constructor(props: MarkdownComponentProps) {
        super(props);
        const { children, useTypingEffect } = props;
        const source:string = useTypingEffect ? '' : children;

        if(useTypingEffect) {
            const typingEffectOptions = typeof useTypingEffect === 'object' ? useTypingEffect : undefined;
            this.typingEffect = new TypingEffect(MarkdownComponent.filterTextForAnimation(children), typingEffectOptions);
            this.typingEffect.onChange((newText) => {
                this.setState({ source: newText });
            });
            this.typingEffect.onFinish(() => {
                this.setState({ source: this.props.children, doneAnimating: true });
            });
        }

        this.state = { source, doneAnimating: !useTypingEffect };

        this.components = {
                img: (({node, src, alt, title, ...otherProps}: any) => {
                    const { mediaFiles } = this.props;
                    if(mediaFiles && mediaFiles[src]) {
                        const { data } = mediaFiles[src];
                        const ui8data = base64ToUint8(data);
                        const blob = new Blob([ui8data]);
                        const url = URL.createObjectURL(blob);

                        return <img src={url} alt={alt} title={title} {...otherProps} />;
                    } else {
                        return <img src={src} alt={alt} title={title} {...otherProps} />;
                    }
                }).bind(this),
                ...objectMap(directives, (createDirective, directiveName) => {
                    const fn = (args: any) => {
                        if(!Object.prototype.hasOwnProperty.call(this.directiveIndices, directiveName)) {
                            this.directiveIndices[directiveName] = 1;
                        }
                        const directiveIndex = this.directiveIndices[directiveName]++;
                        const directiveId = getDirectiveId(this.props.prefix, directiveName, directiveIndex);
                        // console.log(directiveId);

                        const directiveState = this.props.directiveStates?.[directiveId];

                        // console.log(directiveName, args);

                        // console.log(createDirective);
                        const creator = createDirective({...args, id: directiveId, cellId: this.props.prefix, state: directiveState, directiveName, components: this.components});
                        // console.log(creator.type);
                        return creator;
                    };
                    fn.directiveName = directiveName;
                    return fn;
                }),
                code({ node, inline, className, children, ...otherProps}: any) {
                    // console.log(node, inline, className, children, props);
                    const value = String(children).replace(/\n$/, '');
                    const match = /language-(\w+)/.exec(className || '');
                    return <MonacoHighligtedCode language={match ? match[1] : null} inline={inline} props={otherProps} className={className}>{value}</MonacoHighligtedCode>
                },
            };
    }

    public componentDidMount(): void {
        if(this.typingEffect) {
            this.typingEffect.start();
        }
    }

    public componentWillUnmount(): void {
        if(this.typingEffect) {
            this.typingEffect.stop();
        }
    }

    public componentDidUpdate(prevProps: Readonly<MarkdownComponentProps>, prevState: Readonly<MarkdownComponentState>, snapshot?: any): void {
        if(this.props.children !== prevProps.children) {
            if(this.typingEffect) {
                this.typingEffect.setSource(MarkdownComponent.filterTextForAnimation(this.props.children));
                this.setState({ source: '', doneAnimating: false });
            } else {
                this.setState({ source: this.props.children });
            }
        }
    }

    public static filterTextForAnimation(inp: string): string {
        const funcs = [removeEditCodeDirective, removeContentBetweenBracesForOption];
        for(const func of funcs) {
            inp = func(inp);
        }
        return inp;
    }

    public UNSAFE_componentWillUpdate(): void {
        this.resetDirectiveIndices();
    }

    private resetDirectiveIndices(): void {
        this.directiveIndices = {};
    }

    public render(): React.JSX.Element {
        if(this.state.doneAnimating === false && this.state.source.length < 1) { // start animating
            this.resetDirectiveIndices();
            return <div ref={(elem) => { if(elem) { this.estimatedHeight = elem.getBoundingClientRect().height; } }} style={{visibility: 'hidden'}}>
                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm, remarkDirective, remarkDirectiveRehype]}
                    rehypePlugins={[rehypeKatex]}
                    components={this.components}>{this.props.children}</ReactMarkdown>
            </div>;
        } else if(this.state.doneAnimating === false) { // animating
            return <div style={{height: this.estimatedHeight+'px'}}>
                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm, remarkDirective, remarkDirectiveRehype]}
                        rehypePlugins={[rehypeKatex]}
                        components={this.components}>{this.state.source}</ReactMarkdown>
            </div>;
        } else {
            this.resetDirectiveIndices();
            return <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm, remarkDirective, remarkDirectiveRehype]}
                        rehypePlugins={[rehypeKatex]}
                        components={this.components}>{this.state.source}</ReactMarkdown>;
        }
    }
}
export default connect((state: PageState, props: MarkdownComponentProps) => {
    const { prefix, children } = props;
    const directives = getDirectives(children, prefix);
    const mediaFiles = state.page.media || {};

    const directiveStates = directives.reduce((acc, directive) => {
        const directiveId = directive.id;
        if(state.page.userState.cellStates[prefix]?.directiveStates[directiveId]) {
            acc[directiveId] = state.page.userState.cellStates[prefix].directiveStates[directiveId];
        }
        return acc;
    }, {} as {[key: string]: any});

    return { ...props, directiveStates, mediaFiles };
})(MarkdownComponent);

function getDirectiveList(md: string): string[] {
    const interestedDirectives = directives;
    const directiveList: string[] = [];
    unified().use(remarkParse).use(remarkDirective).use(myRemarkPlugin as any).use(remarkRehype).use(rehypeStringify).processSync(md);
    function myRemarkPlugin() {
        return (tree: any) => {
            visit(tree, (node) => {
                if (
                    node.type === 'textDirective' ||
                    node.type === 'leafDirective' ||
                    node.type === 'containerDirective'
                ) {
                    const { name } = node;
                    if(Object.prototype.hasOwnProperty.call(interestedDirectives, name)) {
                        directiveList.push(node.name);
                    }
                }
            });
        }
    }
    return directiveList;
}

function getDirectiveId(prefix: string, directive: string, directiveIndex: number) {
    return `${prefix}-${directive}-${directiveIndex++}`;
}

export function getDirectives(md: string, prefix: string): {id: string, type: string}[] {
    const directivesList = getDirectiveList(md);
    const groupedDirectives = directivesList.reduce((acc, directive) => {
        if(!acc[directive]) {
            acc[directive] = [];
        }
        acc[directive].push(directive);
        return acc;
    }, {} as {[key: string]: string[]});

    const directives = [];
    for(const directiveType in groupedDirectives) {
        let directiveIndex = 1;
        for(const directive of groupedDirectives[directiveType]) {
            directives.push({id: getDirectiveId(prefix, directive, directiveIndex++), type: directive});
        }
    }
    return directives;
}


type MonacoHighlightedCodeProps = {
    inline: boolean,
    className: string,
    children: string,
    props: any,
    language: string|null
};
// const MonacoHighligtedCode: React.FC<MonacoHighlightedCodeProps> = ({ children, inline, className, props, language }) => {
//     const [highlightedCodeContent, setHighlightedCodeContent] = React.useState<string|null>(null);
//     React.useEffect(() => {
//         async function doColorize() {
//             if(!inline && language) {
//                 const monaco = await loader.init();
//                 const colorizedHTML = await monaco.editor.colorize(children, language, {});
//                 setHighlightedCodeContent(colorizedHTML);
//             }
//         }
//         doColorize();
//     }, [children, inline, language]);

//     if(highlightedCodeContent) {
//         return <div {...props} dangerouslySetInnerHTML={{__html: highlightedCodeContent}}></div>;
//     } else if(inline) {
//         return <code className={className} {...props}>{children}</code>;
//     } else {
//         return <code className={className} {...props}>{children}</code>;
//     }
// };
const MonacoHighligtedCode: React.FC<MonacoHighlightedCodeProps> = ({ children, inline, className, props, language }) => {
    const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor|null>(null);
    const containerRef = React.useRef<HTMLDivElement|null>(null);
    const parentRef = React.useRef<HTMLDivElement|null>(null);
    const resizeObserverRef = React.useRef<ResizeObserver|null>(null);

    const updateEditorHeight = React.useCallback(() => {
        const parent = parentRef.current;
        const container = containerRef.current;
        const editor = editorRef.current;

        if(!parent || !container || !editor) { return; }

        const contentHeight = Math.min(1000, editor.getContentHeight());
        const width = parent.getBoundingClientRect().width;
        container.style.width = `${width}px`;
        container.style.height = `${contentHeight}px`;
        editor.layout({ width, height: contentHeight });
    }, []);

    React.useEffect(() => {
        return () => {
            if(resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }
        }
    }, []);
    // const [highlightedCodeContent, setHighlightedCodeContent] = React.useState<string|null>(null);

    // React.useEffect(() => {
    //     async function doColorize() {
    //         if(!inline && language) {
    //             const monaco = await loader.init();
    //             const colorizedHTML = await monaco.editor.colorize(children, language, {});
    //             setHighlightedCodeContent(colorizedHTML);
    //         }
    //     }
    //     doColorize();
    // }, [children, inline, language]);

    if(inline) {
        return <code className={className} {...props}>{children}</code>;
    } else {
        const theme_kind = document.body.getAttribute('data-vscode-theme-kind') === 'vscode-dark' ? 'vs-dark' : 'vs-light';

        return <div ref={(el) => {
                            parentRef.current = el;
                            if(el) {
                                const resizeObserver = new ResizeObserver(updateEditorHeight);
                                resizeObserver.observe(el);
                                resizeObserverRef.current = resizeObserver;
                            }

                        }}><div ref={containerRef}><Editor
                        language={language || 'plaintext'}
                        theme={theme_kind}
                        value={children}
                        options={{lineDecorationsWidth: 0, colorDecorators: false,
                                    overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
                                    scrollbar: {horizontal: 'hidden', vertical: 'hidden', handleMouseWheel:false},
                                    lineNumbers: 'off', renderLineHighlight: 'none',
                                    readOnly: true, minimap: {enabled: false}, wordWrap: 'on',
                                    scrollBeyondLastLine: false, wrappingStrategy: 'advanced'}}
                        onMount={(editor, monaco) => {
                            editorRef.current = editor;
                            updateEditorHeight();
                            editor.onDidContentSizeChange(updateEditorHeight);
                        }}
                    /></div></div>;
    }
};

function removeEditCodeDirective(input: string): string {
    // This regex captures the :::edit-code ... ::: pattern across multiple lines
    const regex = /:::edit-code[\s\S]*?:::/g;
    return input.replace(regex, '');
}

function removeContentBetweenBracesForOption(input: string): string {
    return input.replace(/(::option\[[^\]]*\])\{[^}]*\}/g, '$1');
}