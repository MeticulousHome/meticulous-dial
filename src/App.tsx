/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
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

import { warn, debug, trace, info, error } from '@tauri-apps/plugin-log';
import { sanitizeAutomaticSentryEvent } from './sentryPrivacy';
import { useDeviceInfo } from './hooks/useDeviceOSStatus';
import { version as dialVersion } from '../package.json';
import { useDialSlowdownMonitor } from './hooks/useDialSlowdownMonitor';

const SENTRY_DSN =
  'https://d958eb514629903cf133ad2b19e80ead@sentry.meticulousespresso.com/8';
const DIAL_RELEASE = `meticulous-dial@${dialVersion}`;
const isTauriRuntime = () => '__TAURI_INTERNALS__' in window;

if (SENTRY_DSN && import.meta.env.PROD && isTauriRuntime()) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: DIAL_RELEASE,
    initialScope: {
      tags: {
        'dial-version': dialVersion
      }
    },
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeAutomaticSentryEvent,
    integrations: (defaultIntegrations) =>
      defaultIntegrations.filter(
        (integration) =>
          ![
            'Breadcrumbs',
            'HttpContext',
            'BrowserSession',
            'CultureContext'
          ].includes(integration.name)
      )
  });
}

const SentryRuntimeMetadata = () => {
  const { data: deviceInfo } = useDeviceInfo();

  useEffect(() => {
    if (!deviceInfo) {
      return;
    }

    Sentry.setTag('serial', deviceInfo.serial);

    if (deviceInfo.image_version) {
      Sentry.setTag('build-version', deviceInfo.image_version);
    }
    if (deviceInfo.image_build_channel) {
      Sentry.setTag('build-channel', deviceInfo.image_build_channel);
    }
  }, [deviceInfo]);

  return null;
};

const DialSlowdownMonitor = () => {
  const screen = useAppSelector((state) => state.screen.value);
  const isExtracting = useAppSelector((state) => state.stats?.extracting);
  const { data: deviceInfo } = useDeviceInfo();

  useDialSlowdownMonitor({
    screen,
    serial: deviceInfo?.serial ? String(deviceInfo.serial).trim() : undefined,
    isExtracting: Boolean(isExtracting)
  });

  return null;
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
      <SentryRuntimeMetadata />
      <DialSlowdownMonitor />
      <div className="meticulous-main-canvas">
        {dev && <div className="main-circle-overlay" />}
        <IdleTimerProvider>
          <ProfileProvider>
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
    if ('__TAURI_INTERNALS__' in window) {
      logger(message);
    }
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
