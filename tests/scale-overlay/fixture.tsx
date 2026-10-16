import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '../../src/components/store/store';
import {
  setScreen,
  type ScreenType
} from '../../src/components/store/features/screens/screens-slice';
import { setStats } from '../../src/components/store/features/stats/stats-slice';
import { SocketContext } from '../../src/components/store/SocketManager';
import { VisibilityProvider } from '../../src/navigation/VisibilityContext';
import { Scale } from '../../src/components/Scale/Scale';
import { HeatingScreen } from '../../src/components/Heating/HeatingScreen';
import { handleEvents } from '../../src/HandleEvents';
import { useHandleGestures } from '../../src/hooks/useHandleGestures';
import type { GestureType } from '../../src/types';
import '../../src/globals.css';

type Entry = { time: number; kind: string; data: unknown };
const events: Entry[] = [];
const record = (kind: string, data: unknown) =>
  events.push({ time: Math.round(performance.now()), kind, data });
const socket = {
  emit: (...args: unknown[]) => record('socket.emit', args)
};
store.dispatch(setScreen('heating'));
store.dispatch(
  setStats({
    ...store.getState().stats,
    name: 'click to start',
    state: 'brewing',
    extracting: false,
    sensors: { p: 0, f: 0, g: 0, w: 18.5, t: 93 },
    setpoints: { temperature: 93 }
  })
);

const probe = {
  events,
  ready: false,
  visibility: 'closed',
  emit(...gestures: GestureType[]) {
    for (const gesture of gestures) {
      record('gesture', gesture);
      handleEvents.emit('gesture', gesture, 1000);
    }
  },
  clear() {
    events.length = 0;
  },
  setStatus(name: string, extracting = false) {
    store.dispatch(setStats({ ...store.getState().stats, name, extracting }));
  },
  setScreen(screen: ScreenType) {
    store.dispatch(setScreen(screen));
  }
};

declare global {
  interface Window {
    scaleProbe: typeof probe;
  }
}
window.scaleProbe = probe;

// Observe the real gesture hook under the same boundary as the screen. This
// catches leaked releases/long/double presses even if HeatingScreen ignores them.
function UnderlyingGestureObserver() {
  useHandleGestures({
    pressDown: () => record('underlying', 'pressDown'),
    pressUp: () => record('underlying', 'pressUp'),
    click: () => record('underlying', 'click'),
    doubleClick: () => record('underlying', 'doubleClick'),
    longEncoder: () => record('underlying', 'longEncoder'),
    right: () => record('underlying', 'right')
  });
  return null;
}

function Fixture() {
  const [visibility, setVisibility] = useState<'small' | 'full' | 'closed'>(
    'closed'
  );
  useEffect(() => {
    probe.visibility = visibility;
    record('visibility', visibility);
    probe.ready = true;
  }, [visibility]);

  return (
    <Provider store={store}>
      <SocketContext.Provider value={socket}>
        <div className="meticulous-main-canvas">
          {/* Same boundary as App; actual components and actions, fake transport. */}
          <VisibilityProvider value={visibility !== 'full'}>
            <HeatingScreen />
            <UnderlyingGestureObserver />
          </VisibilityProvider>
          <Scale updateScaleVisibility={setVisibility} />
        </div>
      </SocketContext.Provider>
    </Provider>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
