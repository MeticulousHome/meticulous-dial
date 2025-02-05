import { useMemo, useState } from 'react';

import './settings.css'; //verify this :D
import '../PressetSettings/pressetSettings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';

import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import type { SettingsItem } from '../../types';

import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { getSettingLabel } from '../../utils/settingsLabels';

const initialSettings: SettingsItem[] = [
  {
    key: 'device_info',
    label: 'Device Info',
    visible: true
  },
  {
    key: 'time_date',
    label: 'time & date',
    visible: true
  },
  {
    key: 'enable_sounds',
    label: 'sounds',
    visible: true
  },
  {
    key: 'calibrate',
    label: 'calibrate scale'
  },
  {
    key: 'advanced',
    label: 'Advanced Settings'
  },
  {
    key: 'back',
    label: 'Back'
  }
];

export function Settings(): JSX.Element {
  const { data: globalSettings, isSuccess } = useSettings();

  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const updateSettings = useUpdateSettings();
  const updatedSettings = useMemo(
    () =>
      isSuccess
        ? initialSettings.map((item) => {
            const newLabel = getSettingLabel(item.key, globalSettings);
            return newLabel
              ? { ...item, label: `${item.label}: ${newLabel}` }
              : item;
          })
        : initialSettings,
    [globalSettings, isSuccess]
  );

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, updatedSettings.length - 1)
        );
      },
      pressDown() {
        const activeItem = updatedSettings[activeIndex];
        switch (activeItem.key) {
          case 'device_info':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'deviceInfo' })
            );
            break;
          case 'advanced': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          }
          case 'usb_mode': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'usbSettings' })
            );
            break;
          }
          case 'calibrate': {
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            dispatch(setScreen('calibrateScale'));
            break;
          }
          case 'enable_sounds':
            updateSettings.mutate({
              enable_sounds: !globalSettings.enable_sounds
            });
            break;
          case 'time_date':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeDate' })
            );
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
        }
      }
    },
    !bubbleDisplay.visible
  );

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {updatedSettings.map((option) => (
            <Styled.Option key={option.key} $hasSeparator={option.hasSeparator}>
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {updatedSettings.map((option) => (
              <Styled.Option
                key={option.key}
                $hasSeparator={option.hasSeparator}
              >
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
}
