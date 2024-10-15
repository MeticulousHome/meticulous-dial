import { useRef, useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
import { store } from './components/store/store';
import { useFetchData } from './hooks/useFetchData';
import { useHandleGestures } from './hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from './components/store/features/screens/screens-slice';
import { Router } from './navigation/Router';
import { notificationSelector } from './components/store/features/notifications/notification-slice';
import { durationAnimation } from './navigation/Transitioner';
import { Splash } from './components/Splash/Splash';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfileManagement } from './hooks/usePressets';
import { IdleTimerProvider } from './hooks/useIdleTimer';
import { setBrightness } from './api/api';
import { useProfileManagement } from './hooks/usePressets';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false // default: true
    }
  }
});

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('ready');
    setBrightness({ brightness: 1 });
  }, []);

  const presetsStatus = useAppSelector((state) => state.presets.status);

  const stats = useAppSelector((state) => state.stats);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const notifications = useSelector(notificationSelector.selectAll);
  const [splashAnimationLooping, setSplashAnimationLooping] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    if (notifications.length > 0 && screen.value !== 'notifications') {
      dispatch(setScreen('notifications'));
      dispatch(setBubbleDisplay({ visible: false, component: null }));
    }

    if (notifications.length === 0 && screen.value === 'notifications') {
      dispatch(setScreen(screen.prev));
    }
  }, [notifications]);

  const getureTimeAgo = useRef(new Date());

  useFetchData(() => setBackendReady(true));
  useProfileManagement();
  useHandleGestures(
    {
      doubleTare() {
        const gestureTime = new Date();

        const timeDiff = +gestureTime - +getureTimeAgo.current;

        if (timeDiff < durationAnimation + 50) return;

        getureTimeAgo.current = gestureTime;

        dispatch(
          setScreen(
            screen.value === 'scale'
              ? screen.prev === 'settings'
                ? 'barometer'
                : screen.prev
              : 'scale'
          )
        );
      },
      context() {
        dispatch(
          setBubbleDisplay({
            visible: !bubbleDisplay.visible,
            component: !bubbleDisplay.visible ? 'quick-settings' : null
          })
        );
      }
    },
    stats?.name !== 'idle' || bubbleDisplay.visible
  );

  const dev = !!window.env.npm_lifecycle_event;

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <div className="meticulous-main-canvas">
          {dev && <div className="main-circle-overlay" />}
          {backendReady && splashAnimationLooping ? (
            <IdleTimerProvider>
              <SocketManager>
                <Router
                  currentScreen={screen.value}
                  previousScreen={screen.prev}
                />
              </SocketManager>
            </IdleTimerProvider>
          ) : (
            <Splash
              onAnimationFinished={() => {
                setSplashAnimationLooping(true);
                return presetsStatus !== 'ready';
              }}
            />
          )}
        </div>
      </div>
    </QueryClientProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <QueryClientProvider client={queryClient}>
    <Provider store={store}>
      <App />
    </Provider>
  </QueryClientProvider>
);
