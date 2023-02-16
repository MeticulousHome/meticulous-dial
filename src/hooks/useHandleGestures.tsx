import { useContext, useEffect, useState } from 'react';

import { useAppSelector } from '../components/store/hooks';
import { SockerContext } from '../components/store/SockerManager';
import { setScreen } from '../components/store/features/screens/screens-slice';
import {
  nextPreset,
  prevPreset
} from '../components/store/features/preset/preset-slice';
import {
  setNextSettingOption,
  setPrevSettingOption
} from '../components/store/features/presetSetting/presetSetting-slice';
import { setGesture } from '../components/store/features/gestures/gestures-slice';

export function useHandleGesture({
  presetSettingIndex
}: {
  presetSettingIndex: number;
}) {
  const dispatch = useContext(SockerContext);
  const { gesture, screen } = useAppSelector((state) => state);

  let option = true;

  useEffect(() => {
    // console.log('Prev Gesture >> ', gesture.prev);
    // console.log('Current Gesture >> ', gesture.value);
    // console.log('Prev Screen >> ', screen.prev);
    // console.log('Current Screen >> ', screen.value);

    switch (screen.value) {
      case 'barometer':
        if (gesture.value === 'right' || gesture.value === 'left') {
          dispatch(setScreen('pressets'));
        } else if (gesture.value === 'click') {
          dispatch(setScreen('pressetSettings'));
        } else if (gesture.value === 'doubleTare') {
          dispatch(setScreen('scale'));
        }
        break;
      case 'pressets':
        if (gesture.value === 'click') {
          dispatch(setScreen('barometer'));
        } else if (gesture.value === 'left') {
          dispatch(prevPreset());
        } else if (gesture.value === 'right') {
          dispatch(nextPreset());
        }
        break;
      case 'pressetSettings':
        if (gesture.value === 'click' && option) {
          if (presetSettingIndex === 8 || presetSettingIndex == 9) {
            option = false;
            dispatch(setScreen('barometer'));
          } else {
            option = false;
            dispatch(setScreen('settingNumerical'));
          }
        } else if (gesture.value === 'right') {
          dispatch(setNextSettingOption());
        } else if (gesture.value === 'left') {
          dispatch(setPrevSettingOption());
        }
        break;
      case 'scale':
        if (gesture.value === 'doubleTare') {
          dispatch(setScreen('barometer'));
        }
        break;
      case 'settingNumerical':
        if (gesture.value === 'click') {
          dispatch(setScreen('pressetSettings'));
        }
        break;
      default:
        break;
    }

    dispatch(setGesture('')); // we need to clean the state up to receive event notification
  }, [gesture, screen]);
}
