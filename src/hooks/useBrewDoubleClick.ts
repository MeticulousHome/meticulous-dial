import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

import { handleEvents } from '../HandleEvents';
import { GestureType } from '../types';
import { useAppSelector } from '../components/store/hooks';
import { decideDoubleClick } from './brewDoubleClick';

/**
 * Brew-wide double click handling.
 *
 * Subscribes to the gesture bus directly rather than through the per-screen
 * gesture hook, which only fires for the screen currently visible: a double
 * click has to reach the machine from every screen. The backend no longer ends
 * the profile on a double click, so the decision is made here.
 */
export function useBrewDoubleClick(socket: Socket | null): void {
  const name = useAppSelector((s) => s.stats.name);
  const extracting = useAppSelector((s) => s.stats.extracting);

  // Read the live status inside the subscription without resubscribing.
  const stateRef = useRef({ name, extracting, socket });
  stateRef.current = { name, extracting, socket };

  useEffect(() => {
    const handler = (gesture: GestureType) => {
      if (gesture !== 'doubleClick') return;

      const { name, extracting, socket } = stateRef.current;
      const decision = decideDoubleClick({ name, extracting });

      console.log('doubleClick decision', { decision, name, extracting });

      if (decision) socket?.emit('action', decision);
    };

    const unsubscribe = handleEvents.on('gesture', handler);

    return () => {
      unsubscribe();
    };
  }, []);
}
