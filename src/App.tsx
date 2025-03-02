import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider, useSelector, useStore } from 'react-redux';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
import { RootState, store } from './components/store/store';
import { useHandleGestures } from './hooks/useHandleGestures';
import {
  setBubbleDisplay,
  setScreen
} from './components/store/features/screens/screens-slice';
import { Router } from './navigation/Router';
import { notificationSelector } from './components/store/features/notifications/notification-slice';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdleTimerProvider } from './hooks/useIdleTimer';
import { setBrightness } from './api/api';
import { Scale } from './components/Scale/Scale';
import { VisibilityProvider } from './navigation/VisibilityContext';
import { routes } from './navigation/routes';

export const itsAprilYet = () => {
  const today = new Date();
  return today.getDate() === 1 && today.getMonth() === 3;
};

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
  const store = useStore<RootState>();
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

  const isIdle = useAppSelector((state) => state.stats?.name === 'idle');
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const notifications = useSelector(notificationSelector.selectAll);

  useEffect(() => {
    if (notifications.length > 0 && screen.value !== 'notifications') {
      dispatch(setScreen('notifications'));
      dispatch(setBubbleDisplay({ visible: false, component: null }));
    }

    if (notifications.length === 0 && screen.value === 'notifications') {
      // Dont return to the idle screen
      if (!screen.prev || routes[screen.prev].ignoreAsPrevious) {
        dispatch(setScreen('pressets'));
      } else {
        dispatch(setScreen(screen.prev));
      }
    }
  }, [notifications]);

  const [scaleState, setScaleState] = useState<{
    visible: boolean;
    size: 'small' | 'full';
  }>({ visible: false, size: 'small' });

  const isQuickScaleVisible = scaleState.visible && scaleState.size === 'small';
  useEffect(() => {
    if (!isQuickScaleVisible) return;

    const scheduleHide = () =>
      setTimeout(() => {
        setScaleState((state) => ({ ...state, visible: false }));
      }, 10000);
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
  }, [isQuickScaleVisible]);

  useHandleGestures(
    {
      // TODO: Ideally we'd get tare up/down events so we can zoom in full the scale gradually
      singleTare() {
        setScaleState(({ visible }) => ({
          visible: true,
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
            component: !bubbleDisplay.visible ? 'quick-settings' : null
          })
        );
      }
    },
    !isIdle || bubbleDisplay.visible
  );

  const dev = !!window.env?.SHOW_CIRCLE_OVERLAY;

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <div className="meticulous-main-canvas">
          {dev && <div className="main-circle-overlay" />}
          <IdleTimerProvider>
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
          </IdleTimerProvider>
          {itsAprilYet() && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#FF00FF',
                pointerEvents: 'none',
                mixBlendMode: 'color',
                filter: 'hue-rotate(180deg) saturate(200%)',
                zIndex: 9999
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
  <Provider store={store}>
    <App />
  </Provider>
);
