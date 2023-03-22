import { useContext, useEffect } from 'react';

import { IPresetType } from '../../src/types';
import { setGesture } from '../components/store/features/gestures/gestures-slice';
import {
  addPresetNewOne,
  savePresets,
  setNextPreset,
  setPrevPreset
} from '../components/store/features/preset/preset-slice';
import {
  discardSettings,
  resetActiveSetting,
  savePresetSetting,
  setNextSettingOption,
  setPrevSettingOption
} from '../components/store/features/presetSetting/presetSetting-slice';
import { setScreen } from '../components/store/features/screens/screens-slice';
import { useAppSelector } from '../components/store/hooks';
import { SockerContext } from '../components/store/SockerManager';

export function useHandleGesture({
  presetSettingIndex,
  keyboardReady
}: {
  presetSettingIndex: IPresetType;
  keyboardReady: React.MutableRefObject<boolean>;
}) {
  const dispatch = useContext(SockerContext);
  const { gesture, screen, stats, presets, presetSetting } = useAppSelector(
    (state) => state
  );

  useEffect(() => {
    // console.log('Prev Gesture >> ', gesture.prev);
    // console.log('Current Gesture >> ', gesture.value);
    // console.log('Prev Screen >> ', screen.prev);
    // console.log('Current Screen >> ', screen.value);

    if (stats.name === 'idle') {
      if (gesture.value === 'doubleTare') {
        if (screen.value === 'scale') {
          dispatch(setScreen(screen.prev));
        } else {
          dispatch(setScreen('scale'));
        }
      } else {
        switch (screen.value) {
          case 'barometer':
            if (gesture.value === 'right' || gesture.value === 'left') {
              dispatch(setScreen('pressets'));
            } else if (gesture.value === 'click') {
              dispatch(resetActiveSetting());
              dispatch(setScreen('pressetSettings'));
            }
            // else if (gesture.value === 'doubleTare') {
            //   dispatch(setScreen('scale'));
            // }
            break;
          case 'pressets':
            if (gesture.value === 'click') {
              if (presets.activeIndexSwiper === presets.value.length) {
                dispatch(addPresetNewOne());
              } else {
                dispatch(setScreen('barometer'));
              }
            } else if (gesture.value === 'left') {
              dispatch(setPrevPreset());
            } else if (gesture.value === 'right') {
              dispatch(setNextPreset());
            }
            break;
          case 'pressetSettings':
            if (gesture.value === 'click') {
              if (presetSettingIndex === 'save') {
                dispatch(savePresetSetting(presetSetting.updatingSettings));
                dispatch(savePresets(presetSetting.updatingSettings));
                dispatch(setScreen('barometer'));
              } else if (presetSettingIndex == 'discard') {
                dispatch(discardSettings());
                dispatch(setScreen('barometer'));
              } else if (presetSettingIndex === 'name') {
                dispatch(setScreen('circleKeyboard'));
              } else if (presetSettingIndex === 'pre-infusion') {
                dispatch(setScreen('onOff'));
              } else if (presetSettingIndex === 'purge') {
                dispatch(setScreen('purge'));
              } else {
                dispatch(setScreen('settingNumerical'));
              }
            } else if (gesture.value === 'right') {
              dispatch(setNextSettingOption());
            } else if (gesture.value === 'left') {
              dispatch(setPrevSettingOption());
            }
            break;
          // case 'scale':
          //   if (gesture.value === 'doubleTare') {
          //     dispatch(setScreen('barometer'));
          //   }
          //   break;
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
          case 'onOff':
            if (gesture.value === 'click') {
              dispatch(setScreen('pressetSettings'));
            }
            break;
          case 'purge':
            if (gesture.value === 'click') {
              dispatch(setScreen('pressetSettings'));
            }
            break;
          default:
            break;
        }
      }
    } else {
      dispatch(setScreen('barometer'));
    }

    dispatch(setGesture('')); // we need to clean the state up to receive event notification
  }, [gesture, screen, stats.name]);
}
