/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider, useStore } from 'react-redux';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
import { RootState, store } from './components/store/store';
import { useHandleGestures } from './hooks/useHandleGestures';
import { setBubbleDisplay } from './components/store/features/screens/screens-slice';
import { Router } from './navigation/Router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdleTimerProvider } from './hooks/useIdleTimer';
import { setBrightness } from './api/api';
import { Scale } from './components/Scale/Scale';
import { VisibilityProvider } from './navigation/VisibilityContext';
import {
  useNotification,
  useNotificationHandler
} from './hooks/useNotification';
import { ProfileProvider } from './context/ProfileContext';
import { invoke } from '@tauri-apps/api/core';
import './globals.css';

import { warn, debug, trace, info, error } from '@tauri-apps/plugin-log';

import { PistonPosProvider } from './context/PistonPositionContext';

function jsonBytes(obj: unknown) {
  // Rough bytes of UTF-8 string
  const str = JSON.stringify(obj);
  return new TextEncoder().encode(str).length;
}

function formatBytes(n: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0,
    v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      enabled: true,
      networkMode: 'always'
    },
    mutations: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'always'
    }
  }
});

async function sendReady() {
  if (!('__TAURI_INTERNALS__' in window)) {
    return;
  }
  await invoke('ready');
}

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  const lastReduxSize = useRef<number>(0);
  const lastQueriesSize = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type !== 'updated') return;

      // after the cache update:
      // const latest = queryClient.getQueryData(event.query.queryKey);
      // const bytes = jsonBytes(latest);

      const queries = queryClient.getQueryCache().getAll();
      console.log(`updating query: ${event.query.queryKey}`);
      // let allQuerySize = 0;
      queries.forEach((query) => {
        const current_data = queryClient.getQueryData(query.queryKey);
        const bytes = jsonBytes(current_data);
        lastQueriesSize.current += bytes;
      });
      console.log(`redux state size: ${formatBytes(lastReduxSize.current)}`);
      console.log(
        `all queries size: ${formatBytes(lastQueriesSize.current)}\n`
      );

      lastQueriesSize.current = 0;
      // console.log(`${event.query.queryKey} query size: ${formatBytes(bytes)}`);
    });

    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    sendReady();
    setBrightness({ brightness: 1 });
    const unsibscribeToStore = store.subscribe(() => {
      const bytes = jsonBytes(store.getState());
      if (
        bytes > lastReduxSize.current * 1.05 ||
        bytes < lastReduxSize.current * 0.95
      ) {
        console.log(`-> redux state size: ${formatBytes(bytes)}`);
        lastReduxSize.current = bytes;
      }
    });
    return () => {
      unsibscribeToStore();
    };
  }, []);

  const isExtracting = useAppSelector((state) => state.stats?.extracting);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  useNotification();
  useNotificationHandler();

  useHandleGestures(
    {
      context() {
        dispatch(
          setBubbleDisplay({
            visible: !bubbleDisplay.visible,
            component: !bubbleDisplay.visible ? 'quick-settings' : undefined
          })
        );
      }
    },
    isExtracting || bubbleDisplay.interceptsGesture
  );

  const [isScaleVisible, setIsScaleVisible] = useState<
    'small' | 'full' | 'closed'
  >('closed');

  const updateScaleVisibility = (new_state: 'small' | 'full' | 'closed') => {
    setIsScaleVisible(new_state);
  };

  const dev = import.meta.env.VITE_SHOW_CIRCLE;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="meticulous-main-canvas">
        {dev && <div className="main-circle-overlay" />}
        <IdleTimerProvider>
          <ProfileProvider>
            <PistonPosProvider>
              <SocketManager>
                <VisibilityProvider value={isScaleVisible !== 'full'}>
                  <Router
                    currentScreen={screen.value}
                    previousScreen={screen.prev}
                  />
                </VisibilityProvider>
                {/* Mark router as not visible when scale is overlaid to avoid gesture handlers firing */}
                <Scale updateScaleVisibility={updateScaleVisibility} />
              </SocketManager>
            </PistonPosProvider>
          </ProfileProvider>
        </IdleTimerProvider>
      </div>
    </QueryClientProvider>
  );
};

// redirect console messages to the tauri log targets
function forwardConsole(
  fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
  logger: (message: string) => Promise<void>
) {
  const original = console[fnName];
  console[fnName] = (message) => {
    original(message);
    logger(message);
  };
}

forwardConsole('log', trace);
forwardConsole('debug', debug);
forwardConsole('info', info);
forwardConsole('warn', warn);
forwardConsole('error', error);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
