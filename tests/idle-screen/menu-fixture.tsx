import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '../../src/components/store/store';
import { useAppSelector } from '../../src/components/store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../src/components/store/features/screens/screens-slice';
import { SocketManager } from '../../src/components/store/SocketManager';
import { QuickSettings } from '../../src/components/QuickSettings/QuickSettings';
import { IdleScreen } from '../../src/components/IdleScreen/IdleScreen';
import { IdleTimerProvider, useIdleTimer } from '../../src/hooks/useIdleTimer';
import { brightnessRequests } from './mocks';
import { receiveButton, buttonListenerReady } from './socket';
import '../../src/globals.css';

const probe = { brightnessRequests, receiveButton, buttonListenerReady };
declare global {
  interface Window {
    menuProbe: typeof probe;
  }
}
window.menuProbe = probe;
store.dispatch(setScreen('profileHome'));
// Begin with the quick menu open, as Bubble mounts it. Only outer routing is
// reduced; entry/wake requests must come through the real socket listener.
store.dispatch(
  setBubbleDisplay({ visible: true, component: 'quick-settings' })
);

function Fixture() {
  const { isIdle } = useIdleTimer();
  const bubble = useAppSelector((state) => state.screen.bubbleDisplay);
  return (
    <div className="meticulous-main-canvas">
      <div className="main-layout route">
        {bubble.visible && <QuickSettings />}
        {isIdle ? <IdleScreen /> : !bubble.visible && <div>Machine awake</div>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <QueryClientProvider client={new QueryClient()}>
      <IdleTimerProvider>
        <SocketManager>
          <Fixture />
        </SocketManager>
      </IdleTimerProvider>
    </QueryClientProvider>
  </Provider>
);
