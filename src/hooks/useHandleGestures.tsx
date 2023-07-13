import { useContext, useEffect } from 'react';

import { IPresetType } from '../../src/types';
import { setGesture } from '../components/store/features/gestures/gestures-slice';
import {
  addPresetNewOne,
  deletePreset,
  discardSettings,
  resetActiveSetting,
  savePreset,
  setNextPreset,
  setNextSettingOption,
  setPrevPreset,
  setPrevSettingOption
} from '../components/store/features/preset/preset-slice';
import { setScreen } from '../components/store/features/screens/screens-slice';
import { useAppSelector } from '../components/store/hooks';
import { SocketContext } from '../components/store/SocketManager';
import {
  resetActiveIndexGeneralSettingOption,
  setNextGeneralSettingOption,
  setPrevGeneralSettingOption
} from '../components/store/features/settings/settings-slice';

export function useHandleGesture({
  presetSettingIndex,
  keyboardReady
}: {
  presetSettingIndex: IPresetType;
  keyboardReady: React.MutableRefObject<boolean>;
}) {
  const dispatch = useContext(SocketContext);
  const { gesture, screen, stats, presets, settings } = useAppSelector(
    (state) => state
  );

  useEffect(() => {
    // console.log('Prev Gesture >> ', gesture.prev);
    // console.log('Current Gesture >> ', gesture.value);
    // console.log('Prev Screen >> ', screen.prev);
    // console.log('Current Screen >> ', screen.value);

    if (stats.name === 'idle') {
      if (gesture.value === 'doubleTare' && presets.value.length > 0) {
        if (screen.value === 'scale') {
          dispatch(
            setScreen(screen.prev === 'settings' ? 'barometer' : screen.prev)
          );
        } else {
          dispatch(setScreen('scale'));
        }
      } else if (gesture.value === 'longTare') {
        if (screen.value !== 'settings') {
          dispatch(resetActiveIndexGeneralSettingOption());
          dispatch(setScreen('settings'));
        }
      } else {
        switch (screen.value) {
          case 'barometer':
            if (gesture.value === 'right' || gesture.value === 'left') {
              dispatch(setScreen('pressets'));
            } else if (gesture.value === 'click' && presets.value.length > 0) {
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
              dispatch(setNextPreset());
            } else if (gesture.value === 'right') {
              dispatch(setPrevPreset());
            }
            break;
          case 'pressetSettings':
            if (gesture.value === 'click') {
              if (presetSettingIndex === 'save') {
                dispatch(savePreset());
                dispatch(setScreen('barometer'));
              } else if (presetSettingIndex == 'discard') {
                dispatch(discardSettings());
                dispatch(setScreen('barometer'));
              } else if (presetSettingIndex === 'delete') {
                dispatch(deletePreset());
                dispatch(setScreen('pressets'));
              } else if (presetSettingIndex === 'name') {
                dispatch(setScreen('circleKeyboard'));
              } else if (presetSettingIndex === 'pre-infusion') {
                dispatch(setScreen('onOff'));
              } else if (presetSettingIndex === 'purge') {
                dispatch(setScreen('purge'));
              } else if (presetSettingIndex === 'pre-heat') {
                dispatch(setScreen('onOff'));
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
          case 'settings':
            if (gesture.value === 'click') {
              if (settings.settings[settings.activeIndexSetting]) {
                switch (settings.settings[settings.activeIndexSetting].key) {
                  case 'home':
                    dispatch(setScreen('barometer'));
                    break;
                  case 'purge':
                    dispatch(setScreen('barometer'));
                    break;
                  case 'exit':
                    dispatch(
                      setScreen(
                        screen.prev === 'scale' ? 'barometer' : screen.prev
                      )
                    );
                    break;
                  default:
                    break;
                }
              }
            } else if (gesture.value === 'right') {
              dispatch(setNextGeneralSettingOption());
            } else if (gesture.value === 'left') {
              dispatch(setPrevGeneralSettingOption());
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
  }, [gesture, screen, stats.name, settings]);
}
