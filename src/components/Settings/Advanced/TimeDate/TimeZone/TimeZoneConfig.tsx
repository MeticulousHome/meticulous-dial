import { useMemo, useState } from 'react';
import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../../../store/features/screens/screens-slice';
import { SettingsItem } from '../../../../../types';
import {
  useSettings,
  useUpdateSettings
} from '../../../../../hooks/useSettings';
import { getSettingLabel } from '../../../../../utils/settingsLabels';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../../../styles/utils/calculateOptionPosition';

const initialSettings: SettingsItem[] = [
  {
    key: 'timezone_sync',
    label: 'Automatic',
    visible: true
  },
  {
    key: 'time_zone_selector',
    label: 'Select Timezone',
    visible: true
  },
  {
    key: 'back',
    label: 'Back'
  }
];

export const TimeZoneConfig = () => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: globalSettings, isSuccess } = useSettings();
  const updateSettings = useUpdateSettings();

  const settings = useMemo(
    () =>
      isSuccess
        ? initialSettings
            .filter((setting) =>
              setting.key === 'time_zone_selector'
                ? globalSettings.timezone_sync === 'manual'
                : true
            )
            .map((item) => {
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
        const activeItem = settings[activeIndex].key;
        switch (activeItem) {
          case 'timezone_sync': {
            //toggle automatic/manual C:
            const new_timezone_sync =
              globalSettings.timezone_sync === 'automatic'
                ? 'manual'
                : 'automatic';
            updateSettings.mutate({
              timezone_sync: new_timezone_sync
            });
            break;
          }
          case 'time_zone_selector':
            dispatch(setBubbleDisplay({ visible: false, component: null }));
            dispatch(setScreen('selectLetterCountry'));
            break;
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'timeDate' })
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
};
