import { useEffect, useRef } from 'react';
import { GestureType } from '../types';
import { handleEvents } from '../HandleEvents';
import { useVisibility } from '../navigation/VisibilityContext';

export function useHandleGestures(
  gestureHandlers: Partial<Record<GestureType, () => void>>,
  shouldIgnoreGesture = false
) {
  const isVisible = useVisibility();
  const state = { gestureHandlers, isVisible };
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(
    () =>
      handleEvents.on('gesture', (gesture) => {
        if (stateRef.current.isVisible && !shouldIgnoreGesture) {
          stateRef.current.gestureHandlers[gesture]?.();
        }
      }),
    [stateRef, shouldIgnoreGesture]
  );
}
