import { useRef, useEffect } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
import { store } from './components/store/store';
import { useHandleGestures } from './hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from './components/store/features/screens/screens-slice';
import { Router } from './navigation/Router';
import { notificationSelector } from './components/store/features/notifications/notification-slice';
import { durationAnimation } from './navigation/Transitioner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdleTimerProvider } from './hooks/useIdleTimer';
import { setBrightness } from './api/api';

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

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  useEffect(() => {
    if (window.electron) {
      window.electron.ipcRenderer.sendMessage('ready');
    }
    setBrightness({ brightness: 1 });
  }, []);

  const stats = useAppSelector((state) => state.stats);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const notifications = useSelector(notificationSelector.selectAll);

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
                : screen.prev !== 'idle'
                  ? screen.prev
                  : 'pressets'
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

  const dev = !!window.env?.SHOW_CIRCLE_OVERLAY || true;

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <div className="meticulous-main-canvas">
          {dev && <div className="main-circle-overlay" />}
          <IdleTimerProvider>
            <SocketManager>
              <Router
                currentScreen={screen.value}
                previousScreen={screen.prev}
              />
            </SocketManager>
          </IdleTimerProvider>
        </div>
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
