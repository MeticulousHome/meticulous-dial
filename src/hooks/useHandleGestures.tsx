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
import { IPresetType } from '../../src/types';

export function useHandleGesture({
  presetSettingIndex,
  keyboardReady
}: {
  presetSettingIndex: IPresetType;
  keyboardReady: React.MutableRefObject<boolean>;
}) {
  const dispatch = useContext(SockerContext);
  const { gesture, screen, stats } = useAppSelector((state) => state);

  useEffect(() => {
    // console.log('Prev Gesture >> ', gesture.prev);
    // console.log('Current Gesture >> ', gesture.value);
    // console.log('Prev Screen >> ', screen.prev);
    // console.log('Current Screen >> ', screen.value);

    if (stats.name === 'idle') {
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
          if (gesture.value === 'click') {
            if (
              presetSettingIndex === 'save' ||
              presetSettingIndex == 'discard'
            ) {
              dispatch(setScreen('barometer'));
            } else if (presetSettingIndex === 'name') {
              dispatch(setScreen('circleKeyboard'));
            } else {
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
        case 'circleKeyboard':
          if (gesture.value === 'click' && keyboardReady.current) {
            dispatch(setScreen('pressetSettings'));
            keyboardReady.current = false;
          }
          break;
        default:
          break;
      }
    } else {
      dispatch(setScreen('barometer'));
    }

    dispatch(setGesture('')); // we need to clean the state up to receive event notification
  }, [gesture, screen, stats]);
}
