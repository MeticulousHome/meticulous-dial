import { useMemo, useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { SettingsItem } from '../../../types';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import Styled, {
  VIEWPORT_HEIGHT,
  MenuAnnotation
} from '../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';

const UPDATE_CHANNELS = ['stable', 'beta', 'rel', 'nightly'];

export const UpdateChannel = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const settings: SettingsItem[] = [
    ...UPDATE_CHANNELS.map((channel) => ({
      key: channel,
      label: channel,
      visible: true
    })),
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
            const channel = settings[activeIndex].key;
            updateSettings.mutate({ update_channel: channel });
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
            const isSelectedChannel =
              globalSettings?.update_channel === option.key;
            return (
              <Styled.SelectedOption key={option.key}>
                <span>{option.label}</span>
                {isSelectedChannel && (
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
              const isSelectedChannel =
                globalSettings?.update_channel === option.key;
              return (
                <Styled.SelectedOption key={option.key}>
                  <span>{option.label}</span>
                  {isSelectedChannel && (
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
