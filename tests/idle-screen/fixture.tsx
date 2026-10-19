import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '../../src/components/store/store';
import { setScreen } from '../../src/components/store/features/screens/screens-slice';
import { IdleScreen } from '../../src/components/IdleScreen/IdleScreen';
import { IdleTimerProvider, useIdleTimer } from '../../src/hooks/useIdleTimer';
import { brightnessRequests } from './mocks';
import '../../src/globals.css';

const probe = {
  ready: false,
  brightnessRequests,
  sleep: () => {},
  screenOff: () => {},
  wake: () => {},
  // Inert fixture only: emulate another screen replacing idle (e.g. a shot).
  leave: () => {}
};
declare global {
  interface Window {
    idleProbe: typeof probe;
  }
}
window.idleProbe = probe;
store.dispatch(setScreen('profileHome'));

function Fixture() {
  const { isIdle, forceIdle, forceScreenOff, resetTimer } = useIdleTimer();
  useEffect(() => {
    probe.sleep = forceIdle;
    probe.screenOff = forceScreenOff;
    probe.wake = resetTimer;
    probe.leave = resetTimer;
    probe.ready = true;
  }, [forceIdle, forceScreenOff, resetTimer]);
  return (
    <div className="meticulous-main-canvas">
      <div className="main-layout route route-idle">
        {isIdle ? <IdleScreen /> : <div>Machine awake</div>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <IdleTimerProvider>
      <Fixture />
    </IdleTimerProvider>
  </Provider>
);
