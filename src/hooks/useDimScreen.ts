import { useIdleTimer } from './useIdleTimer';
import { useEffect, useRef } from 'react';
import { setBrightness } from '../api/api';
import { BrightnessRequest } from '@meticulous-home/espresso-api';

export const updateBrightness = async ({ brightness }: BrightnessRequest) => {
  await setBrightness({ brightness });
};

export const useDimScreen = () => {
  const { isIdle: shouldGoToIdle } = useIdleTimer();
  const prevShouldGoToIdle = useRef<boolean | null>(null);

  useEffect(() => {
    if (
      prevShouldGoToIdle.current !== null &&
      prevShouldGoToIdle.current !== shouldGoToIdle
    ) {
      updateBrightness({ brightness: shouldGoToIdle ? 0 : 1 });
    }
    prevShouldGoToIdle.current = shouldGoToIdle;
  }, [shouldGoToIdle]);
};
