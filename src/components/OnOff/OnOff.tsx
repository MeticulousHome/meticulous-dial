import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { MultipleOptionSlider } from '../shared/MultipleOptionSlider';
import {
  IPresetOnOffPreheat,
  IPresetOnOffPreinfusion,
  ISettingType
} from '../../../src/types';
import { updatePresetSetting } from '../store/features/preset/preset-slice';

interface Props {
  type: ISettingType;
}

export function OnOff({ type }: Props): JSX.Element {
  const [options] = useState(['Yes', 'No']);
  const [activeIndex, setActiveIndex] = useState(0);
  const { screen, gesture, presetSetting } = useAppSelector((state) => state);
  const dispatch = useDispatch();

  const setting = presetSetting?.updatingSettings.settings.find(
    (setting) => setting.key === 'pre-infusion'
  );

  const preheatSetting = presetSetting?.updatingSettings.settings.find(
    (setting) => setting.key === 'pre-heat'
  );

  useEffect(() => {
    if (
      (setting?.type === 'on-off' || preheatSetting?.type === 'on-off') &&
      screen.value !== 'scale' &&
      screen.value !== 'settings' &&
      screen.prev !== 'scale' &&
      screen.prev !== 'settings'
    ) {
      const mValue =
        type === 'pre-infusion'
          ? setting?.value || 'yes'
          : preheatSetting?.value || 'yes';

      setActiveIndex(mValue === 'yes' ? 0 : 1);
    }
  }, [setting, preheatSetting, screen]);

  useEffect(() => {
    if (screen.value === 'onOff') {
      switch (gesture.value) {
        case 'right':
          if (activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
          }
          break;
        case 'left':
          if (activeIndex < options.length - 1) {
            setActiveIndex(activeIndex + 1);
          }
          break;
        case 'click':
          if (type === 'pre-heat') {
            dispatch(
              updatePresetSetting({
                ...preheatSetting,
                value: options[activeIndex].toLowerCase()
              } as IPresetOnOffPreheat)
            );
          }

          if (type === 'pre-infusion') {
            dispatch(
              updatePresetSetting({
                ...setting,
                value: options[activeIndex].toLowerCase()
              } as IPresetOnOffPreinfusion)
            );
          }

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
        title: type,
        spaceBetween: -40
      }}
    />
  );
}
