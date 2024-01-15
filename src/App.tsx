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
import { useEffect } from 'react';
import { notificationSelector } from './components/store/features/notifications/notification-slice';

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );
  const stats = useAppSelector((state) => state.stats);
  const notifications = useSelector(notificationSelector.selectAll);

  useEffect(() => {
    if (notifications.length > 0 && screen.value !== 'notifications') {
      dispatch(setScreen('notifications'));
    }

    if (notifications.length === 0 && screen.value === 'notifications') {
      dispatch(setScreen(screen.prev));
    }
  }, [notifications]);

  // This can be used for development purpose
  // useSocketKeyboardListeners();
  useFetchData();
  useHandleGestures(
    {
      doubleTare() {
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
      longTare() {
        if (screen.value !== 'settings') {
          dispatch(setScreen('settings'));
        }
      }
    },
    stats?.name !== 'idle'
  );

  return <Router currentScreen={screen.value} previousScreen={screen.prev} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <SocketManager>
      <App />
    </SocketManager>
  </Provider>
);
