import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import { updatePresetSetting } from '../store/features/presetSetting/presetSetting-slice';
import { IPresetOnOffPreinfusion, IPresetSetting } from '../../../src/types';

export function OnOff(): JSX.Element {
  const [options] = useState(['Yes', 'No']);
  const [activeIndex, setActiveIndex] = useState(0);
  const { screen, gesture, presetSetting } = useAppSelector((state) => state);
  const dispatch = useDispatch();

  const setting = presetSetting?.updatingSettings.settings[
    presetSetting.activeSetting
  ] as IPresetOnOffPreinfusion;

  useEffect(() => {
    if (setting?.type === 'on-off') {
      setActiveIndex(setting.value === 'Yes' ? 0 : 1);
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
              value: options[activeIndex]
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
        title: 'pre-infusion',
        spaceBetween: -40
      }}
    />
  );
}
