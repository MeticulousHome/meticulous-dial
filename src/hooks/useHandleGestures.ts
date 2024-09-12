import { useEffect, useRef } from 'react';
import { GestureType } from '../types';
import { handleEvents } from '../HandleEvents';
import { useVisibility } from '../navigation/VisibilityContext';

export function useHandleGestures(
  gestureHandlers: Partial<Record<GestureType, (time: number) => void>>,
  // When stat is not in idle, lock the screen at Barometer
  shouldIgnoreGesture = false
) {
  const isVisible = useVisibility();
  const state = { gestureHandlers, isVisible };
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(
    () =>
      handleEvents.on('gesture', (gesture, time_since_last_event) => {
        if (stateRef.current.isVisible && !shouldIgnoreGesture) {
          stateRef.current.gestureHandlers[gesture]?.(time_since_last_event);
        }
      }),
    [stateRef, shouldIgnoreGesture]
  );
}
