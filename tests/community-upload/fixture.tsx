import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunitySettings } from '../../src/components/Settings/Community/Community';
import { VisibilityProvider } from '../../src/navigation/VisibilityContext';
import { handleEvents } from '../../src/HandleEvents';
import type { GestureType } from '../../src/types';
import { probe } from './mocks';
import '../../src/globals.css';

const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
});
// Keep the transport and test controls on the same object.
const controls = Object.assign(probe, {
  emit(gesture: GestureType) {
    handleEvents.emit('gesture', gesture, 1000);
  }
});
declare global {
  interface Window {
    communityProbe: typeof controls;
  }
}
window.communityProbe = controls;
const initial = new URLSearchParams(window.location.search).get('initial');
if (initial === 'disconnected')
  probe.setStatus({ connected: false, state: 'not_connected' });
if (initial === 'status-error') probe.statusError = true;

function Fixture() {
  useEffect(() => {
    probe.ready = true;
  }, []);
  return (
    <QueryClientProvider client={client}>
      <VisibilityProvider value={true}>
        <div
          className="meticulous-main-canvas"
          style={{ borderRadius: '50%', background: '#171717' }}
        >
          <CommunitySettings />
        </div>
      </VisibilityProvider>
    </QueryClientProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
