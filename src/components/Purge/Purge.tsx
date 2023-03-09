import { useCallback, useEffect, useState } from 'react';

import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';

import './purge.css';

export function Purge(): JSX.Element {
  const [options] = useState(['Automatic', 'Manual']);
  const [activeIndex, setActiveIndex] = useState(0);
  const { screen, gesture } = useAppSelector((state) => state);

  useEffect(() => {
    if (screen.value === 'purge') {
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
      (screen.value === 'scale' && screen.prev === 'purge') ||
      (screen.value === 'purge' && screen.prev === 'scale')
    ) {
      return 'None';
    } else if (screen.value === 'purge') {
      return 'FadeIn';
    } else if (screen.prev === 'purge') {
      return 'FadeOut';
    }
  }, [screen]);

  return (
    <MultipleOptionSlider
      {...{
        activeIndex,
        contentAnimation: getAnimation(),
        options,
        title: 'purge',
        extraClass: 'options--font-50'
      }}
    />
  );
}
