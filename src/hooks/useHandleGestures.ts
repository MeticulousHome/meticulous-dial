import { useEffect } from 'react';
import { GestureType } from '../types';
import { handleEvents } from '../HandleEvents';
import { useVisibility } from '../navigation/VisibilityContext';

export function useHandleGestures(
  gestureHandlers: Partial<Record<GestureType, () => void>>
) {
  const isVisible = useVisibility();
  useEffect(() => {
    if (isVisible) {
      return handleEvents.on('gesture', (gesture) => {
        gestureHandlers[gesture]?.();
      });
    }
  }, [gestureHandlers, isVisible]);
}
