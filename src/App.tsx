/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
import { store } from './components/store/store';
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
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  useEffect(() => {
    sendReady();
    setBrightness({ brightness: 1 });
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
    isExtracting || bubbleDisplay.visible
  );

  const [isScaleVisible, setIsScaleVisible] = useState<boolean>(false);

  const updateScaleVisibility = (new_state: boolean) => {
    setIsScaleVisible(new_state);
  };

  const dev = import.meta.env.VITE_SHOW_CIRCLE;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="meticulous-main-canvas">
        {dev && <div className="main-circle-overlay" />}
        <IdleTimerProvider>
          <ProfileProvider>
            <SocketManager>
              {/* Mark router as not visible when scale is overlaid to avoid gesture handlers firing */}
              <VisibilityProvider value={!isScaleVisible}>
                <Router
                  currentScreen={screen.value}
                  previousScreen={screen.prev}
                />
              </VisibilityProvider>
              <Scale updateScaleVisibility={updateScaleVisibility} />
            </SocketManager>
          </ProfileProvider>
        </IdleTimerProvider>
      </div>
    </QueryClientProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
