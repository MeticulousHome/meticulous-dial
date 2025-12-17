/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
// import { Provider, useStore } from 'react-redux';
import { Provider } from 'react-redux';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
// import { RootState, store } from './components/store/store';
import { store } from './components/store/store';
import { useHandleGestures } from './hooks/useHandleGestures';
import {
  ScreenType,
  setBubbleDisplay,
  setScreen
} from './components/store/features/screens/screens-slice';
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
import {
  NotificationItem,
  processNotification,
  addOneNotification,
  removeAllNotications
} from './components/store/features/notifications/notification-slice';

import { v4 as uuidv4 } from 'uuid';

function jsonBytes(obj: unknown) {
  // Rough bytes of UTF-8 string
  const str = JSON.stringify(obj);
  return new TextEncoder().encode(str).length;
}

// function formatBytes(n: number) {
//   const units = ['B', 'KB', 'MB', 'GB'];
//   let i = 0,
//     v = n;
//   while (v >= 1024 && i < units.length - 1) {
//     v /= 1024;
//     i++;
//   }
//   return `${v.toFixed(2)} ${units[i]}`;
// }

const screens = [
  'barometer',
  'profileHome',
  //  'pressetSettings',
  'notifications',
  'enterWifiPassword',
  'quick-settings',
  'snake',
  //  'pressetProfileImage',
  'defaultProfiles',
  'defaultProfileDetails',
  'manual-purge',
  'heating',
  'heat_timeout_after_shot',
  'idle',
  'selectLetterCountry',
  'countrySettings',
  'timeZoneSettings',
  'calibrateScale',
  'shot_history',
  'preheatScreen',
  'brewComplete',
  'retraction_volume',
  'displayAlignment',
  'masterCalibrationLock',
  'unlock',
  'ready'
] as ScreenType[];

const context_screns = [
  'settings',
  'timeDate',
  'timeZoneConfig',
  'wifiSettings',
  'wifiQrMenu',
  'wifiDetails',
  'connectWifiMenu',
  'selectWifi',
  'connectWifiViaApp',
  'brewSettings',
  'KnownWifi',
  'deleteKnowWifiMenu',
  'advancedSettings',
  'deviceInfo',
  'updateChannel',
  'idleScreenSettings',
  'timeConfig',
  'dateConfig',
  'usbSettings',
  'scrollDirections',
  'factoryReset',
  'manufacturingSettings'
] as ScreenType[];

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
  // const store = useStore<RootState>();
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );

  const [screenTypeIter, setScreenTypeIter] = useState<
    'screen' | 'setting' | undefined
  >('screen');

  // const lastReduxSize = useRef<number>(0);
  const lastQueriesSize = useRef<number>(0);

  useEffect(() => {
    let currentIndex = 0;

    const memoryLogTimer = setInterval(async () => {
      const memory = await invoke('meticulous_dial_memory');
      console.warn(`memory used by meticulous-dial.service: ${memory}`);
    }, 10 * 1000);

    const rollingTimer = setInterval(
      async () => {
        // const memory = await invoke('meticulous_dial_memory');
        // console.warn(`memory used by meticulous-dial.service: ${memory}`);
        if (screenTypeIter === 'screen') {
          console.log(`setting screen to ${screens[currentIndex]}`);
          if (screens[currentIndex] === 'notifications') {
            // set a notification
            const _date = new Date();
            const MasterCalibrationAlert: NotificationItem =
              processNotification({
                id: uuidv4(),
                message: 'Notification screen test, DO NOT CLICK THE DIAL.',
                responses: ['OK'],
                timestamp: _date
              }).updatedNotification;
            dispatch(addOneNotification(MasterCalibrationAlert));
            currentIndex++;
          } else {
            if (screens[currentIndex - 1] === 'notifications') {
              dispatch(removeAllNotications());
              //remove notification
            }
            dispatch(setScreen(screens[currentIndex]));
            if (currentIndex === screens.length - 1) {
              currentIndex = 0;
              setScreenTypeIter('setting');
            } else {
              currentIndex++;
            }
          }
        } else {
          if (screen.value !== 'profileHome')
            dispatch(setScreen('profileHome'));
          console.log(
            `setting context screen to ${context_screns[currentIndex]}`
          );
          dispatch(
            setBubbleDisplay({
              visible: true,
              component: context_screns[currentIndex]
            })
          );
          if (currentIndex === context_screns.length - 1) {
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            currentIndex = 0;
            setScreenTypeIter('screen');
          } else {
            currentIndex++;
          }
        }
      },
      2 * 60 * 1000
    );

    return () => {
      clearInterval(rollingTimer);
      clearInterval(memoryLogTimer);
    };
  }, [dispatch, screenTypeIter]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type !== 'updated') return;

      // after the cache update:
      // const latest = queryClient.getQueryData(event.query.queryKey);
      // const bytes = jsonBytes(latest);

      const queries = queryClient.getQueryCache().getAll();
      // console.log(`updating query: ${event.query.queryKey}`);
      // let allQuerySize = 0;
      queries.forEach((query) => {
        const current_data = queryClient.getQueryData(query.queryKey);
        const bytes = jsonBytes(current_data);
        lastQueriesSize.current += bytes;
      });
      // console.log(`redux state size: ${formatBytes(lastReduxSize.current)}`);
      // console.log(
      //   `all queries size: ${formatBytes(lastQueriesSize.current)}\n`
      // );

      lastQueriesSize.current = 0;
      // console.log(`${event.query.queryKey} query size: ${formatBytes(bytes)}`);
    });

    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    sendReady();
    setBrightness({ brightness: 1 });
    // const unsibscribeToStore = store.subscribe(() => {
    //   const bytes = jsonBytes(store.getState());
    //   if (
    //     bytes > lastReduxSize.current * 1.05 ||
    //     bytes < lastReduxSize.current * 0.95
    //   ) {
    //     console.log(`-> redux state size: ${formatBytes(bytes)}`);
    //     lastReduxSize.current = bytes;
    //   }
    // });
    // return () => {
    //   unsibscribeToStore();
    // };
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
