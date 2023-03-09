import { useCallback, useEffect, useState } from 'react';

import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';

export function OnOff(): JSX.Element {
  const [options] = useState(['Yes', 'No']);
  const [activeIndex, setActiveIndex] = useState(0);
  const { screen, gesture } = useAppSelector((state) => state);

  useEffect(() => {
    if (screen.value === 'onOff') {
      switch (gesture.value) {
        case 'right':
          if (activeIndex < options.length - 1) {
            setActiveIndex(activeIndex + 1);
          }
          break;
        case 'left':
          if (activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
          }
          break;
        default:
          break;
      }
    }
  }, [screen, gesture]);

  const getAnimation = useCallback(() => {
    if (
      (screen.value === 'scale' && screen.prev === 'onOff') ||
      (screen.value === 'onOff' && screen.prev === 'scale')
    ) {
      return 'None';
    } else if (screen.value === 'onOff') {
      return 'FadeIn';
    } else if (screen.prev === 'onOff') {
      return 'FadeOut';
    }
  }, [screen]);

  return (
    <MultipleOptionSlider
      {...{
        activeIndex,
        contentAnimation: getAnimation(),
        options,
        title: 'pre-infusion'
      }}
    />
  );
}
