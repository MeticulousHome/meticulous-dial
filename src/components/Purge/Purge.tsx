import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import { updatePresetSetting } from '../store/features/presetSetting/presetSetting-slice';
import { IPresetMultipleOptionPurge, IPresetSetting } from '../../../src/types';

import './purge.css';

export function Purge(): JSX.Element {
  const [options] = useState(['Automatic', 'Manual']);
  const [activeIndex, setActiveIndex] = useState(0);
  const { screen, gesture, presetSetting } = useAppSelector((state) => state);

  const dispatch = useDispatch();

  const setting = presetSetting?.updatingSettings.settings.find(
    (setting) => setting.key === 'purge'
  );

  useEffect(() => {
    if (
      setting?.type === 'multiple-option' &&
      screen.value !== 'scale' &&
      screen.prev !== 'scale'
    ) {
      setActiveIndex(setting.value === 'automatic' ? 0 : 1);
    }
  }, [setting, screen]);

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
        case 'click':
          dispatch(
            updatePresetSetting({
              ...setting,
              value: options[activeIndex].toLowerCase()
            } as IPresetSetting)
          );
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
