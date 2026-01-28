import { useMemo, useState } from 'react';

import '../../../QuickSettings/quick-settings.css';
import { useHandleGestures } from '../../../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setBubbleDisplay } from '../../../store/features/screens/screens-slice';
import '../../../OSStatus/OSStatus.css';

import type { SettingsItem, TimeDateValues } from '../../../../types';
import type { Settings } from '@meticulous-home/espresso-api';
import { useSettings, useUpdateSettings } from '../../../../hooks/useSettings';
import { useCurrentTime } from '../../../../hooks/useCurrentTime';

import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../../styles/utils/calculateOptionPosition';

const initialSettings: SettingsItem[] = [
  {
    key: 'time_zone',
    label: 'Set time zone',
    getLabel: (settings: Settings) => `${settings.time_zone || 'Not set'}`
  },
  {
    key: 'set_time',
    label: 'Set Time',
    visible: true,
    getLabel: ({ hours, minutes }: TimeDateValues) => `${hours}:${minutes}`,
    value: false
  },
  {
    key: 'set_date',
    label: 'Set Date',
    getLabel: ({ day, month, year }: TimeDateValues) =>
      `${year}-${month}-${day}`,
    visible: true,
    value: false
  },
  {
    key: 'clock_format',
    label: 'Clock Format',
    getLabel: (settings: any) => `${(settings.clock_format_24_hour === true) ? '24h' : '12h'}`,
    visible: true
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
  const updateSettings = useUpdateSettings();

  const { hours, minutes, day, month, year } = useCurrentTime();

  const settings = useMemo(() => {
    if (!isSuccess) {
      return initialSettings.map((item) => ({
        ...item
      }));
    }

    return initialSettings.map((item) => ({
      ...item,
      label: item.getLabel
        ? `${item.label}: ${item.getLabel(
            item.key === 'set_time' || item.key === 'set_date'
              ? { hours, minutes, day, month, year }
              : globalSettings
          )}`
        : item.label
    }));
  }, [globalSettings, isSuccess, hours, minutes, day, month, year]);

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
          case 'clock_format': {
            const currentValue =
              (globalSettings as any)?.clock_format_24_hour === true;
            updateSettings.mutate(
              {
                clock_format_24_hour: !currentValue
              } as any
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
    !bubbleDisplay.interceptsGesture
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
