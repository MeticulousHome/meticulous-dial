/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    sendReady();
    setBrightness({ brightness: 1 });
  }, []);

  const isExtracting = useAppSelector((state) => state.stats?.extracting);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  useNotification();
  useNotificationHandler();

  const [scaleState, setScaleState] = useState<{
    visible: boolean;
    size: 'small' | 'full';
  }>({ visible: false, size: 'small' });

  useEffect(() => {
    const hide_timer = scaleState.size === 'small' ? 10000 : 2 * 60 * 10000;
    const scheduleHide = () =>
      setTimeout(() => {
        setScaleState((state) => ({ ...state, visible: false }));
      }, hide_timer);
    let timer = scheduleHide();

    let lastSignificantWeight = store.getState().stats.sensors.w;
    const subscription = store.subscribe(() => {
      const weight = store.getState().stats.sensors.w;
      if (Math.abs(weight - lastSignificantWeight) > 2) {
        lastSignificantWeight = weight;
        clearTimeout(timer);
        timer = scheduleHide();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription();
    };
  }, [scaleState]);

  useHandleGestures(
    {
      // TODO: Ideally we'd get tare up/down events so we can zoom in full the scale gradually
      singleTare() {
        setScaleState(({ visible }) => ({
          visible: screen.value !== 'calibrateScale',
          size: visible ? 'full' : 'small'
        }));
      },
      longTare() {
        setScaleState(({ visible, size }) => ({
          visible: !visible || size === 'small',
          size: 'full'
        }));
      },
      doubleTare() {
        setScaleState(({ size }) => ({
          visible: false,
          size
        }));
      },
      context() {
        setScaleState(({ size }) => ({
          visible: false,
          size
        }));
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

  useEffect(() => {
    if (isExtracting) {
      setScaleState({ visible: false, size: 'small' });
    }
  }, [isExtracting]);

  const dev = !!window.env?.SHOW_CIRCLE_OVERLAY;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="meticulous-main-canvas">
        {dev && <div className="main-circle-overlay" />}
        <IdleTimerProvider>
          <ProfileProvider>
            <SocketManager>
              {/* Mark router as not visible when scale is overlaid to avoid gesture handlers firing */}
              <VisibilityProvider value={!scaleState.visible}>
                <Router
                  currentScreen={screen.value}
                  previousScreen={screen.prev}
                />
              </VisibilityProvider>
              <Scale {...scaleState} />
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
