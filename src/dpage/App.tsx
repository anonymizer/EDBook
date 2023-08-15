import { JSX, useEffect } from "react";
import * as React from "react";
import { InitialDataMessage, Message, PageDataMessage, ReadyMessage } from "../messages";
import { GammaPage } from "../dpage";
import Page from "./Page";
import { listenForRespondableMessages, postAndAwaitResponse } from "./utils/webview-message-utils";
import { useDispatch, useStore } from "react-redux";
import { PageState, setPage } from "./store";
import './widgets/i18nConfig';

export function App(): JSX.Element {
    const [ pageData, setPageData ] = React.useState<GammaPage|null>(null);
    const store = useStore<PageState>();
    const dispatch = useDispatch();
    useEffect(() => {
        async function getInitialData() {
            const response = await postAndAwaitResponse({ message: "ready" } as ReadyMessage) as InitialDataMessage;
            const { data } = response;
            dispatch(setPage(data));
            setPageData(data);
        }
        const cleanup = listenForRespondableMessages((data: Message, respond: (response: any) => void) => {
            const { message } = data;
            if(message === 'get_page') {
                const data = store.getState().page;
                respond({ message: 'page_data', data } as PageDataMessage);
            }
        });
        getInitialData();

        return cleanup;
    }, [dispatch, store]);

    return pageData ? <Page filename="" initialContent={pageData} /> : <div>Loading...</div>;
}