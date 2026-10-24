import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Profile } from '@meticulous-home/espresso-profile';
import { useEffect } from 'react';
import { store } from '../../src/components/store/store';
import { VisibilityProvider } from '../../src/navigation/VisibilityContext';
import { IdleTimerProvider } from '../../src/hooks/useIdleTimer';
import {
  QUERY_KEY_HISTORY,
  lastShotForProfileQuery
} from '../../src/hooks/useHistory';
import { ShotGraphScreen } from '../../src/components/ShotGraph/ShotGraphScreen';
import { handleEvents } from '../../src/HandleEvents';
import type { GestureType } from '../../src/types';
import { profile } from './mocks';
import { shot } from './shot';
import '../../src/globals.css';

const probe = {
  ready: false,
  errors: [] as string[],
  emit(...gestures: GestureType[]) {
    for (const gesture of gestures) handleEvents.emit('gesture', gesture, 1000);
  }
};

declare global {
  interface Window {
    shotGraphProbe: typeof probe;
  }
}
window.shotGraphProbe = probe;
// An exception during render unmounts the whole tree: the black screen.
window.addEventListener('error', (event) => probe.errors.push(event.message));

// The backend's answer to the screen's own history query, already cached:
// the screen reads it through its real hook and never reaches a machine.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } }
});
queryClient.setQueryData(
  [QUERY_KEY_HISTORY, lastShotForProfileQuery(profile as Profile)],
  { history: [shot] }
);

function Ready() {
  useEffect(() => {
    probe.ready = true;
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <IdleTimerProvider>
        <div className="meticulous-main-canvas">
          <VisibilityProvider value={true}>
            <ShotGraphScreen />
            <Ready />
          </VisibilityProvider>
        </div>
      </IdleTimerProvider>
    </QueryClientProvider>
  </Provider>
);
