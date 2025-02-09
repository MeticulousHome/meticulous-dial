import { useMemo, useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { SettingsItem } from '../../../types';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import Styled, {
  VIEWPORT_HEIGHT,
  MenuAnnotation
} from '../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';

export const IdleScreens: SettingsItem[] = [
  {
    key: 'default',
    label: 'Analog Clock',
    shortLabel: 'Analog',
    visible: true
  },
  {
    key: 'digital',
    label: 'Digital Clock',
    shortLabel: 'Digital',
    visible: true
  },
  {
    key: 'metCat',
    label: 'Digital Cat Clock',
    shortLabel: 'Cat',
    visible: true
  },
  {
    key: 'dvd',
    label: 'DVD Style',
    shortLabel: 'DVD',
    visible: true
  }
];

export const IdleScreenSetting = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const settings = [
    ...IdleScreens,
    {
      key: 'back',
      label: 'Back',
      visible: true
    }
  ];

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
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
          default: {
            const screen = settings[activeIndex].key;
            updateSettings.mutate({ idle_screen: screen });
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
          {settings.map((option) => {
            const isSelectedIdlScreen =
              globalSettings?.idle_screen === option.key;
            return (
              <Styled.SelectedOption key={option.key}>
                <span>{option.label}</span>
                {isSelectedIdlScreen && (
                  <MenuAnnotation $marginRigth="1.2rem">current</MenuAnnotation>
                )}
              </Styled.SelectedOption>
            );
          })}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {settings.map((option) => {
              const isSelectedIdlScreen =
                globalSettings?.idle_screen === option.key;
              return (
                <Styled.SelectedOption key={option.key}>
                  <span>{option.label}</span>
                  {isSelectedIdlScreen && (
                    <MenuAnnotation>current</MenuAnnotation>
                  )}
                </Styled.SelectedOption>
              );
            })}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
