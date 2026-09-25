import { useCallback, useRef } from 'react';

import { useAppSelector } from '../components/store/hooks';
import { useSocket } from '../components/store/SocketManager';
import { decideDoubleClick } from './brewDoubleClick';

/**
 * The `doubleClick` handler for one brew screen.
 *
 * The visible screen owns the gesture, so this is registered per screen
 * through `useHandleGestures` rather than on the gesture bus: only the four
 * screens the dial shows during a shot forward a double click to the machine,
 * and every other screen keeps its own meaning for it. `allowFinish` is the
 * screen's permission — the barometer is the only caller that passes `true`.
 *
 * The returned callback is stable, so the handler object a screen builds on
 * every render never resubscribes anything.
 */
export function useBrewDoubleClickHandler(options: {
  allowFinish: boolean;
}): () => void {
  const { allowFinish } = options;
  const name = useAppSelector((s) => s.stats.name);
  const extracting = useAppSelector((s) => s.stats.extracting);
  const screen = useAppSelector((s) => s.screen.value);
  const socket = useSocket();

  // Read the live status when the gesture arrives rather than when the
  // callback was created.
  const stateRef = useRef({ name, extracting, screen, socket, allowFinish });
  stateRef.current = { name, extracting, screen, socket, allowFinish };

  return useCallback(() => {
    const { name, extracting, screen, socket, allowFinish } = stateRef.current;
    const decision = decideDoubleClick({ name, extracting }, { allowFinish });

    console.log('doubleClick decision', { screen, decision, name, extracting });

    if (decision) socket?.emit('action', decision);
  }, []);
}
