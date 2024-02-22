import { useRef, useEffect } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import 'swiper/swiper-bundle.min.css';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
import { store } from './components/store/store';
import { useFetchData } from './hooks/useFetchData';
import { useHandleGestures } from './hooks/useHandleGestures';
import { setScreen } from './components/store/features/screens/screens-slice';
import { Router } from './navigation/Router';
import { notificationSelector } from './components/store/features/notifications/notification-slice';
import { durationAnimation } from './navigation/Transitioner';
import { useSocketKeyboardListeners } from './components/store/SocketProviderValue';

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );
  const loadingPressets = useAppSelector((state) => state.presets.pending);
  const stats = useAppSelector((state) => state.stats);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const notifications = useSelector(notificationSelector.selectAll);

  useEffect(() => {
    if (notifications.length > 0 && screen.value !== 'notifications') {
      dispatch(setScreen('notifications'));
    }

    if (notifications.length === 0 && screen.value === 'notifications') {
      dispatch(setScreen(screen.prev));
    }
  }, [notifications]);

  const getureTimeAgo = useRef(new Date());

  // For development purpose
  useSocketKeyboardListeners();
  useFetchData();
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
      }
    },
    stats?.name !== 'idle' || bubbleDisplay.visible
  );

  if (loadingPressets) return <></>;

  return <Router currentScreen={screen.value} previousScreen={screen.prev} />;
  // return <Router currentScreen={'wifiSettings'} previousScreen={screen.prev} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <SocketManager>
      <App />
    </SocketManager>
  </Provider>
);
