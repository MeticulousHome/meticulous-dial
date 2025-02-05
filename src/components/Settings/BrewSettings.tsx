import { useMemo, useState } from 'react';
import 'swiper/css';

import { SettingsKey } from '@meticulous-home/espresso-api';

import './settings.css';
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
import { getSettingLabel } from '../../utils/settingsLabels';

const initialSettings: SettingsItem[] = [
  {
    key: 'auto_start_shot',
    label: 'Auto start after heating'
  },
  {
    key: 'auto_purge_after_shot',
    label: 'Auto purge after shot'
  },
  {
    key: 'heat_timeout_after_shot',
    label: 'Heat timeout after shot',
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
          case 'heat_timeout_after_shot':
            dispatch(setScreen('heat_timeout_after_shot'));
            dispatch(setBubbleDisplay({ visible: false, component: null }));
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
            {updatedSettings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $hasSeparator={option.hasSeparator}
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
