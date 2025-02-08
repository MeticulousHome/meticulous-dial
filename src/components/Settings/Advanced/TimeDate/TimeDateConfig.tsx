import { useMemo, useState } from 'react';

import '../../../QuickSettings/quick-settings.css';
import { useHandleGestures } from '../../../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setBubbleDisplay } from '../../../store/features/screens/screens-slice';
import '../../../OSStatus/OSStatus.css';

import { SettingsItem } from '../../../../types';
import { useSettings } from '../../../../hooks/useSettings';

import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../../styles/utils/calculateOptionPosition';
import { getSettingLabel } from '../../../../utils/settingsLabels';

const initialSettings: SettingsItem[] = [
  {
    key: 'time_zone',
    label: 'Set time zone'
  },
  {
    key: 'set_time',
    label: 'Set Time',
    visible: true,
    value: false
  },
  {
    key: 'set_date',
    label: 'Set Date',
    visible: true,
    value: false
  },
  {
    key: 'back',
    label: 'Back'
  }
];

export function TimeDate(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: globalSettings, isSuccess } = useSettings();

  const settings = useMemo(
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
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
      },
      pressDown() {
        switch (settings[activeIndex].key) {
          case 'time_zone': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeZoneConfig' })
            );
            break;
          }
          case 'set_time': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeConfig' })
            );
            break;
          }
          case 'set_date': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'dateConfig' })
            );
            break;
          }
          case 'back': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
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
        settings
      }),
    [activeIndex, settings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings
      }),
    [activeIndex, settings]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {settings.map((option) => (
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
            {settings.map((option, index) => (
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
