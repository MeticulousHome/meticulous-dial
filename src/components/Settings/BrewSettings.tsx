import { useMemo, useState } from 'react';

import { SettingsKey } from '@meticulous-home/espresso-api';
import type { Settings } from '@meticulous-home/espresso-api';

import '../PressetSettings/pressetSettings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';

import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { SettingsItem } from '../../types';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import type { DialSettings } from '../../types';
import { retractionMmToVolumeMl } from '../../utils/retraction';
import { useDeviceInfo } from '../../hooks/useDeviceOSStatus';

const initialSettings: SettingsItem[] = [
  {
    key: 'auto_start_shot',
    label: 'Start',
    getLabel: (settings: Settings) =>
      `${settings.auto_start_shot ? 'Automatic' : 'On button press'}`
  },
  {
    key: 'auto_purge_after_shot',
    label: 'Purge',
    getLabel: (settings: Settings) =>
      `${settings.auto_purge_after_shot ? 'Automatic' : 'On button press'}`
  },
  {
    key: 'shot_volume',
    label: 'Retraction distance',
    getLabel: (settings: Settings) =>
      `${retractionMmToVolumeMl(settings.partial_retraction)} mL`,
    visible: true
  },
  {
    key: 'tare_behavior',
    label: 'Auto Tare',
    getLabel: (settings: Settings) =>
      (settings as DialSettings).tare_behavior === 'before_retraction'
        ? 'Before retraction'
        : 'After retraction',
    visible: true
  },
  {
    key: 'heat_timeout_after_shot',
    label: 'Pre/Post-heat',
    getLabel: (settings: Settings) => `${settings.heating_timeout} min`,
    visible: true
  },
  {
    key: 'back',
    label: 'Back'
  }
];

export function BrewSettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings, isSuccess } = useSettings();
  const { data: deviceInfo } = useDeviceInfo({ refetchInterval: 10000 });
  const updateSettings = useUpdateSettings();

  const updatedSettings = useMemo(() => {
    if (!isSuccess) {
      return initialSettings.map((item) => ({
        ...item
      }));
    }
    return initialSettings.map((item) => ({
      ...item,
      label:
        item.key === 'tare_behavior' && !deviceInfo?.tare_behavior_supported
          ? `${item.label}: Unavailable`
          : item.getLabel
            ? `${item.label}: ${item.getLabel(globalSettings)}`
            : item.label
    }));
  }, [deviceInfo?.tare_behavior_supported, globalSettings, isSuccess]);

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
          case 'heat_timeout_after_shot':
            dispatch(setScreen('heat_timeout_after_shot'));
            dispatch(
              setBubbleDisplay({ visible: false, component: undefined })
            );
            break;
          case 'shot_volume':
            dispatch(setScreen('retraction_volume'));
            dispatch(
              setBubbleDisplay({
                visible: false,
                component: null
              })
            );
            break;
          case 'tare_behavior':
            if (!deviceInfo?.tare_behavior_supported) {
              break;
            }
            dispatch(setScreen('tare_behavior'));
            dispatch(
              setBubbleDisplay({
                visible: false,
                component: null
              })
            );
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'quick-settings' })
            );
            break;
          default: {
            if (
              typeof globalSettings[activeItem.key as SettingsKey] === 'boolean'
            ) {
              const new_value = !globalSettings[activeItem.key as SettingsKey];
              updateSettings.mutate({ [activeItem.key]: new_value });
            } else {
              console.error('This setting type is not yet implemented!');
            }
            break;
          }
        }
      }
    },
    !bubbleDisplay.interceptsGesture
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
            <Styled.Option key={option.key}>
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {updatedSettings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $isMarquee={
                  activeIndex === index &&
                  option.label.length > MARQUEE_MIN_TEXT_LENGTH
                }
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
