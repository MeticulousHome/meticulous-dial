import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import { updatePresetSetting } from '../store/features/presetSetting/presetSetting-slice';
import { IPresetSetting } from '../../../src/types';

export function OnOff(): JSX.Element {
  const [options] = useState(['Yes', 'No']);
  const [activeIndex, setActiveIndex] = useState(0);
  const { screen, gesture, presetSetting } = useAppSelector((state) => state);
  const dispatch = useDispatch();

  const setting = presetSetting?.updatingSettings.settings.find(
    (setting) => setting.key === 'pre-infusion'
  );

  useEffect(() => {
    if (
      setting?.type === 'on-off' &&
      screen.value !== 'scale' &&
      screen.value !== 'settings' &&
      screen.prev !== 'scale' &&
      screen.prev !== 'settings'
    ) {
      setActiveIndex(setting.value === 'yes' ? 0 : 1);
    }
  }, [setting, screen]);

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
      ((screen.value === 'scale' || screen.value === 'settings') &&
        screen.prev === 'onOff') ||
      (screen.value === 'onOff' &&
        (screen.prev === 'scale' || screen.prev === 'settings'))
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
        title: 'pre-infusion',
        spaceBetween: -40
      }}
    />
  );
}
