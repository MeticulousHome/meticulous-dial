import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import 'swiper/swiper-bundle.min.css';

import { useAppDispatch, useAppSelector } from './components/store/hooks';
import { SocketManager } from './components/store/SocketManager';
import { store } from './components/store/store';
import { useFetchData } from './hooks/useFetchData';
import { useSocketKeyboardListeners } from './components/store/SocketProviderValue';
import { useHandleGestures } from './hooks/useHandleGestures';
import { setScreen } from './components/store/features/screens/screens-slice';
import { Router } from './navigation/Router';

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector(
    (state) => state.screen,
    (prev, next) => prev === next
  );
  useSocketKeyboardListeners();
  useFetchData();
  useHandleGestures({
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
  });

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
